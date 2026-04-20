import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Check, ChevronRight, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Modular Imports
import {
  type ApplyFormValues, type JobPosting, type JobProfile, type ScreeningQuestion, type DocumentType, type PrivacyNotice, steps
} from "./types";
import Step01Consent from "./components/Step01Consent";
import Step02Vacancy from "./components/Step02Vacancy";
import Step03Identity from "./components/Step03Identity";
import Step04Availability from "./components/Step04Availability";
import { applyService } from "./services/applyService";
import { pdf } from "@react-pdf/renderer";
import { ApplicationPDF } from "./components/ApplicationPDF";
import "./ApplyFlow.css";

export default function ApplyFlow() {
  const [step, setStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasScrolledConsent, setHasScrolledConsent] = useState(true);
  const [privacyNotice, setPrivacyNotice] = useState<PrivacyNotice | null>(null);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [selectedJobProfile, setSelectedJobProfile] = useState<JobProfile | null>(null);
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
  const [showStep3Confirm, setShowStep3Confirm] = useState(false);

  useEffect(() => {
    if (showStep3Confirm) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [showStep3Confirm]);

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
    mode: 'onChange',
    defaultValues: {
      consent: { accepted: false },
      job_posting_id: "",
      person: {
        first_name: "", last_name: "", email: "", phone: "",
        phone_optional: "", birth_date: "", address_line1: "",
        colonia: "", city: "", state: "", postal_code: "", marital_status: ""
      },
      application_details: {
        desired_salary: "", has_experience: false, years_experience: 0,
        schedule_preference: "", can_rotate_shifts: false, fixed_commitment_bool: false, fixed_commitment: "",
        weekend_availability: false, previous_employee: false, previous_employee_reason: "",
        agrees_with_salary: "", has_infonavit: false, salary_agreement: false, adjustments_required: false, start_date: "",
        health_adjustments: "", comments: ""
      },
      work_history: [
        { company: "", position: "", period_from: "", period_to: "", manager: "", manager_position: "", phone: "", reason_for_leaving: "" },
        { company: "", position: "", period_from: "", period_to: "", manager: "", manager_position: "", phone: "", reason_for_leaving: "" },
      ],
      personal_references: [
        { name: "", occupation: "", phone: "" },
        { name: "", occupation: "", phone: "" },
      ],
      skills: { cashier: false, drinks: false, inventory: false, cleaning: false, others: "" },
      candidate: { education_level: "", has_education_certificate: "" },
      screening_answers: {},
      signature_base64: "",
      signer_name: "",
      availability: { slot_1: "" },
    },
  });

  const selectedJobId = watch("job_posting_id");
  const signatureValue = watch("signature_base64");
  const currentAvailability = watch("availability");

  // --- Data Loading ---
  // Scroll al top al cambiar de paso
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [step]);

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
        setJobPostings(jobsRes.data as JobPosting[] || []);
        setDocumentTypes(docsRes.data as DocumentType[] || []);
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
        } catch (e) { console.error("Error loading occupied slots", e); }
      };
      loadOccupied();
    }
  }, [step]);

  // --- Handlers ---
  const validateStep = async () => {
    setStepError(null);
    if (step === 0) {
      const signerName = getValues("signer_name") || "";
      const nameWords = signerName.trim().split(/\s+/).filter(Boolean).length;
      const isSigned = !!getValues("signature_base64");
      const isAccepted = !!getValues("consent.accepted");

      const missing: string[] = [];
      if (!hasScrolledConsent) missing.push("leer el aviso completo");
      if (!isSigned) missing.push("registrar tu firma digital");
      if (nameWords < 3) missing.push("escribir tu nombre completo");
      if (!isAccepted) missing.push("marcar la casilla de aceptación");

      if (missing.length > 0) {
        setStepError(`Falta: ${missing.join(", ")}.`);
        return false;
      }
      return true;
    }
    if (step === 1) {
      const ok = await trigger("job_posting_id");
      if (!ok) setStepError("Selecciona una vacante para continuar.");
      return ok;
    }
    if (step === 2) {
      // Check skills before trigger() so the error always appears regardless of other field errors
      const skills = getValues("skills");
      const hasSkill = !!(skills?.cashier || skills?.drinks || skills?.inventory || skills?.cleaning || skills?.others?.trim());
      if (!hasSkill) {
        setError("skills" as any, { type: "required", message: "Selecciona al menos una habilidad o describe tus otras habilidades." });
      }

      const isStepValid = await trigger([
        "person.birth_date", "person.address_line1", "person.postal_code",
        "person.colonia", "person.city", "person.state", "person.phone", "person.email",
        "candidate.education_level", "person.marital_status",
        "application_details.has_experience", "application_details.start_date",
        "application_details.adjustments_required", "application_details.fixed_commitment_bool",
        "application_details.previous_employee", "application_details.has_infonavit",
        "application_details.weekend_availability", "application_details.salary_agreement",
        "application_details.schedule_preference", "application_details.agrees_with_salary"
      ]);

      if (!isStepValid || !hasSkill) {
        setStepError("Por favor completa los campos obligatorios marcados en rojo.");
        return false;
      }

      const missingQ = questions.filter(q => q.is_required && !getValues(`screening_answers.${q.id}`));
      if (missingQ.length > 0) {
        missingQ.forEach(q => setError(`screening_answers.${q.id}` as any, { type: "required", message: "Campo obligatorio" }));
        setStepError("Por favor responde todas las preguntas obligatorias.");
        return false;
      }
      return true;
    }
    if (step === 3) {
      const { slot_1 } = getValues("availability");
      if (!slot_1) {
        setStepError("Por favor selecciona un horario para tu encuentro virtual.");
        return false;
      }
      const slotDate = new Date(slot_1);
      const now = new Date();
      const day = slotDate.getDay();
      const hours = slotDate.getHours();

      if (slotDate < now) {
        setError(`availability.slot_1` as any, { type: "manual", message: "La fecha no puede ser en el pasado" });
        return false;
      }
      if (day === 0 || day === 6) {
        setError(`availability.slot_1` as any, { type: "manual", message: "El horario debe ser de Lunes a Viernes" });
        return false;
      }
      if (hours < 9 || hours >= 17) {
        setError(`availability.slot_1` as any, { type: "manual", message: "El horario debe estar entre las 9:00 y las 17:00" });
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = async () => {
    const ok = await validateStep();
    if (!ok) return;

    if (step === steps.length - 1) {
      onSubmit(getValues());
      return;
    }

    if (step === 2) {
      setShowStep3Confirm(true);
      return;
    }

    setIsTransitioning(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setIsTransitioning(false);
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
      if (!values.signature_base64) throw new Error("La firma digital es necesaria para validar tu solicitud.");

      // 1. GENERAR PDF AUTOMÁTICAMENTE
      const docTypeId = documentTypes.find(d => d.name === "solicitud_empleo")?.id;
      const pdfFile = await generateApplicationFile(values);
      const filesToUpload: Record<string, File | null> = {};
      if (docTypeId) {
        filesToUpload[docTypeId] = pdfFile;
      }

      // 2. MICROSERVICES: Call Edge Function Service
      const result = await applyService.submit(values, filesToUpload);
      setSubmitSuccess(result.application_id);

    } catch (e: any) {
      setSubmitError(e.message || "Error al procesar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- HTML Helper ---
  const jobTemplate = (vals: ApplyFormValues, poster: any, profile: any, hideButtons = false) => {
    return `
      <html>
        <head>
          <title>SOLICITUD DE EMPLEO DIGITAL - MEWI</title>
          <style>
            .pdf-wrapper { font-family: Arial, sans-serif; padding: 30px; font-size: 10px; color: #000; background: #fff; line-height: 1.2; width: 800px; margin: 0 auto; box-sizing: border-box; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th, td { border: 1px solid #000; padding: 5px; text-align: left; }
            .header-info { text-align: center; font-weight: bold; font-size: 14px; }
            .section-title { background: #E8E8E8; text-align: center; font-weight: bold; text-transform: uppercase; padding: 5px; border: 1px solid #000; margin-top: 5px; }
            .label { font-weight: bold; text-transform: uppercase; font-size: 7px; color: #444; margin-bottom: 2px; }
            .val { font-size: 10.5px; font-weight: bold; border-bottom: 1px solid #eee; min-height: 14px; }
            .box { height: 11px; width: 11px; border: 1px solid #000; display: inline-block; vertical-align: middle; margin-right: 4px; text-align: center; line-height: 11px; font-size: 9px; }
            .signature-img { height: 65px; display: block; margin: 5px auto; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="pdf-wrapper">
          ${hideButtons ? '' : `
          <div class="no-print" style="margin-bottom: 20px; text-align: right;">
             <button onclick="window.print()" style="padding: 12px 24px; background: #3d5afe; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">GUARDAR COMO PDF / IMPRIMIR</button>
          </div>
          `}
          
          <table>
            <tr>
              <td rowspan="3" width="140" class="header-info" style="font-size: 28px;">MEWI</td>
              <td colspan="2" class="header-info" style="font-size: 16px;">SOLICITUD DE EMPLEO</td>
              <td width="130">Fecha de solicitud:</td>
              <td width="110" class="val">${new Date().toLocaleDateString()}</td>
            </tr>
            <tr>
               <td colspan="2" style="font-size: 8px;"><b>AVISO DE PRIVACIDAD:</b> Consulta el Aviso de Privacidad Integral para Personas Candidatas en Liga, QR, recepción.</td>
               <td>Puesto que solicita:</td>
               <td class="val">${poster?.title || "---"}</td>
            </tr>
            <tr>
               <td colspan="2" style="font-size: 8px;"><b>Derechos ARCO:</b> Correo y WhatsApp.</td>
               ${profile?.salary_range ? `
                 <td>Sueldo mensual ofrecido:</td>
                 <td class="val">${profile.salary_range}</td>
               ` : "<td></td><td></td>"}
            </tr>
          </table>

          <div class="section-title">DATOS PERSONALES</div>
          <table>
            <tr>
              <td colspan="3"><div class="label">Nombre del candidato:</div><div class="val">${vals.signer_name}</div></td>
              <td><div class="label">Fecha de nacimiento:</div><div class="val">${vals.person.birth_date}</div></td>
            </tr>
            <tr>
              <td colspan="3"><div class="label">Calle y número (Residencia):</div><div class="val">${vals.person.address_line1}</div></td>
              <td><div class="label">C.P.</div><div class="val">${vals.person.postal_code}</div></td>
            </tr>
            <tr>
              <td colspan="2"><div class="label">Colonia / Municipio</div><div class="val">${vals.person.colonia}</div></td>
              <td colspan="2"><div class="label">Estado</div><div class="val">${vals.person.state}</div></td>
            </tr>
            <tr>
              <td><div class="label">Teléfono</div><div class="val">${vals.person.phone}</div></td>
              <td><div class="label">Tel. Opcional</div><div class="val">${vals.person.phone_optional || "---"}</div></td>
              <td><div class="label">Email</div><div class="val">${vals.person.email}</div></td>
              <td><div class="label">Escolaridad</div><div class="val">${vals.candidate.education_level.toUpperCase()}</div></td>
            </tr>
            <tr>
              <td colspan="4">
                <div class="label">Estado Civil:</div>
                <span class="box">${vals.person.marital_status === "soltero" ? "X" : ""}</span> Soltero/a | 
                <span class="box">${vals.person.marital_status === "casado" ? "X" : ""}</span> Casado/a | 
                <span class="box">${vals.person.marital_status === "union_libre" ? "X" : ""}</span> Unión Libre | 
                <span class="box">${vals.person.marital_status === "divorciado" ? "X" : ""}</span> Divorciado/a | 
                <span class="box">${vals.person.marital_status === "viudo" ? "X" : ""}</span> Viudo/a | 
                <span class="box">${vals.person.marital_status === "prefiero_no_decir" ? "X" : ""}</span> Prefiero no decir
              </td>
            </tr>
          </table>

          <div class="section-title">DATOS DEL EMPLEO & DISPONIBILIDAD</div>
          <table>
             <tr>
                <td>Exp Vacante: <span class="box">${(vals.application_details.has_experience as any) === true || (vals.application_details.has_experience as any) === "true" ? "X" : ""}</span> SÍ / <span class="box">${(vals.application_details.has_experience as any) === false || (vals.application_details.has_experience as any) === "false" ? "X" : ""}</span> NO</td>
                <td>Años Exp: <b>${vals.application_details.years_experience || 0}</b></td>
                <td>Turno: <b>${vals.application_details.schedule_preference === "morning" ? "MATUTINO (AM)" :
        vals.application_details.schedule_preference === "afternoon" ? "VESPERTINO (PM)" :
          vals.application_details.schedule_preference === "rotative" ? "ROLA TURNOS" :
            "AMBOS / SIN PREFERENCIA"
      }</b></td>
                <td>Fines de semana: <span class="box">${(vals.application_details.weekend_availability as any) === true || (vals.application_details.weekend_availability as any) === "true" ? "X" : ""}</span> SÍ / <span class="box">${(vals.application_details.weekend_availability as any) === false || (vals.application_details.weekend_availability as any) === "false" ? "X" : ""}</span> NO</td>
             </tr>
             <tr>
                <td colspan="4">Compromiso fijo (Escuela/Otro): <span class="box">${(vals.application_details.fixed_commitment_bool as any) === true || (vals.application_details.fixed_commitment_bool as any) === "true" ? "X" : ""}</span> SÍ / <span class="box">${(vals.application_details.fixed_commitment_bool as any) === false || (vals.application_details.fixed_commitment_bool as any) === "false" ? "X" : ""}</span> NO. 
                  ${((vals.application_details.fixed_commitment_bool as any) === true || (vals.application_details.fixed_commitment_bool as any) === "true") ? `<b>¿Cuál?:</b> ${vals.application_details.fixed_commitment || "---"}` : ""}
                </td>
             </tr>
          </table>

          <div class="section-title">REFERENCIA LABORAL (ÚLTIMOS 2 EMPLEOS)</div>
          <table>
             <tr>
               <th width="120px">Empresa/Puesto</th>
               <th>Periodo (Del/Al)</th>
               <th>Jefe (Nombre/Puesto)</th>
               <th width="90px">Teléfono</th>
               <th>Motivo Separación</th>
             </tr>
             ${vals.work_history.filter(w => w.company).map(w => `
                <tr>
                   <td><b>${w.company}</b><br/>${w.position}</td>
                   <td>Inicio: ${w.period_from}<br/>Fin: ${w.period_to}</td>
                   <td><b>${w.manager}</b><br/>${w.manager_position}</td>
                   <td>${w.phone}</td>
                   <td>${w.reason_for_leaving}</td>
                </tr>
             `).join("") || "<tr><td colspan='5' style='text-align:center;'>SIN EXPERIENCIA REPORTADA</td></tr>"}
          </table>

          <div class="section-title">REFERENCIAS PERSONALES</div>
          <table>
             <tr><th width="200px">Nombre</th><th>Ocupación</th><th>Teléfono</th></tr>
             ${vals.personal_references.filter(r => r.name).map(r => `
                <tr><td>${r.name}</td><td>${r.occupation}</td><td>${r.phone}</td></tr>
             `).join("") || "<tr><td colspan='3' style='text-align:center;'>N/A</td></tr>"}
          </table>

          <div class="section-title">DATOS GENERALES & CONOCIMIENTOS</div>
          <table>
             <tr>
                <td colspan="2">De acuerdo con sueldo: <b>${vals.application_details.agrees_with_salary === "yes" ? "SÍ" : vals.application_details.agrees_with_salary === "no" ? "NO" : "NEGOCIABLE"}</b></td>
                <td colspan="2">Crédito Infonavit: <span class="box">${(vals.application_details.has_infonavit as any) === true || (vals.application_details.has_infonavit as any) === "true" ? "X" : ""}</span> SÍ / <span class="box">${(vals.application_details.has_infonavit as any) === false || (vals.application_details.has_infonavit as any) === "false" ? "X" : ""}</span> NO</td>
             </tr>
             <tr>
                <td colspan="4">¿Trabajó antes con nosotros?: <span class="box">${(vals.application_details.previous_employee as any) === true || (vals.application_details.previous_employee as any) === "true" ? "X" : ""}</span> SÍ / <span class="box">${(vals.application_details.previous_employee as any) === false || (vals.application_details.previous_employee as any) === "false" ? "X" : ""}</span> NO. 
                  ${((vals.application_details.previous_employee as any) === true || (vals.application_details.previous_employee as any) === "true") ? `<b>Motivo del retiro:</b> ${vals.application_details.previous_employee_reason || "---"}` : ""}
                </td>
             </tr>
             <tr>
                <td>Caja: <span class="box">${vals.skills.cashier ? "X" : ""}</span></td>
                <td>Bebidas: <span class="box">${vals.skills.drinks ? "X" : ""}</span></td>
                <td>Inventario: <span class="box">${vals.skills.inventory ? "X" : ""}</span></td>
                <td>Limpieza: <span class="box">${vals.skills.cleaning ? "X" : ""}</span> | Otros: ${vals.skills.others || "---"}</td>
             </tr>
          </table>

          <div class="section-title">SALUD & SEGURIDAD</div>
          <table>
             <tr>
                <td colspan="2">Ajustes razonables sugeridos: <b>${vals.application_details.health_adjustments || "NINGUNO"}</b></td>
                <td width="200">Fecha contratación: <b>${vals.application_details.start_date}</b></td>
             </tr>
          </table>

          <div style="border: 1px solid #000; padding: 5px; margin-top: 5px;">
             <b>COMENTARIOS ADICIONALES:</b><br/>
             <div style="min-height: 30px;">${vals.application_details.comments || "SIN COMENTARIOS"}</div>
          </div>
          
          <div style="margin-top: 60px; text-align: center;">
             <div style="display:inline-block; border-top: 1px solid black; padding-top: 10px; width: 440px; position: relative;">
                ${vals.signature_base64 ? `<img src="${vals.signature_base64}" class="signature-img" style="position: absolute; top: -55px; left: 50%; transform: translateX(-50%); height: 75px;" />` : "<br/><br/><br/>"}
                <div class="val" style="border:none; text-transform: uppercase; font-size: 13px; margin-top: 5px;">${vals.signer_name}</div>
                <div class="label" style="font-size: 8px;">Nombre y firma del solicitante</div>
              </div>
          </div>
          <div style="font-size: 7.5px; color: #444; text-align: center; margin-top: 15px; font-style: italic;">
             Hago constar que mis respuestas son verdaderas y autorizo la verificación de mis datos.
          </div>
          </div>
        </body>
      </html>
    `;
  };

  const generateApplicationFile = async (values: ApplyFormValues): Promise<File> => {
    const poster = jobPostings.find(j => j.id === values.job_posting_id);
    const blob = await pdf(
      <ApplicationPDF values={values} jobPosting={poster} jobProfile={selectedJobProfile} />
    ).toBlob();
    const fileName = `solicitud_empleo_${values.signer_name.replace(/\s+/g, '_')}.pdf`;
    return new File([blob], fileName, { type: "application/pdf" });
  };

  // --- Document Generation (PDF/Print Preview) ---
  (window as any).previewJobApplication = () => {
    const vals = getValues();
    const poster = jobPostings.find(j => j.id === vals.job_posting_id);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(jobTemplate(vals, poster, selectedJobProfile));
    win.document.close();
  };

  // --- Render Logic ---
  if (loading) return null;


  return (
    <>
    <section className={`apply-flow-section container-full`} style={{ paddingBottom: '6rem' }}>
      <div className="elite-bg-glow"></div>

      {submitSuccess ? (
        <div className="success-reveal" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' }}>
          <div className="pro-card shadow-accent" style={{ textAlign: 'center', maxWidth: '700px' }}>
            <div className="success-icon-badge mb-6">
              <Check size={40} className="color-accent" />
            </div>
            <span className="mono mb-2">// SISTEMA ELITE</span>
            <h1 className="outfit-black mb-2 success-title">POSTULACIÓN REGISTRADA.</h1>
            <p className="mono color-accent mb-8" style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>Pronto nos pondremos en contacto contigo a través del correo que dejaste registrado. Mientras tanto, ¡relájate!</p>
            <p className="mono color-dim mb-10">ID TRANSACCIÓN: <span className="color-accent">{submitSuccess}</span></p>
            <div className="flex-center gap-4">
              <Link to="/" className="btn-ghost" style={{ padding: '1.2rem 2.5rem' }}>VOLVER AL INICIO</Link>
              <Link to={`/track?id=${submitSuccess}`} className="btn-magnetic" style={{ padding: '1rem 2rem' }}>RASTREAR ESTADO</Link>
            </div>
          </div>
        </div>
      ) : (
        <>

          <div className="apply-header mb-8 flex-between align-end">
            <div>
              <span className="mono color-accent" style={{ fontSize: '0.55rem' }}>// ADQUISICIÓN DE TALENTO</span>
              <h1 className="outfit-black" style={{ fontSize: '2.5rem', marginTop: '0.2rem' }}>ÚNETE AL EQUIPO.</h1>
            </div>
            <div className="step-count mono" style={{ fontSize: '0.65rem' }}>
              PASO <span className="color-accent">{step + 1}</span> / {steps.length}
            </div>
          </div>

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

          <form onSubmit={handleSubmit(onSubmit as any)}>
            <div 
              key={step} 
              className={`step-content-container ${isTransitioning ? 'step-exit' : 'step-enter'}`}
              style={{ minHeight: (step === 3 && !submitSuccess) ? '600px' : 'auto' }}
            >
              {step === 0 && <Step01Consent register={register} watch={watch} setValue={setValue} privacyNotice={privacyNotice} signatureValue={signatureValue} onSignatureChange={(v) => setValue("signature_base64", v)} onScrollComplete={() => setHasScrolledConsent(true)} hasScrolledToBottomProp={hasScrolledConsent} />}
              {step === 1 && <Step02Vacancy register={register} setValue={setValue} selectedJobId={selectedJobId} jobPostings={jobPostings} selectedJobProfile={selectedJobProfile} />}
              {step === 2 && <Step03Identity register={register} watch={watch} setValue={setValue} errors={errors} questions={questions} />}
              {step === 3 && <Step04Availability slots={currentAvailability} onChange={(slots) => setValue("availability", slots, { shouldValidate: true })} errors={errors} occupiedSlots={occupiedSlots} />}
            </div>

            <div className="apply-footer flex-between align-center" style={{ marginTop: '1.5rem' }}>
              <div className="error-messages">
                {stepError && <div className="system-err mono">{stepError}</div>}
                {submitError && <div className="system-err mono">{submitError}</div>}
              </div>
              <div className="actions ml-auto" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                {step > 0 && (
                  <button type="button" onClick={handleBack} className="btn-ghost" style={{ padding: '1rem 2.5rem', fontSize: '0.75rem' }}>
                    <ChevronLeft size={14} /> <span className="mono">VOLVER</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleNext}
                  className="btn-magnetic"
                  style={{ padding: '1rem 3rem', fontSize: '0.85rem' }}
                >
                  <span className="mono">{step === steps.length - 1 ? (submitting ? "PROCESANDO..." : "FINALIZAR") : "SIGUIENTE FASE"}</span>
                  {step < steps.length - 1 && <ChevronRight size={14} />}
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </section>

      {showStep3Confirm && createPortal(
        <div style={{
          position: 'fixed',
          top: '-100px', left: 0, right: 0, bottom: '-100px',
          zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem',
          paddingTop: 'calc(1.5rem + 100px)',
          paddingBottom: 'calc(1.5rem + 100px)',
        }}>
          {/* Capa blur */}
          <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
          {/* Capa negra */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div className="pro-card animate-fade" style={{ maxWidth: '480px', width: '100%', padding: '2.5rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <span className="mono color-accent" style={{ fontSize: '0.55rem' }}>// CONFIRMACIÓN</span>
            <p className="outfit-bold" style={{ fontSize: '1rem', margin: '1.2rem 0 1.5rem', lineHeight: 1.6 }}>
              Hago constar que todas mis respuestas son verdaderas y autorizo la verificación de mis datos.
            </p>
            {signatureValue && (
              <div style={{
                border: '1px solid var(--border-dim)', borderRadius: '8px',
                padding: '0.75rem', marginBottom: '1.8rem', background: 'rgba(255,255,255,0.03)',
              }}>
                <img src={signatureValue} alt="Tu firma" style={{ maxHeight: '80px', maxWidth: '100%', display: 'block', margin: '0 auto' }} />
                <span className="mono color-dim" style={{ fontSize: '0.55rem', display: 'block', marginTop: '0.4rem' }}>{getValues("signer_name")}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '0.9rem 2.5rem', fontSize: '0.8rem' }}
                onClick={() => setShowStep3Confirm(false)}
              >
                <span className="mono">NO</span>
              </button>
              <button
                type="button"
                className="btn-magnetic"
                style={{ padding: '0.9rem 2.5rem', fontSize: '0.8rem' }}
                onClick={() => {
                  setShowStep3Confirm(false);
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setStep(s => s + 1);
                    setIsTransitioning(false);
                  }, 400);
                }}
              >
                <span className="mono">SÍ</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
