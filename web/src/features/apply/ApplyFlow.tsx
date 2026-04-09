import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm, type SubmitHandler } from "react-hook-form";
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
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export default function ApplyFlow() {
  const [step, setStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasScrolledConsent, setHasScrolledConsent] = useState(false);
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
        schedule_preference: "both", can_rotate_shifts: false, fixed_commitment_bool: false, fixed_commitment: "",
        weekend_availability: false, previous_employee: false, previous_employee_reason: "",
        agrees_with_salary: "yes", has_infonavit: false, salary_agreement: false, adjustments_required: false, start_date: "",
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
      signature_base64: null,
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
        "person.colonia", "person.state", "person.phone", "person.email",
        "candidate.education_level", "person.marital_status",
        "application_details.has_experience", "application_details.start_date",
        "application_details.adjustments_required", "application_details.fixed_commitment_bool",
        "application_details.previous_employee", "application_details.has_infonavit",
        "application_details.weekend_availability", "application_details.salary_agreement"
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
      // LAST STEP: FINALIZAR
      handleSubmit(onSubmit)();
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

  const onSubmit: SubmitHandler<ApplyFormValues> = async (values) => {
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
            body { font-family: Arial, sans-serif; padding: 30px; font-size: 10px; color: #000; background: #fff; line-height: 1.2; width: 800px; margin: 0 auto; }
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
        </body>
      </html>
    `;
  };

  const generateApplicationFile = async (values: ApplyFormValues): Promise<File> => {
    const poster = jobPostings.find(j => j.id === values.job_posting_id);
    const html = jobTemplate(values, poster, selectedJobProfile, true);

    // Create hidden rendering div
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "pt", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

      const blob = pdf.output("blob");
      const fileName = `solicitud_empleo_${values.signer_name.replace(/\s+/g, '_')}.pdf`;
      return new File([blob], fileName, { type: "application/pdf" });
    } finally {
      document.body.removeChild(container);
    }
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
    <section className="apply-flow-section container-full" style={{ paddingBottom: '6rem' }}>
      <div className="elite-bg-glow"></div>

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

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={`step-content-container ${isTransitioning ? 'step-exit' : 'step-enter'}`}>
          {step === 0 && <Step01Consent register={register} watch={watch} setValue={setValue} privacyNotice={privacyNotice} signatureValue={signatureValue} onSignatureChange={(v) => setValue("signature_base64", v)} onScrollComplete={() => setHasScrolledConsent(true)} />}
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

      <style>{`
        .apply-header h1 { line-height: 1; letter-spacing: -0.05em; }
        .step-indicator-bar { display: flex; gap: 1rem; border-bottom: 1px solid var(--border-dim); padding-bottom: 0.8rem; }
        .step-indicator-item { display: flex; align-items: center; gap: 0.6rem; opacity: 0.3; transition: opacity 0.4s ease; flex: 1; }
        .step-indicator-item[data-active="true"] { opacity: 1; }
        .step-icon-wrapper { border: 1px solid var(--border-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .step-indicator-item[data-active="true"] .step-icon-wrapper { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 10px var(--accent-glow); }
        .step-helper { display: block; font-weight: 800; color: var(--text-dim); text-transform: uppercase; }
        .compact-card { padding: 2rem !important; }
        .compact-card:hover { transform: none !important; }
        .legal-box { background: rgba(255,255,255,0.01); border: 1px solid var(--border-dim); padding: 1.5rem; border-radius: 12px; line-height: 1.6; }
        .job-bento-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.2rem; }
        .job-card-item { background: var(--bg-soft); border: 1px solid var(--border-dim); padding: 1.8rem; border-radius: 16px; cursor: pointer; position: relative; transition: border-color 0.4s var(--ease-expo), background 0.4s var(--ease-expo), transform 0.4s var(--ease-expo), box-shadow 0.4s var(--ease-expo); overflow: hidden; display: flex; flex-direction: column; }
        .job-card-item:hover { border-color: var(--border-light); transform: translateY(-4px); background: var(--bg-accent); }
        .job-card-item[data-selected="true"] { border-color: var(--accent); background: var(--bg-accent); box-shadow: 0 10px 30px rgba(61, 90, 254, 0.15); }
        .job-tag { font-size: 0.5rem; color: var(--accent); border: 1px solid var(--accent); width: max-content; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 800; background: rgba(61, 90, 254, 0.1); }
        .meta-row { display: flex; gap: 0.5rem; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; }
        .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; }
        .glass-input.compact { padding: 0.7rem 0 !important; font-size: 0.85rem !important; }
        .compact-choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.8rem; margin-top: 0.8rem; }
        .compact-choice { border: 1px solid var(--border-dim); padding: 0.6rem 0.8rem; border-radius: 6px; display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.75rem; transition: border-color 0.3s ease, background 0.3s ease; }
        .compact-choice:has(input:checked) { border-color: var(--accent); background: rgba(61,90,254,0.08); }
        .system-err { color: #ff4d4d; font-size: 0.65rem; background: rgba(255, 77, 77, 0.05); padding: 0.4rem 0.8rem; border-left: 2px solid #ff4d4d; }
        .step-enter { animation: revealIn 0.5s var(--ease-expo) forwards; }
        .step-exit { opacity: 0; transform: translateY(-5px); transition: all 0.3s ease; }
        @keyframes revealIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .elite-bg-glow { position: fixed; top: 0; right: 0; width: 400px; height: 400px; background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%); z-index: -1; opacity: 0.2; pointer-events: none; }
        .detail-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 3rem; }
        .field-err { color: #ff4d4d; font-size: 0.55rem; font-family: 'JetBrains Mono', monospace; font-weight: 800; margin-top: 0.3rem; display: block; letter-spacing: 0.05em; }
        .flex-between { display: flex; justify-content: space-between; }
        .flex-center { display: flex; justify-content: center; align-items: center; }
        .align-center { align-items: center; }
        .radio-btn.compact { font-size: 0.7rem; border: 1px solid var(--border-dim); padding: 0.4rem 0.8rem; border-radius: 50px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; justify-content: center; width: 100%; }
        .radio-btn.compact:has(input:checked) { border-color: var(--accent); background: rgba(61,90,254,0.1); }
        .cert-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 80px)); gap: 0.8rem; margin-top: 0.8rem; }
        
        /* ELITE CALENDAR STYLES (Theme aware) */
        .elite-calendar { 
          width: 100% !important; 
          background: transparent !important; 
          border: none !important; 
          font-family: 'JetBrains Mono', monospace !important; 
        }
        .react-calendar__navigation button { 
          color: var(--text-main) !important; 
          font-size: 1.2rem !important; 
          background: transparent !important; 
          border: none !important;
          min-width: 44px !important;
          border-radius: 8px !important;
          transition: background 0.3s ease !important;
        }
        .react-calendar__navigation span {
          color: var(--text-main) !important;
          font-weight: 800 !important;
        }
        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus {
          background: var(--border-light) !important;
        }
        .react-calendar__navigation button:disabled {
          background: transparent !important;
          opacity: 0.1 !important;
        }
        .react-calendar__month-view__weekdays { text-transform: uppercase; font-size: 0.6rem; color: var(--accent); font-weight: 800; border-bottom: 1px solid var(--border-dim); margin-bottom: 0.5rem; padding-bottom: 0.5rem; }
        .react-calendar__tile { color: var(--text-main) !important; height: 50px !important; border-radius: 8px !important; font-size: 0.8rem !important; }
        .react-calendar__tile:enabled:hover { background: var(--bg-soft) !important; color: var(--accent) !important; }
        .react-calendar__tile--active { background: var(--accent) !important; box-shadow: 0 0 15px var(--accent-glow) !important; color: #fff !important; }
        .react-calendar__tile--now { background: var(--border-dim) !important; }
        .react-calendar__tile:disabled { background: transparent !important; opacity: 0.1 !important; color: var(--text-main) !important; }

        .hour-slot:hover:not(:disabled) {
          border-color: var(--accent) !important;
          background: rgba(61,90,254,0.1) !important;
          transform: translateY(-2px);
        }
        .hour-slot.selected {
          animation: pulse-border 2s infinite;
        }
        @keyframes pulse-border {
          0% { box-shadow: 0 0 0 0px var(--accent-glow); }
          70% { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0px transparent; }
        }

        /* ── MOBILE ── */
        @media (max-width: 768px) {
          /* Padding top para separar del navbar */
          .apply-flow-section { padding-top: 5rem !important; }

          .apply-header { flex-direction: column !important; align-items: flex-start !important; gap: 0.5rem; }
          .step-content { display: none !important; }
          .step-indicator-bar { gap: 0 !important; width: 100%; }
          .step-indicator-item { flex: 1 !important; justify-content: center; min-width: 0; }
          .detail-grid { grid-template-columns: 1fr !important; gap: 1.5rem !important; }
          .detail-side { border-top: 1px solid var(--border-dim); padding-top: 1.5rem; }
          .form-grid-2 { grid-template-columns: 1fr !important; }
          .form-grid-3 { grid-template-columns: 1fr !important; }
          .span-2 { grid-column: span 1 !important; }
          .compact-card { padding: 1rem !important; }
          .apply-footer { flex-direction: column !important; align-items: stretch !important; gap: 1rem; }
          .apply-footer .actions { flex-direction: column !important; width: 100%; gap: 0.75rem !important; }
          .apply-footer .actions button { width: 100%; justify-content: center; }
          .availability-wrapper { min-height: auto !important; }
          .slot-calendar-grid { grid-template-columns: 1fr !important; gap: 1.5rem !important; }
          .react-calendar__tile { height: 42px !important; font-size: 0.7rem !important; }

          /* Firma digital — evitar desbordamiento */
          .consent-signature-grid .signature-section,
          .consent-signature-grid .name-section { width: 100%; min-width: 0; box-sizing: border-box; }
          .signature-container { width: 100% !important; box-sizing: border-box; }

          /* Input nombre completo */
          .consent-signature-grid input[type="text"],
          .consent-signature-grid .glass-input {
            width: 100% !important;
            box-sizing: border-box !important;
            font-size: 1.1rem !important;
          }

          /* Checkbox aviso de privacidad */
          .consent-final-reveal { width: 100% !important; box-sizing: border-box !important; }
          .consent-final-reveal .checkbox {
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 1rem !important;
            gap: 0.75rem !important;
          }
          .consent-final-reveal .checkbox span.outfit-bold { font-size: 0.85rem !important; }
        }

        /* ── Step 4: availability card — neutralize pro-card scroll animation ── */
        .availability-card.pro-card {
          transition: none !important;
          will-change: auto !important;
          animation: none !important;
        }
        .availability-card.pro-card:hover {
          transform: none !important;
        }
      `}</style>
    </section>
  );
}
