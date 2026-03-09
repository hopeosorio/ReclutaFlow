import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Check, ChevronRight, ChevronLeft, Upload, FileText, Calendar as CalendarIcon, User, ShieldCheck, Signature as SignatureIcon } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import SlotCalendarV2 from "@/components/SlotCalendarV2";
import { supabase } from "@/lib/supabaseClient";

// --- Interfaces ---
interface PrivacyNotice { id: string; content_md: string; }
interface JobPosting { id: string; title: string; branch: string | null; area: string | null; employment_type: string | null; description_short: string | null; }
interface JobProfile {
  role_summary: string | null;
  requirements: string | null;
  min_education: string | null;
  schedule: string | null;
  salary_range: string | null;
  location_details: string | null;
  skills: string | null;
  experience: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  benefits: string | null;
  growth_plan: string | null;
}
interface ScreeningQuestion { id: string; question_text: string; question_type: "text" | "boolean" | "single_choice" | "multi_choice" | "number"; options: string[] | null; is_required: boolean; }
interface DocumentType { id: string; name: string; stage: "application" | "post_interview" | "onboarding"; is_required: boolean; }

interface ApplyFormValues {
  consent: { accepted: boolean; };
  job_posting_id: string;
  person: { first_name: string; last_name: string; email: string; phone: string; address_line1: string; city: string; state: string; postal_code: string; };
  candidate: { education_level: string; has_education_certificate: string; };
  screening_answers: Record<string, string | string[] | boolean | number>;
  signature_base64: string | null;
  signer_name: string;
  availability: { slot_1: string; slot_2: string; slot_3: string; };
}

// --- Components ---


const SectionTitle = ({ mono, title }: { mono: string, title: string }) => (
  <div className="section-title-wrapper mb-8">
    <span className="mono color-accent">// {mono}</span>
    <h2 className="outfit-bold">{title}</h2>
  </div>
);

// --- Main Flow ---

const steps = [
  { id: "consent", label: "FASE 01", helper: "CONSENTIMIENTO", icon: ShieldCheck },
  { id: "vacancy", label: "FASE 02", helper: "SELECCIÓN", icon: FileText },
  { id: "profile", label: "FASE 03", helper: "IDENTIDAD", icon: User },
  { id: "availability", label: "FASE 04", helper: "ENCUENTRO", icon: CalendarIcon },
  { id: "finalize", label: "FASE 05", helper: "EJECUCIÓN", icon: SignatureIcon },
];

export default function ApplyFlow() {
  const [step, setStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState<PrivacyNotice | null>(null);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [selectedJobProfile, setSelectedJobProfile] = useState<JobProfile | null>(null);
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(true);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    setError,
    formState: { errors },
  } = useForm<ApplyFormValues>({
    defaultValues: {
      consent: { accepted: false },
      job_posting_id: "",
      person: { first_name: "", last_name: "", email: "", phone: "", address_line1: "", city: "", state: "", postal_code: "" },
      candidate: { education_level: "", has_education_certificate: "" },
      screening_answers: {},
      signature_base64: null,
      signer_name: "",
      availability: { slot_1: "", slot_2: "", slot_3: "" },
    },
  });

  const selectedJobId = watch("job_posting_id");
  const signatureValue = watch("signature_base64");

  // --- Data Loading ---
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      try {
        const [noticeRes, jobsRes, docsRes] = await Promise.all([
          supabase.from("recruit_privacy_notices").select("id, content_md").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("recruit_job_postings").select("id, title, branch, area, employment_type, description_short").eq("status", "active").order("created_at", { ascending: false }),
          supabase.from("recruit_document_types").select("id, name, stage, is_required").eq("stage", "application").order("name"),
        ]);
        setPrivacyNotice(noticeRes.data as PrivacyNotice);
        setJobPostings(jobsRes.data as JobPosting[]);
        setDocumentTypes(docsRes.data as DocumentType[]);
      } finally {
        setLoading(false);
      }
    };
    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobProfile(null);
      setQuestions([]);
      return;
    }
    const loadJobDetails = async () => {
      const [profileRes, questionsRes] = await Promise.all([
        supabase.from("recruit_job_profiles").select("role_summary, requirements, min_education, schedule, salary_range, location_details, skills, experience, responsibilities, qualifications, benefits, growth_plan").eq("job_posting_id", selectedJobId).maybeSingle(),
        supabase.from("recruit_screening_questions").select("id, question_text, question_type, options, is_required").eq("job_posting_id", selectedJobId).order("created_at", { ascending: true })
      ]);

      setSelectedJobProfile(profileRes.data as JobProfile);
      setQuestions((questionsRes.data ?? []).map(q => ({ ...q, options: Array.isArray(q.options) ? q.options : null })) as ScreeningQuestion[]);
    };
    loadJobDetails();
  }, [selectedJobId]);

  useEffect(() => {
    if (step === 3) {
      const loadOccupied = async () => {
        try {
          const { data } = await supabase.rpc('get_occupied_slots');
          if (data) setOccupiedSlots(data.map((d: any) => d.scheduled_at));
        } catch (e) { console.error("Error loaded occupied slots", e); }
      };
      loadOccupied();
    }
  }, [step]);

  // --- Handlers ---
  const validateStep = async () => {
    setStepError(null);
    if (step === 0) {
      const ok = await trigger("consent.accepted");
      if (!ok) setStepError("Consentimiento legal requerido.");
      return ok;
    }
    if (step === 1) {
      const ok = await trigger("job_posting_id");
      if (!ok) setStepError("Selecciona una vacante para continuar.");
      return ok;
    }
    if (step === 2) {
      const fieldsToTrigger = [
        "person.first_name", "person.last_name", "person.email", "person.phone",
        "candidate.education_level", "candidate.has_education_certificate"
      ];
      const ok = await trigger(fieldsToTrigger as any);
      if (!ok) setStepError("Por favor completa todos tus datos personales.");

      const missingQ = questions.filter(q => q.is_required && !getValues(`screening_answers.${q.id}`));
      if (missingQ.length > 0) {
        missingQ.forEach(q => setError(`screening_answers.${q.id}` as any, { type: "required", message: "Campo obligatorio" }));
        setStepError("Por favor responde todas las preguntas obligatorias.");
        return false;
      }
      return ok;
    }
    if (step === 3) {
      const { slot_1, slot_2, slot_3 } = getValues("availability");
      if (!slot_1) {
        setStepError("Por favor selecciona un horario para tu encuentro virtual.");
        return false;
      }

      // Advanced date validation for filled slots
      const slots = [slot_1, slot_2, slot_3].filter(s => !!s);
      const now = new Date();
      let hasError = false;

      for (let i = 0; i < slots.length; i++) {
        const slotDate = new Date(slots[i]);
        const day = slotDate.getDay();
        const hours = slotDate.getHours();

        // 1. Check if past
        if (slotDate < now) {
          setError(`availability.slot_${i + 1}` as any, { type: "manual", message: "La fecha no puede ser en el pasado" });
          hasError = true;
        }

        // 2. Check if weekend (0 = Sunday, 6 = Saturday)
        if (day === 0 || day === 6) {
          setError(`availability.slot_${i + 1}` as any, { type: "manual", message: "El horario debe ser de Lunes a Viernes" });
          hasError = true;
        }

        // 3. Check office hours (9:00 - 17:00)
        if (hours < 9 || hours >= 17) {
          setError(`availability.slot_${i + 1}` as any, { type: "manual", message: "El horario debe estar entre las 9:00 y las 17:00" });
          hasError = true;
        }

        // 4. Time buffer check: At least 24 hours in advance.
        const diffHours = (slotDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (diffHours < 24) {
          setError(`availability.slot_${i + 1}` as any, { type: "manual", message: "La entrevista debe programarse con al menos 24 horas de anticipación." });
          hasError = true;
        }
      }

      if (hasError) {
        setStepError("Faltan requerimientos en las fechas seleccionadas.");
        return false;
      }

      return true;
    }
    return true;
  };

  const handleNext = async () => {
    const ok = await validateStep();
    if (!ok) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setIsTransitioning(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 400);
  };

  const handleBack = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(s => s - 1);
      setIsTransitioning(false);
    }, 400);
  };

  const onSubmit = async (values: ApplyFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Validation Check
      const uploadedCount = Object.values(documentFiles).filter(f => !!f).length;
      if (uploadedCount === 0) throw new Error("Por favor carga al menos un documento para continuar.");
      if (!values.signature_base64) throw new Error("La firma digital es necesaria para validar tu solicitud.");

      const pId = crypto.randomUUID();
      const cId = crypto.randomUUID();
      const aId = crypto.randomUUID();

      // 1. Person
      const { error: pErr } = await supabase.from('recruit_persons').insert({ id: pId, ...values.person });
      if (pErr) throw pErr;

      // 2. Candidate
      const { error: cErr } = await supabase.from('recruit_candidates').insert({ id: cId, person_id: pId, ...values.candidate, has_education_certificate: values.candidate.has_education_certificate === 'yes' });
      if (cErr) throw cErr;

      // 3. Application — buscar el reclutador con MÁS slots libres entre los 3 propuestos
      let assignedRecruiter: string | null = null;
      const s1 = values.availability.slot_1;
      const s2 = values.availability.slot_2;
      const s3 = values.availability.slot_3;

      if (s1 || s2 || s3) {
        const { data: bestRecruiter } = await supabase.rpc('get_best_recruiter_for_slots', {
          p_slot1: s1 ? new Date(s1).toISOString() : null,
          p_slot2: s2 ? new Date(s2).toISOString() : null,
          p_slot3: s3 ? new Date(s3).toISOString() : null,
        });
        assignedRecruiter = bestRecruiter ?? null;
      }

      const { error: aErr } = await supabase.from('recruit_applications').insert({
        id: aId,
        job_posting_id: values.job_posting_id,
        candidate_id: cId,
        status_key: 'new',
        assigned_to: assignedRecruiter,
        suggested_slot_1: s1 || null,
        suggested_slot_2: s2 || null,
        suggested_slot_3: s3 || null,
      });
      if (aErr) throw aErr;

      // 5. Privacy & Signature
      await supabase.from('recruit_privacy_consents').insert({ application_id: aId, privacy_notice_id: privacyNotice?.id, accepted: true });
      if (values.signature_base64) {
        const path = `applications/${aId}/signatures/sig_${Date.now()}.png`;
        const bytes = Uint8Array.from(atob(values.signature_base64.split(',')[1]), c => c.charCodeAt(0));
        await supabase.storage.from('recruit-docs').upload(path, bytes, { contentType: 'image/png' });
        await supabase.from('recruit_digital_signatures').insert({ application_id: aId, signer_name: values.signer_name || "CANDIDATO", signature_storage_path: path });
      }

      // 5. Screening
      const sArr = Object.entries(values.screening_answers || {}).map(([qId, val]) => ({ application_id: aId, question_id: qId, answer_text: typeof val === 'string' ? val : null, answer_json: typeof val !== 'string' ? val : null }));
      if (sArr.length > 0) await supabase.from('recruit_screening_answers').insert(sArr);

      // 6. Documents
      for (const [dtId, file] of Object.entries(documentFiles)) {
        if (!file) continue;
        const path = `applications/${aId}/documents/${dtId}/${Date.now()}_${file.name}`;
        const { error: uErr } = await supabase.storage.from('recruit-docs').upload(path, file);
        if (!uErr) await supabase.from('recruit_application_documents').insert({ application_id: aId, document_type_id: dtId, storage_path: path });
      }

      setSubmitSuccess(aId);
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDocName = (name: string) => {
    return name.replace(/_/g, ' ').toUpperCase();
  };

  // --- Render Logic ---
  if (loading) return null;

  if (submitSuccess) {
    return (
      <section className="container-full reveal" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' }}>
        <div className="pro-card shadow-accent" style={{ textAlign: 'center', maxWidth: '700px', marginTop: '4rem' }}>
          <div className="success-icon-badge mb-6">
            <Check size={40} className="color-accent" />
          </div>
          <span className="mono mb-2">// SISTEMA ELITE</span>
          <h1 className="outfit-black mb-2" style={{ fontSize: '3.5rem' }}>POSTULACIÓN REGISTRADA.</h1>
          <p className="mono color-accent mb-8" style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>Pronto nos pondremos en contacto contigo a través del correo que dejaste registrado. Mientras tanto, ¡relájate!</p>
          <p className="mono color-dim mb-10">ID TRANSACCIÓN: <span className="color-accent">{submitSuccess}</span></p>
          <div className="flex-center gap-4">
            <Link to="/" className="btn-magnetic">VOLVER AL INICIO</Link>
            <Link to={`/track?id=${submitSuccess}`} className="btn-ghost" style={{ padding: '1.2rem 2.5rem' }}>RASTREAR ESTADO</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="container-full" style={{ paddingBottom: '6rem' }}>
      {/* Background Decor */}
      <div className="elite-bg-glow"></div>

      {/* Header */}
      <div className="apply-header mb-8 flex-between align-end">
        <div>
          <span className="mono color-accent" style={{ fontSize: '0.55rem' }}>// ADQUISICIÓN DE TALENTO</span>
          <h1 className="outfit-black" style={{ fontSize: '2.5rem', marginTop: '0.2rem' }}>UNETE AL EQUIPO.</h1>
        </div>
        <div className="step-count mono" style={{ fontSize: '0.65rem' }}>
          STEP <span className="color-accent">{step + 1}</span> / {steps.length}
        </div>
      </div>

      {/* Progress Multi-step */}
      <div className="step-indicator-bar mb-10">
        {steps.map((s, i) => (
          <div key={s.id} className="step-indicator-item" data-active={i <= step}>
            <div className="step-icon-wrapper" style={{ width: '24px', height: '24px' }}>
              {i < step ? <Check size={10} /> : <s.icon size={10} />}
            </div>
            <div className="step-content">
              <span className="mono" style={{ fontSize: '0.5rem' }}>{s.label}</span>
              <span className="step-helper" style={{ fontSize: '0.6rem' }}>{s.helper}</span>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={`step-content-container ${isTransitioning ? 'step-exit' : 'step-enter'}`}>

          {/* FASE 01: CONSENT */}
          {step === 0 && (
            <div className="pro-card compact-card">
              <SectionTitle mono="CUMPLIMIENTO" title="AVISO DE PRIVACIDAD" />
              <div className="legal-box mb-6 scroll-styled" style={{ height: '200px', fontSize: '0.8rem' }}>
                {privacyNotice?.content_md || "CARGANDO TÉRMINOS LEGALES DEL SISTEMA..."}
              </div>
              <label className="checkbox-standard" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" {...register("consent.accepted", { required: true })} style={{ width: '18px', height: '18px' }} />
                <span className="mono" style={{ fontSize: '0.7rem', fontWeight: '600' }}>CONFIRMO HABER LEÍDO Y ACEPTADO LAS CONDICIONES DE USO Y PRIVACIDAD.</span>
              </label>
            </div>
          )}

          {/* FASE 02: VACANCY */}
          {step === 1 && (
            <div className="vacancy-flow-wrapper">
              <SectionTitle mono="DISPONIBLES" title="SELECCIONA TU VACANTE" />

              {!selectedJobId ? (
                <div className="job-bento-grid">
                  {jobPostings.map((job) => (
                    <label key={job.id} className="job-card-item" data-selected={selectedJobId === job.id}>
                      <input type="radio" value={job.id} {...register("job_posting_id", { required: true })} className="hidden" />
                      <div className="job-card-header flex-between mb-4">
                        <div className="job-tag mono">{job.employment_type || "FULL-TIME"}</div>
                      </div>
                      <h3 className="outfit-bold" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{job.title}</h3>
                      <div className="job-card-meta mono">
                        <div className="meta-row">
                          <span className="color-dim">ÁREA //</span> <span>{job.area}</span>
                        </div>
                        <div className="meta-row">
                          <span className="color-dim">SUCURSAL //</span> <span>{job.branch || "MATRIZ"}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="selected-job-detail pro-card compact-card step-enter">
                  <div className="detail-header flex-between mb-8">
                    <div>
                      <span className="mono color-accent" style={{ fontSize: '0.6rem' }}>VACANTE SELECCIONADA</span>
                      <h3 className="outfit-bold" style={{ fontSize: '1.8rem' }}>{jobPostings.find(j => j.id === selectedJobId)?.title}</h3>
                    </div>
                    <button type="button" className="btn-ghost" onClick={() => setValue("job_posting_id", "")} style={{ padding: '0.5rem 1rem', fontSize: '0.7rem' }}>
                      CAMBIAR SELECCIÓN
                    </button>
                  </div>

                  {selectedJobProfile && (
                    <div className="detail-grid">
                      <div className="detail-main">
                        {selectedJobProfile.role_summary && (
                          <div className="detail-section mb-6">
                            <h4 className="mono color-dim mb-2">// RESUMEN DEL ROL</h4>
                            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.role_summary}</p>
                          </div>
                        )}
                        {selectedJobProfile.requirements && (
                          <div className="detail-section mb-6">
                            <h4 className="mono color-dim mb-2">// REQUISITOS</h4>
                            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.requirements}</p>
                          </div>
                        )}
                        {selectedJobProfile.min_education && (
                          <div className="detail-section mb-6">
                            <h4 className="mono color-dim mb-2">// ESCOLARIDAD MÍNIMA</h4>
                            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.min_education}</p>
                          </div>
                        )}
                        {selectedJobProfile.responsibilities && (
                          <div className="detail-section mb-6">
                            <h4 className="mono color-dim mb-2">// RESPONSABILIDADES</h4>
                            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.responsibilities}</p>
                          </div>
                        )}
                        {selectedJobProfile.qualifications && (
                          <div className="detail-section mb-6">
                            <h4 className="mono color-dim mb-2">// COMPETENCIAS / CALIFICACIONES</h4>
                            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.qualifications}</p>
                          </div>
                        )}
                        {selectedJobProfile.benefits && (
                          <div className="detail-section mb-6">
                            <h4 className="mono color-dim mb-2">// BENEFICIOS</h4>
                            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.benefits}</p>
                          </div>
                        )}
                        {selectedJobProfile.growth_plan && (
                          <div className="detail-section mb-6">
                            <h4 className="mono color-dim mb-2">// PLAN DE CRECIMIENTO</h4>
                            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.growth_plan}</p>
                          </div>
                        )}
                      </div>
                      <div className="detail-side">
                        {selectedJobProfile.skills && (
                          <div className="detail-section mb-6">
                            <h4 className="mono color-dim mb-2">// HABILIDADES CLAVE</h4>
                            <p style={{ fontSize: '0.85rem', lineHeight: '1.5', opacity: 0.8 }}>{selectedJobProfile.skills}</p>
                          </div>
                        )}
                        {selectedJobProfile.experience && (
                          <div className="detail-section mb-6">
                            <h4 className="mono color-dim mb-2">// EXPERIENCIA DESEADA</h4>
                            <p style={{ fontSize: '0.85rem', lineHeight: '1.5', opacity: 0.8 }}>{selectedJobProfile.experience}</p>
                          </div>
                        )}

                        <div className="detail-section mb-6">
                          <h4 className="mono color-dim mb-4">// ESPECIFICACIONES CLAVE</h4>
                          {selectedJobProfile.salary_range && (
                            <div className="meta-info-card mb-4" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
                              <span className="mono color-dim block mb-1" style={{ fontSize: '0.55rem' }}>RANGO SALARIAL</span>
                              <span className="outfit-bold color-accent" style={{ fontSize: '1.3rem' }}>{selectedJobProfile.salary_range}</span>
                            </div>
                          )}
                          {selectedJobProfile.schedule && (
                            <div className="meta-info-card mb-4" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
                              <span className="mono color-dim block mb-1" style={{ fontSize: '0.55rem' }}>HORARIO</span>
                              <span className="outfit-bold" style={{ fontSize: '1.1rem' }}>{selectedJobProfile.schedule}</span>
                            </div>
                          )}
                          {selectedJobProfile.location_details && (
                            <div className="meta-info-card mb-4" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
                              <span className="mono color-dim block mb-1" style={{ fontSize: '0.55rem' }}>UBICACIÓN</span>
                              <span className="outfit-bold" style={{ fontSize: '1rem', opacity: 0.9 }}>{selectedJobProfile.location_details}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FASE 03: IDENTITY */}
          {step === 2 && (
            <div className="pro-card compact-card">
              <SectionTitle mono="IDENTIDAD" title="INFORMACIÓN PERSONAL" />
              <div className="form-grid-2 mb-8">
                <div className="input-group">
                  <label className="mono">NOMBRE(S)</label>
                  <input className="glass-input compact" placeholder="WOLF" {...register("person.first_name", { required: true })} />
                  {errors.person?.first_name && <span className="field-err">REQUERIDO</span>}
                </div>
                <div className="input-group">
                  <label className="mono">APELLIDOS</label>
                  <input className="glass-input compact" placeholder="ELITE" {...register("person.last_name", { required: true })} />
                  {errors.person?.last_name && <span className="field-err">REQUERIDO</span>}
                </div>
                <div className="input-group">
                  <label className="mono">E-MAIL</label>
                  <input className="glass-input compact" type="email" placeholder="CONTACTO@ELITE.COM" {...register("person.email", { required: true })} />
                  {errors.person?.email && <span className="field-err">REQUERIDO</span>}
                </div>
                <div className="input-group">
                  <label className="mono">TELÉFONO</label>
                  <input className="glass-input compact" placeholder="+52 000 000 0000" {...register("person.phone", { required: true })} />
                  {errors.person?.phone && <span className="field-err">REQUERIDO</span>}
                </div>
              </div>

              <SectionTitle mono="ACADÉMICO" title="NIVEL DE ESTUDIOS" />
              <div className="form-grid-2 mb-8" style={{ alignItems: 'start' }}>
                <div className="input-group">
                  <label className="mono">NIVEL EDUCATIVO</label>
                  <select className="glass-input compact" {...register("candidate.education_level", { required: true })} style={{ background: 'transparent', color: 'inherit' }}>
                    <option value="" disabled>SELECCIONA...</option>
                    <option value="secundaria">SECUNDARIA</option>
                    <option value="preparatoria">PREPARATORIA</option>
                    <option value="licenciatura">LICENCIATURA</option>
                    <option value="maestria">MAESTRÍA</option>
                  </select>
                  {errors.candidate?.education_level && <span className="field-err">REQUERIDO</span>}
                </div>
                <div className="input-group">
                  <label className="mono">¿CUENTAS CON CERTIFICADO?</label>
                  <div className="cert-grid">
                    <label className="radio-btn compact"><input type="radio" value="yes" {...register("candidate.has_education_certificate", { required: true })} /> <span>SÍ</span></label>
                    <label className="radio-btn compact"><input type="radio" value="no" {...register("candidate.has_education_certificate", { required: true })} /> <span>NO</span></label>
                  </div>
                  {errors.candidate?.has_education_certificate && <span className="field-err">REQUERIDO</span>}
                </div>
              </div>

              {questions.length > 0 && (
                <>
                  <SectionTitle mono="CUESTIONARIO" title="PREGUNTAS DE FILTRO" />
                  <div className="screening-list grid gap-6">
                    {questions.map((q) => (
                      <div key={q.id} className="input-group">
                        <label className="mono mb-2" style={{ fontSize: '0.65rem' }}>// {q.question_text} {q.is_required && "*"}</label>
                        {q.question_type === "text" && <input className="glass-input compact" {...register(`screening_answers.${q.id}` as any, { required: q.is_required })} />}
                        {(errors.screening_answers as any)?.[q.id] && <span className="field-err">RESPUESTA REQUERIDA</span>}
                        {q.question_type === "boolean" && (
                          <div className="flex gap-4 mt-2">
                            <label className="radio-btn compact"><input type="radio" value="true" {...register(`screening_answers.${q.id}` as any)} /> <span>SI</span></label>
                            <label className="radio-btn compact"><input type="radio" value="false" {...register(`screening_answers.${q.id}` as any)} /> <span>NO</span></label>
                          </div>
                        )}
                        {q.question_type === "single_choice" && (
                          <div className="choice-grid compact-choices">
                            {q.options?.map(opt => (
                              <label key={opt} className="choice-item compact-choice">
                                <input type="radio" value={opt} {...register(`screening_answers.${q.id}` as any)} />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* FASE 04: AVAILABILITY */}
          {step === 3 && (
            <div className="pro-card compact-card">
              <SectionTitle mono="AGENDAMIENTO" title="HORARIOS DE ENTREVISTA" />
              <p className="mono color-dim mb-8" style={{ fontSize: '0.75rem' }}>SELECCIONA EL HORARIO PREFERIDO PARA TU ENTREVISTA VIRTUAL. EL SISTEMA ASIGNARÁ AUTOMÁTICAMENTE AL RECLUTADOR DISPONIBLE.</p>

              <div className="availability-wrapper" style={{ minHeight: '400px' }}>
                <SlotCalendarV2
                  slots={{
                    slot_1: watch('availability.slot_1'),
                    slot_2: watch('availability.slot_2'),
                    slot_3: watch('availability.slot_3')
                  }}
                  onChange={(slots) => {
                    setValue('availability.slot_1', slots.slot_1, { shouldValidate: true });
                    setValue('availability.slot_2', slots.slot_2, { shouldValidate: true });
                    setValue('availability.slot_3', slots.slot_3, { shouldValidate: true });
                  }}
                  error={(errors.availability?.slot_1 as any)?.message || (errors.availability?.slot_2 as any)?.message || (errors.availability?.slot_3 as any)?.message}
                  occupiedSlots={occupiedSlots}
                />
              </div>
            </div>
          )}

          {/* FASE 05: FINALIZE */}
          {step === 4 && (
            <div className="finalize-container grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="pro-card compact-card">
                <SectionTitle mono="CERTIFICACIÓN" title="FIRMA DIGITAL" />
                <div className="signature-area mb-4">
                  <SignaturePad value={signatureValue} onChange={(v) => setValue("signature_base64", v)} />
                </div>
                <div className="input-group">
                  <label className="mono">NOMBRE COMPLETO</label>
                  <input className="glass-input compact" placeholder="ALEXANDER WOLF" {...register("signer_name", { required: true })} />
                </div>
              </div>

              <div className="pro-card compact-card">
                <SectionTitle mono="EXPEDIENTE" title="DOCUMENTACIÓN" />
                <div className="docs-upload-list grid grid-cols-2 gap-3">
                  {documentTypes.map(doc => (
                    <label key={doc.id} className="file-upload-zone compact" data-active={!!documentFiles[doc.id]}>
                      <input type="file" className="hidden" onChange={(e) => setDocumentFiles(p => ({ ...p, [doc.id]: e.target.files?.[0] || null }))} />
                      <div className="flex-between w-full align-center">
                        <div className="flex align-center gap-2">
                          <Upload size={14} className={documentFiles[doc.id] ? 'color-accent' : 'color-dim'} />
                          <span className="mono" style={{ fontSize: '0.55rem' }}>{formatDocName(doc.name)}</span>
                        </div>
                        {documentFiles[doc.id] && <Check size={10} className="color-accent" />}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="apply-footer mt-16 flex-between align-center">
          <div className="error-messages">
            {stepError && <div className="system-err mono">{stepError}</div>}
            {submitError && <div className="system-err mono">{submitError}</div>}
          </div>
          <div className="actions flex gap-12 ml-auto">
            {step > 0 && (
              <button type="button" onClick={handleBack} className="btn-ghost" style={{ padding: '1rem 2.5rem', fontSize: '0.75rem' }}>
                <ChevronLeft size={14} /> <span className="mono">VOLVER</span>
              </button>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={step === steps.length - 1 ? handleSubmit(onSubmit) : handleNext}
              className="btn-magnetic"
              style={{ padding: '1rem 3rem', fontSize: '0.85rem' }}
            >
              <span className="mono">{step === steps.length - 1 ? (submitting ? "PROCESANDO..." : "FINALIZAR") : "SIGUIENTE FASE"}</span>
              {step < steps.length - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </form>

      {/* Styles (Modular CSS in-file for speed & theme isolation) */}
      <style>{`
        .apply-header h1 { line-height: 1; letter-spacing: -0.05em; }
        .step-indicator-bar { display: flex; gap: 1rem; border-bottom: 1px solid var(--border-dim); padding-bottom: 0.8rem; }
        .step-indicator-item { display: flex; align-items: center; gap: 0.6rem; opacity: 0.3; transition: all 0.4s ease; flex: 1; }
        .step-indicator-item[data-active="true"] { opacity: 1; }
        .step-icon-wrapper { border: 1px solid var(--border-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .step-indicator-item[data-active="true"] .step-icon-wrapper { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 10px var(--accent-glow); }
        .step-helper { display: block; font-weight: 800; color: var(--text-dim); text-transform: uppercase; }
        
        .compact-card { padding: 2rem !important; }
        .section-title-wrapper h2 { font-size: 1.4rem !important; margin-top: 0.2rem; }
        
        .legal-box { background: rgba(255,255,255,0.01); border: 1px solid var(--border-dim); padding: 1.5rem; border-radius: 12px; line-height: 1.6; }
        
        .job-bento-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.2rem; }
        .job-card-item { background: var(--bg-soft); border: 1px solid var(--border-dim); padding: 1.8rem; border-radius: 16px; cursor: pointer; position: relative; transition: all 0.4s var(--ease-expo); overflow: hidden; display: flex; flex-direction: column; }
        .job-card-item:hover { border-color: var(--border-light); transform: translateY(-4px); background: var(--bg-accent); }
        .job-card-item[data-selected="true"] { border-color: var(--accent); background: var(--bg-accent); box-shadow: 0 10px 30px rgba(61, 90, 254, 0.15); }
        .job-tag { font-size: 0.5rem; color: var(--accent); border: 1px solid var(--accent); width: max-content; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 800; background: rgba(61, 90, 254, 0.1); }
        .job-card-meta { margin-top: auto; padding-top: 1.5rem; display: grid; gap: 0.5rem; }
        .meta-row { display: flex; gap: 0.5rem; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; }
        .selected-glow { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, var(--accent-glow) 0%, transparent 60%); opacity: 0.1; pointer-events: none; }
        
        .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; }
        .glass-input.compact { padding: 0.7rem 0 !important; font-size: 0.85rem !important; }
        
        .compact-slot { padding: 0.7rem 1.1rem; gap: 1rem; border-radius: 10px; }
        .slot-number { width: 30px; height: 30px; font-size: 0.65rem; }
        
        .compact-choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.8rem; margin-top: 0.8rem; }
        .compact-choice { border: 1px solid var(--border-dim); padding: 0.6rem 0.8rem; border-radius: 6px; display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.75rem; transition: all 0.3s ease; }
        .compact-choice:has(input:checked) { border-color: var(--accent); background: rgba(61,90,254,0.08); }
        
        .file-upload-zone.compact { padding: 1rem; border-radius: 10px; }
        
        .system-err { color: #ff4d4d; font-size: 0.65rem; background: rgba(255, 77, 77, 0.05); padding: 0.4rem 0.8rem; border-left: 2px solid #ff4d4d; }
        .step-enter { animation: revealIn 0.5s var(--ease-expo) forwards; }
        .step-exit { opacity: 0; transform: translateY(-5px); transition: all 0.3s ease; }
        @keyframes revealIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .hover-glow:hover { transform: translateY(-3px); border-color: rgba(61, 90, 254, 0.4) !important; box-shadow: 0 10px 40px -10px rgba(61, 90, 254, 0.15); background: rgba(255,255,255,0.03) !important; }
        .style-datetime::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; opacity: 0.6; transition: 0.3s; }
        .style-datetime::-webkit-calendar-picker-indicator:hover { opacity: 1; }

        .elite-bg-glow { position: fixed; top: 0; right: 0; width: 400px; height: 400px; background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%); z-index: -1; opacity: 0.2; pointer-events: none; }
        
        .selected-job-detail { border-color: var(--border-light); }
        .detail-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 3rem; }
        .detail-section h4 { letter-spacing: 0.15em; }
        .meta-info-pill { background: rgba(255,255,255,0.03); border: 1px solid var(--border-dim); padding: 0.6rem 1rem; border-radius: 8px; display: inline-block; width: 100%; }
        
        .docs-upload-list { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
        .file-upload-zone.compact { padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px dashed var(--border-dim); width: 100%; }
        .field-err { color: #ff4d4d; font-size: 0.55rem; font-family: 'JetBrains Mono', monospace; font-weight: 800; margin-top: 0.3rem; display: block; letter-spacing: 0.05em; }
        
        .apply-footer {padding-top: 3rem;}
        .actions { margin-left: auto; display: flex; gap: 1rem; align-items: center; }

        .radio-btn.compact { font-size: 0.7rem; border: 1px solid var(--border-dim); padding: 0.4rem 0.8rem; border-radius: var(--radius-pill); cursor: pointer; display: flex; align-items: center; gap: 0.4rem; justify-content: center; width: 100%; }
        .radio-btn.compact:has(input:checked) { border-color: var(--accent); background: rgba(61,90,254,0.1); }

        .cert-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 80px)); gap: 0.8rem; margin-top: 0.8rem; }

        .elite-calendar { border: none !important; font-family: 'JetBrains Mono', monospace; width: 100% !important; background: transparent !important; color: var(--text-main) !important; }
        .elite-calendar .react-calendar__navigation button { color: var(--text-main) !important; min-width: 44px; background: none; font-size: 1.2rem; }
        .elite-calendar .react-calendar__navigation button:enabled:hover { background-color: rgba(255,255,255,0.1) !important; }
        .elite-calendar .react-calendar__month-view__weekdays { text-transform: uppercase; font-size: 0.6rem; color: var(--text-dim); }
        .elite-calendar .react-calendar__month-view__days__day { color: var(--text-main); font-size: 0.85rem; padding: 0.8rem 0; }
        .elite-calendar .react-calendar__month-view__days__day--neighboringMonth { color: var(--text-dim) !important; }
        .elite-calendar .react-calendar__tile:disabled { background-color: transparent !important; color: rgba(255,255,255,0.2) !important; text-decoration: line-through; }
        .elite-calendar .react-calendar__tile:enabled:hover { background-color: var(--accent) !important; color: white !important; border-radius: 8px; }
        .elite-calendar .react-calendar__tile--active { background: var(--accent) !important; color: white !important; border-radius: 8px; }

        .flex { display: flex; }
        .flex-between { display: flex; justify-content: space-between; }
        .flex-center { display: flex; justify-content: center; align-items: center; }
        .align-center { align-items: center; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .gap-6 { gap: 1.5rem; }
        .gap-8 { gap: 2rem; }
        .gap-12 { gap: 1rem; }
      `}</style>
    </section>
  );
}
