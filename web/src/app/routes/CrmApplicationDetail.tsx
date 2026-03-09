import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import { formatDateTime } from "@/lib/format";
import { functionsBaseUrl, supabase } from "@/lib/supabaseClient";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useAppToast } from "@/app/layouts/CrmLayout";
import {
  Calendar,
  FileText,
  MessageSquare,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  Video,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  Trash2,
  Clock,
  Briefcase,
  GraduationCap,
  ShieldCheck,
  History,
  Plus,
  ExternalLink
} from "lucide-react";

interface ApplicationRow {
  id: string;
  status_key: string;
  status_reason: string | null;
  submitted_at: string;
  updated_at: string;
  assigned_to: string | null;
  traffic_light: "red" | "yellow" | "green" | null;
  suggested_slot_1: string | null;
  suggested_slot_2: string | null;
  suggested_slot_3: string | null;
  meet_link: string | null;
  recruit_job_postings: {
    id: string;
    title: string;
    branch: string | null;
    area: string | null;
    employment_type: string | null;
  } | null;
  recruit_candidates: {
    id: string;
    education_level: string | null;
    has_education_certificate: boolean | null;
    recruit_persons: {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      address_line1: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
    } | null;
  } | null;
  profiles: { full_name: string | null } | null;
}

interface StatusRow {
  status_key: string;
  label: string;
  requires_reason: boolean;
}

interface StatusTransitionRow {
  from_status_key: string;
  to_status_key: string;
}

interface NoteRow {
  id: string;
  note: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

interface DocumentRow {
  id: string;
  storage_path: string;
  validation_status: "pending" | "under_review" | "validated" | "rejected";
  validation_notes: string | null;
  uploaded_at: string;
  validated_at: string | null;
  recruit_document_types: {
    id: string;
    name: string;
    stage: string;
    is_required: boolean;
  } | null;
}

interface InterviewRow {
  id: string;
  interview_type: "phone" | "in_person";
  scheduled_at: string | null;
  location: string | null;
  result: "pending" | "pass" | "fail" | "no_show" | "reschedule";
  notes: string | null;
  profiles: { full_name: string | null } | null;
}

interface RehireFlagRow {
  id: string;
  color: "red" | "yellow" | "green";
  reason: string;
  set_at: string;
  profiles: { full_name: string | null } | null;
}



interface StatusHistoryRow {
  id: string;
  status_key: string;
  reason: string | null;
  notes: string | null;
  changed_at: string;
  profiles: { full_name: string | null } | null;
}



const ensureSingle = <T,>(val: T | T[]): T | null => {
  if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
  return val;
};

export default function CrmApplicationDetail() {
  const { id } = useParams();
  const { session, profile } = useAuth();
  const user = session?.user;
  const { toast } = useAppToast();
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [transitions, setTransitions] = useState<StatusTransitionRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [rehireFlags, setRehireFlags] = useState<RehireFlagRow[]>([]);
  const [scheduling, setScheduling] = useState(false);

  // Reference for application documents container
  const [statusHistory, setStatusHistory] = useState<StatusHistoryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nextStatus, setNextStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [slot1, setSlot1] = useState("");

  const [noteText, setNoteText] = useState("");

  const [interviewForm, setInterviewForm] = useState({
    interview_type: "phone",
    scheduled_at: "",
    location: "",
    interviewer_id: "",
    result: "pending",
    notes: "",
  });
  const [interviewError, setInterviewError] = useState<string | null>(null);



  // Document preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  const [activeTab, setActiveTab] = useState<'profile' | 'interviews' | 'notes' | 'documents'>('profile');

  const ALL_TABS = useMemo(() => [
    { id: 'profile', label: 'EXPEDIENTE', icon: <User size={16} /> },
    { id: 'interviews', label: 'ENTREVISTAS', icon: <Calendar size={16} /> },
    { id: 'notes', label: 'BITÁCORA', icon: <MessageSquare size={16} /> },
    { id: 'documents', label: 'DOCUMENTACIÓN', icon: <FileText size={16} /> }
  ], []);

  const stageConfig = useMemo(() => {
    if (!application) return { tabs: ALL_TABS, focus: 'GENERAL', nextStepText: 'CARGANDO...', docsValidated: false };
    const s = application.status_key;

    // Verificar si todos los documentos cargados están VALIDADOS
    const docsValidated = documents.length > 0 && documents.every(d => d.validation_status === 'validated');

    let tabs = ['profile', 'notes'];
    let focus = 'REVISIÓN GENERAL';
    let nextStepText = 'REVISAR INFORMACIÓN';

    if (s === 'new' || s === 'validation') {
      tabs = ['profile', 'documents', 'notes'];
      nextStepText = docsValidated ? 'DOCUMENTOS VALIDADOS' : 'VALIDAR DOCUMENTOS DEL POSTULANTE';
    } else if (s === 'interview_scheduled') {
      tabs = ['profile', 'interviews', 'notes'];
      focus = 'GESTIÓN DE ENTREVISTAS';
      nextStepText = 'EVALUAR RESULTADO DE ENTREVISTA';
    } else if (s === 'onboarding') {
      tabs = ['profile', 'documents', 'notes']; // Show docs again for onboarding paperwork
      focus = 'PAPELEO DE INGRESO';
      nextStepText = 'CANDIDATO EN PROCESO DE INGRESO';
    } else if (s === 'rejected') {
      tabs = ['profile', 'notes'];
      focus = 'HISTORIAL';
      nextStepText = 'CANDIDATO RECHAZADO';
    } else {
      tabs = ['profile', 'interviews', 'notes', 'documents'];
    }

    return {
      tabs: ALL_TABS.filter(t => tabs.includes(t.id)),
      focus,
      nextStepText,
      docsValidated
    };
  }, [application, ALL_TABS, documents]);

  const activeInterview = useMemo(() => {
    return interviews.find(i => i.result === 'pending') || interviews[0];
  }, [interviews]);

  const isInterviewPassed = useMemo(() => {
    if (!activeInterview?.scheduled_at) return true;
    return new Date().getTime() > new Date(activeInterview.scheduled_at).getTime();
  }, [activeInterview]);

  const isMeetJoinable = useMemo(() => {
    if (!activeInterview?.scheduled_at) return false;
    // Se habilita 30 minutos antes de la cita
    return new Date().getTime() >= (new Date(activeInterview.scheduled_at).getTime() - (30 * 60 * 1000));
  }, [activeInterview]);

  useEffect(() => {
    if (stageConfig && !stageConfig.tabs.find(t => t.id === activeTab)) {
      setActiveTab('profile');
    }
  }, [stageConfig, activeTab]);

  const statusMap = useMemo(() => {
    return statuses.reduce<Record<string, StatusRow>>((acc, status) => {
      acc[status.status_key] = status;
      return acc;
    }, {});
  }, [statuses]);

  const allowedTransitions = useMemo(() => {
    if (!application) return [];
    let baseTransitions = transitions
      .filter((transition) => transition.from_status_key === application.status_key)
      .map((transition) => transition.to_status_key);

    // RESTRICT: Solo permitir avanzar si el folder está validado
    if ((application.status_key === 'new' || application.status_key === 'validation') && !stageConfig.docsValidated) {
      baseTransitions = baseTransitions.filter(st => st !== 'interview_scheduled');
    }

    return baseTransitions;
  }, [application, transitions, stageConfig.docsValidated]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const applicationRes = await supabase
      .from("recruit_applications")
      .select(
        "id, status_key, status_reason, submitted_at, updated_at, assigned_to, traffic_light, suggested_slot_1, suggested_slot_2, suggested_slot_3, meet_link, recruit_job_postings(id, title, branch, area, employment_type), recruit_candidates(id, education_level, has_education_certificate, recruit_persons(id, first_name, last_name, email, phone, address_line1, city, state, postal_code)), profiles:assigned_to(full_name)",
      )
      .eq("id", id)
      .single();

    if (applicationRes.error || !applicationRes.data) {
      setError(applicationRes.error?.message ?? "No se pudo cargar la solicitud.");
      setLoading(false);
      return;
    }

    const rawData = applicationRes.data as any;
    const appData: ApplicationRow = {
      ...rawData,
      recruit_job_postings: ensureSingle(rawData.recruit_job_postings),
      recruit_candidates: ensureSingle(rawData.recruit_candidates),
      profiles: ensureSingle(rawData.profiles),
    };

    if (appData.recruit_candidates) {
      appData.recruit_candidates.recruit_persons = ensureSingle((rawData.recruit_candidates as any)?.recruit_persons);
    }

    setApplication(appData);
    setSlot1(appData.suggested_slot_1 ?? "");
    setRehireFlags([]);

    const personId = appData.recruit_candidates?.recruit_persons?.id ?? null;

    const requests: any[] = [
      supabase
        .from("recruit_statuses")
        .select("status_key, label, requires_reason")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("recruit_status_transitions")
        .select("from_status_key, to_status_key")
        .eq("is_active", true),
      supabase
        .from("recruit_notes")
        .select("id, note, created_at, profiles:created_by(full_name)")
        .eq("application_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("recruit_application_documents")
        .select(
          "id, storage_path, validation_status, validation_notes, uploaded_at, validated_at, recruit_document_types(id, name, stage, is_required)",
        )
        .eq("application_id", id)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("recruit_interviews")
        .select(
          "id, interview_type, scheduled_at, location, result, notes, profiles:interviewer_id(full_name)",
        )
        .eq("application_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("recruit_application_status_history")
        .select("id, status_key, reason, notes, changed_at, profiles:changed_by(full_name)")
        .eq("application_id", id)
        .order("changed_at", { ascending: false }),
    ];

    if (personId) {
      requests.push(
        supabase
          .from("recruit_rehire_flags")
          .select("id, color, reason, set_at, profiles:set_by(full_name)")
          .eq("person_id", personId)
          .order("set_at", { ascending: false }),
      );
    }

    const results: any[] = await Promise.all(requests);

    const [statusRes, transitionRes, noteRes, docRes, interviewRes, historyRes] = results;

    if (statusRes?.error) setError(statusRes.error.message);
    if (transitionRes?.error) setError(transitionRes.error.message);
    if (noteRes?.error) setError(noteRes.error.message);
    if (docRes?.error) setError(docRes.error.message);
    if (interviewRes?.error) setError(interviewRes.error.message);
    if (historyRes?.error) setError(historyRes.error.message);

    setStatuses((statusRes?.data as any) ?? []);
    setTransitions((transitionRes?.data as any) ?? []);
    setNotes((noteRes?.data as any) ?? []);
    setDocuments((docRes?.data as any) ?? []);
    setInterviews((interviewRes?.data as any) ?? []);
    setStatusHistory((historyRes?.data as any) ?? []);

    let offset = 6;
    if (personId) {
      const rehireRes = results[offset];
      if (rehireRes?.error) setError(rehireRes.error.message);
      setRehireFlags((rehireRes?.data as any) ?? []);
      offset += 1;
    }

    offset = offset; // placeholder to keep logic flow




    setLoading(false);
  }, [id, profile?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (nextStatus) return;
    if (!application) return;
    if (allowedTransitions.length === 0) return;
    setNextStatus(allowedTransitions[0]);
  }, [application, allowedTransitions, nextStatus]);

  const validateSlotAvailability = async (dateTimeStr: string) => {
    if (!dateTimeStr) return true;
    const date = new Date(dateTimeStr);
    const now = new Date();
    const plus2Weeks = new Date();
    plus2Weeks.setDate(now.getDate() + 14);

    // 1. Rango de horario (09 AM - 5 PM)
    // Usamos el string literal para la hora para evitar desfases de zona horaria en la validación
    let hour: number;
    if (dateTimeStr.includes('T')) {
      const timePart = dateTimeStr.split('T')[1];
      hour = parseInt(timePart.split(':')[0], 10);
    } else {
      hour = date.getHours();
    }

    if (hour < 9 || hour > 17) {
      throw new Error("El horario debe ser entre las 09:00 AM y las 05:00 PM.");
    }

    // 2. Rango de fecha (Hoy a +2 semanas)
    if (date < now) {
      throw new Error("No se pueden agendar fechas en el pasado.");
    }
    if (date > plus2Weeks) {
      throw new Error("No se pueden agendar propuestas con más de 2 semanas de anticipación.");
    }

    // 3. Disponibilidad del reclutador (Sin traslapes)
    const startTime = date.toISOString();
    const endTime = new Date(date.getTime() + 60 * 60 * 1000).toISOString(); // 1 hora de duración estimada

    const { data: conflicts, error } = await supabase
      .from("recruit_interviews")
      .select("id")
      .eq("interviewer_id", application?.assigned_to)
      .filter("scheduled_at", "gte", startTime)
      .filter("scheduled_at", "lt", endTime);

    if (error) throw error;
    if (conflicts && conflicts.length > 0) {
      throw new Error(`El reclutador ya tiene una entrevista agendada el ${date.toLocaleDateString()} a esa hora.`);
    }

    return true;
  };

  const triggerStatusChange = async (newStatus: string, reason?: string, note?: string) => {
    const updateData: any = {
      status_key: newStatus,
      status_reason: reason || null
    };

    if (newStatus === 'interview_scheduled') {
      if (!slot1) throw new Error("Debes elegir el horario definitivo de la entrevista.");

      await validateSlotAvailability(slot1);

      const { data: funcData, error: funcError } = await supabase.functions.invoke('schedule_interview', {
        body: {
          application_id: id,
          scheduled_at: slot1,
          interviewer_id: user?.id,
        }
      });

      if (funcError) {
        console.error("❌ Edge Function Error:", funcError);
        let detail = funcError.message;
        try {
          const body = await (funcError as any).response?.json();
          if (body?.error) detail = body.error;
        } catch (e) { }
        throw new Error(`Error de Servidor: ${detail}`);
      }

      if (funcData?.error) throw new Error(funcData.error);

      updateData.suggested_slot_1 = new Date(slot1).toISOString();
      updateData.suggested_slot_2 = null;
      updateData.suggested_slot_3 = null;
    }

    const { error: updateError } = await supabase
      .from("recruit_applications")
      .update(updateData)
      .eq("id", id);

    if (updateError) throw updateError;

    if (note?.trim()) {
      await supabase.from("recruit_notes").insert({ application_id: id, note: note.trim() });
    }

    const { data: transition } = await supabase
      .from("recruit_status_transitions")
      .select("template_key")
      .eq("from_status_key", application?.status_key)
      .eq("to_status_key", newStatus)
      .eq("is_active", true)
      .maybeSingle();

    if (transition?.template_key) {
      const { data: template } = await supabase
        .from("recruit_message_templates")
        .select("id")
        .eq("template_key", transition.template_key)
        .single();

      if (template) {
        await supabase.from("recruit_message_logs").insert({
          application_id: id,
          template_id: template.id,
          status: 'queued',
          channel: 'email',
          to_address: application?.recruit_candidates?.recruit_persons?.email
        });
        return { ok: true, template_key: transition.template_key };
      }
    }
    return { ok: true };
  };

  const handleStatusChange = async (event: FormEvent) => {
    event.preventDefault();
    setStatusError(null);

    if (!nextStatus) {
      setStatusError("Selecciona un estatus válido.");
      return;
    }

    const requiresReason = statusMap[nextStatus]?.requires_reason;
    if (requiresReason && statusReason.trim().length === 0) {
      setStatusError("El motivo es obligatorio para este estatus.");
      return;
    }

    setStatusSubmitting(true);
    setStatusError(null);
    try {
      const result = await triggerStatusChange(nextStatus, statusReason.trim(), statusNote.trim());
      if (result.template_key) {
        toast.info(`Estatus actualizado. Correo "${result.template_key}" en cola.`);
      } else {
        toast.success("Estatus actualizado con éxito.");
      }
      setStatusReason("");
      setStatusNote("");
      // Reset slots after success
      setSlot1("");
      await loadData();
    } catch (err: any) {
      console.error("Transition Error:", err);
      setStatusError(err.message);
    }
    setStatusSubmitting(false);
  };

  // --- GENERADOR DE HORARIOS DISPONIBLES ---
  const availableSlots = useMemo(() => {
    if (nextStatus !== 'interview_scheduled') return [];

    // Priorizar las sugerencias del candidato
    const suggestions = [
      application?.suggested_slot_1,
      application?.suggested_slot_2,
      application?.suggested_slot_3
    ].filter(Boolean) as string[];

    if (suggestions.length > 0) {
      // Devolvemos los strings tal cual para evitar que el constructor de Date los altere al pasarlos por useMemo
      return suggestions.sort();
    }

    const slots: Date[] = [];
    const now = new Date();

    // Generar para los próximos 14 días (Fallback si no hay sugerencias)
    for (let d = 0; d < 14; d++) {
      const day = new Date();
      day.setDate(now.getDate() + d);

      // Saltar fines de semana (0=Dom, 6=Sab)
      const dayOfWeek = day.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // De 09:00 a 17:00
      for (let h = 9; h <= 17; h++) {
        const slotDate = new Date(day);
        slotDate.setHours(h, 0, 0, 0);

        // No mostrar horas que ya pasaron hoy
        if (slotDate <= now) continue;

        // Verificar traslapes con entrevistas existentes
        const isBusy = interviews.some(i => {
          if (!i.scheduled_at) return false;
          const interviewStart = new Date(i.scheduled_at);
          const interviewEnd = new Date(interviewStart.getTime() + 60 * 60 * 1000);
          return slotDate >= interviewStart && slotDate < interviewEnd;
        });

        if (!isBusy) {
          slots.push(slotDate);
        }
      }
    }
    return slots;
  }, [nextStatus, interviews, application]);

  const handleAddNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!noteText.trim()) return;


    const { error: insertError } = await supabase
      .from("recruit_notes")
      .insert({ application_id: id, note: noteText.trim() });

    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    setNoteText("");
    await loadData();
  };

  const updateDocStatus = async (docId: string, status: "validated" | "rejected" | "under_review" | "pending") => {
    const { error: updateError } = await supabase
      .from("recruit_application_documents")
      .update({
        validation_status: status,
        validated_at: status === "pending" || status === "under_review" ? null : new Date().toISOString(),
      })
      .eq("id", docId);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    await loadData();
    toast.success(`Documento ${status === 'validated' ? 'validado' : (status === 'rejected' ? 'rechazado' : 'actualizado')}`);
  };

  const validateFullExpediente = async () => {
    if (!documents || documents.length === 0) {
      toast.error("No hay documentos para validar.");
      return;
    }

    const allValidated = documents.every(d => d.validation_status === 'validated');
    if (!allValidated) {
      toast.error("Aún hay documentos sin validar. Revisa todos los archivos.");
      return;
    }

    // Auto-advance safely respecting the DB status chain
    let targetStates: string[] = ['interview_scheduled'];

    let success = true;
    for (const state of targetStates) {
      const { error: invokeError } = await supabase.functions.invoke("change_status", {
        body: {
          application_id: id,
          status_key: state,
          reason: "Expediente validado por el reclutador.",
        },
      });
      if (invokeError) {
        console.error(`Edge Function Error [${state}]:`, invokeError);
        toast.error(`Error al avanzar a la fase ${state}: ${invokeError.message}`);
        success = false;
        break;
      }
    }

    if (success) {
      toast.success("Expediente Validado de forma exitosa. Transición completada.");
      loadData();
    }
  };

  const handleDownload = async (doc: DocumentRow) => {
    try {
      const { data, error: downloadError } = await supabase.storage.from('recruit-docs').createSignedUrl(doc.storage_path, 300);
      if (downloadError) throw downloadError;
      setPreviewUrl(data.signedUrl);
      setPreviewName(doc.recruit_document_types?.name ?? "Documento");
    } catch (err: any) {
      toast.error(err.message);
    }
    // Update status to under_review if pending so candidate can't modify it anymore
    if (doc.validation_status === 'pending') {
      const { error: updateError } = await supabase
        .from("recruit_application_documents")
        .update({ validation_status: 'under_review' })
        .eq("id", doc.id);

      if (!updateError) {
        await loadData();
      }
    }
  };

  const handleInterviewSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setInterviewError(null);

    const scheduledAt = interviewForm.scheduled_at;
    if (!scheduledAt) {
      setInterviewError("Debes seleccionar una fecha y hora.");
      return;
    }

    try {
      await validateSlotAvailability(scheduledAt);
    } catch (err: any) {
      setInterviewError(err.message);
      return;
    }

    const payload = {
      application_id: id,
      interview_type: interviewForm.interview_type,
      scheduled_at: interviewForm.scheduled_at ? new Date(interviewForm.scheduled_at).toISOString() : null,
      location: interviewForm.location.trim() || null,
      interviewer_id: interviewForm.interviewer_id || null,
      result: interviewForm.result,
      notes: interviewForm.notes.trim() || null,
    };

    const { error: insertError } = await supabase.from("recruit_interviews").insert(payload);

    if (insertError) {
      setInterviewError(insertError.message);
      return;
    }

    // Auto-advance if virtual interview passed
    // Auto-advance if virtual interview passed
    if (payload.interview_type === 'virtual' && payload.result === 'pass') {
      try {
        if (application?.status_key === 'virtual_scheduled') {
          await triggerStatusChange('virtual_done', 'Entrevista virtual completada');
        }
        await triggerStatusChange('final_docs', 'Entrevista virtual aprobada');
      } catch (err) {
        console.error("Error auto-advancing status:", err);
      }
    }

    // Auto-email al entrevistador si fue asignado
    if (payload.interviewer_id && payload.scheduled_at) {
      try {
        const { data: template } = await supabase
          .from('recruit_message_templates')
          .select('id')
          .eq('template_key', 'schedule_interview')
          .single();

        if (template) {
          await supabase.from('recruit_message_logs').insert({
            application_id: id,
            template_id: template.id,
            status: 'queued',
            channel: 'email'
          });
        }
      } catch (err) {
        console.error("Error queueing interview email:", err);
      }
    }

    setInterviewForm({
      interview_type: "phone",
      scheduled_at: "",
      location: "",
      interviewer_id: "",
      result: "pending",
      notes: "",
    });

    await loadData();
  };



  if (loading && !application) {
    return <LoadingScreen label="Cargando ficha" />;
  }

  if (!application) {
    return (
      <section className="crm-section">
        <p className="error">{error ?? "No se encontró la solicitud."}</p>
        <Link className="btn btn-ghost" to="/crm">
          Volver al pipeline
        </Link>
      </section>
    );
  }

  const person = application.recruit_candidates?.recruit_persons;
  const job = application.recruit_job_postings;
  const statusLabel = statusMap[application.status_key]?.label ?? application.status_key;
  const latestRehire = rehireFlags[0] ?? null;

  const scheduleVirtualInterview = async (slot: string) => {
    if (!application) return;
    setScheduling(true);

    try {
      if (!functionsBaseUrl) {
        toast.error("Configuración de red no encontrada.");
        return;
      }

      const { data: funcData, error: funcError } = await supabase.functions.invoke('schedule_interview', {
        body: {
          application_id: application.id,
          scheduled_at: slot,
          interviewer_id: user?.id,
        }
      });

      if (funcError) {
        throw new Error(funcError.message || "Falla al agendar la entrevista.");
      }

      if (funcData?.error) {
        throw new Error(funcData.error);
      }

      toast.success("Evento de Google Calendar creado exitosamente. Candidato notificado.");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al agendar entrevista.");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <section className="crm-detail-container" style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(340px, 1fr) 3.2fr',
      gap: '2.5rem',
      padding: '2rem',
      minHeight: '100%',
      background: 'var(--bg-pure)'
    }}>

      {/* ─── Document Preview Modal ─── */}
      {previewUrl && (
        <div className="doc-preview-overlay" style={{ zIndex: 99999 }} onClick={() => setPreviewUrl(null)}>
          <div className="doc-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doc-preview-header">
              <strong>{previewName}</strong>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a className="btn-ghost" href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem' }}>↗ Abrir en nueva pestaña</a>
                <button className="btn-ghost" type="button" style={{ fontSize: '0.7rem' }} onClick={() => setPreviewUrl(null)}>✕ Cerrar</button>
              </div>
            </div>
            <div className="doc-preview-body">
              <object data={previewUrl} type="application/pdf" width="100%" height="100%" aria-label={previewName}>
                <iframe src={previewUrl} title={previewName} width="100%" height="100%" style={{ border: 'none' }} />
              </object>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR: PERFIL RÁPIDO */}
      <aside className="crm-sidebar" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        padding: '2.5rem',
        borderRadius: '24px',
        position: 'sticky',
        top: '0px',
        height: 'fit-content',
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
        zIndex: 5,
        alignSelf: 'start'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: '120px', height: '120px', background: 'var(--accent)', borderRadius: '50%', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 900, color: 'white', border: '5px solid var(--bg-accent)' }}>
            {person?.first_name?.[0]}{person?.last_name?.[0]}
          </div>
          <h2 style={{ fontSize: '1.8rem', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>{person?.first_name} {person?.last_name}</h2>
          <span className="badge" style={{ backgroundColor: 'var(--bg-accent)', color: 'var(--accent)', fontWeight: 800 }}>{statusLabel}</span>
          {application.traffic_light && (
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span className={`traffic traffic-${application.traffic_light}`} style={{ width: '12px', height: '12px' }} />
              <small className="mono" style={{ fontSize: '0.6rem' }}>PRIORIDAD {application.traffic_light.toUpperCase()}</small>
            </div>
          )}
        </div>

        <div className="sidebar-info" style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
          <div style={{ padding: '1rem', borderRadius: '12px', background: 'var(--bg-accent)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Briefcase size={14} className="mono" style={{ color: 'var(--accent)' }} />
              <small className="mono" style={{ opacity: 0.5, fontSize: '0.55rem', letterSpacing: '0.05em' }}>VACANTE OBJETIVO</small>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>{job?.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem', opacity: 0.7 }}>
              <MapPin size={10} />
              <small style={{ fontSize: '0.75rem' }}>{job?.branch ?? "Sucursal General"}</small>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <User size={14} className="mono" style={{ color: 'var(--accent)' }} />
              <small className="mono" style={{ opacity: 0.5, fontSize: '0.55rem', letterSpacing: '0.05em' }}>DATOS DE CONTACTO</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={14} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, wordBreak: 'break-all' }}>{person?.email ?? "Sin email"}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={14} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{person?.phone ?? "Sin teléfono"}</div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ShieldCheck size={14} className="mono" style={{ color: 'var(--accent)' }} />
              <small className="mono" style={{ opacity: 0.5, fontSize: '0.55rem', letterSpacing: '0.05em' }}>RESPONSABLE RH</small>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 900 }}>
                {application.profiles?.full_name?.[0] ?? "P"}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 800 }}>{application.profiles?.full_name ?? "PENDIENTE"}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2.5rem', padding: '1.2rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-pro)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <RotateCcw size={14} className="mono" style={{ color: 'var(--accent)' }} />
            <h4 className="mono" style={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>REINGRESO</h4>
          </div>
          {latestRehire ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div className={`traffic traffic-${latestRehire.color}`} style={{ width: '12px', height: '12px', flexShrink: 0, marginTop: '3px' }} />
              <div style={{ fontSize: '0.75rem', lineHeight: '1.4', opacity: 0.8 }}>{latestRehire.reason}</div>
            </div>
          ) : (
            <p style={{ fontSize: '0.7rem', opacity: 0.4, fontStyle: 'italic' }}>Sin incidencias de reingreso previas.</p>
          )}
        </div>

        <div style={{ marginTop: '2rem' }}>
          <Link className="btn-ghost" to="/crm" style={{ width: '100%', textAlign: 'center', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} />
            VOLVER AL PIPELINE
          </Link>
        </div>
      </aside>

      {/* CUERPO PRINCIPAL: TABS DE TRABAJO */}
      <main className="crm-main-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1 }}>

        {/* HEADER CONTEXTUAL DE ACCIÓN */}
        <div style={{
          background: 'linear-gradient(90deg, var(--bg-card) 0%, rgba(var(--accent-rgb), 0.05) 100%)',
          padding: '1.5rem 2.5rem',
          borderRadius: '24px',
          border: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
        }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {stageConfig.nextStepText.toUpperCase()}
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
            {application?.status_key === 'interview_scheduled' && !isInterviewPassed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <Clock size={12} className="animate-pulse" style={{ color: 'var(--warning)' }} />
                <span className="mono" style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.8 }}>
                  ESPERANDO A QUE SE REALICE LA ENTREVISTA ({formatDateTime(activeInterview?.scheduled_at)})
                </span>
              </div>
            ) : (
              <>
                <span className="mono" style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6 }}>SIGUIENTE ACCIÓN:</span>

                {/* Casos donde faltan documentos: Mostramos botón de IR A VALIDAR y Rechazo */}
                {!stageConfig.docsValidated && ['new', 'validation', 'docs_validation'].includes(application?.status_key || '') ? (
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button
                      className="btn-magnetic"
                      onClick={() => setActiveTab('documents')}
                      style={{
                        padding: '0.7rem 1.4rem',
                        fontSize: '0.65rem',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        fontWeight: 900,
                        borderRadius: '12px'
                      }}
                    >
                      📂 VALIDAR DOCUMENTOS
                    </button>
                    <button
                      className="btn-magnetic"
                      onClick={() => {
                        setNextStatus('rejected');
                        const el = document.getElementById('status-transition-form');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      style={{
                        padding: '0.7rem 1.4rem',
                        fontSize: '0.65rem',
                        background: 'rgba(239, 68, 68, 0.05)',
                        color: 'var(--danger)',
                        border: '1px solid currentColor',
                        fontWeight: 900,
                        borderRadius: '12px'
                      }}
                    >
                      NO SELECCIONADO
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    {allowedTransitions.sort((a, b) => {
                      const priority = ['virtual_pending', 'rejected'];
                      const ai = priority.indexOf(a);
                      const bi = priority.indexOf(b);
                      if (ai !== -1 && bi !== -1) return ai - bi;
                      if (ai !== -1) return -1;
                      if (bi !== -1) return 1;
                      return 0;
                    }).slice(0, 3).map(st => (
                      <button
                        key={st}
                        className="btn-magnetic"
                        onClick={() => {
                          setNextStatus(st);
                          const el = document.getElementById('status-transition-form');
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        style={{
                          padding: '0.7rem 1.4rem',
                          fontSize: '0.65rem',
                          background: st === 'rejected' ? 'rgba(239, 68, 68, 0.05)' : (st === 'virtual_pending' ? 'var(--accent)' : 'var(--bg-accent)'),
                          color: st === 'rejected' ? 'var(--danger)' : (st === 'virtual_pending' ? 'white' : 'var(--accent)'),
                          border: st === 'virtual_pending' ? 'none' : '1px solid currentColor',
                          fontWeight: 900,
                          borderRadius: '12px'
                        }}
                      >
                        {statusMap[st]?.label.toUpperCase()}
                      </button>
                    ))}
                    {allowedTransitions.length === 0 && <span className="badge">FLUJO COMPLETADO</span>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <header style={{
          background: 'var(--bg-card)',
          padding: '1rem 2.5rem',
          borderRadius: '16px',
          border: '1px solid var(--border-light)',
          display: 'flex',
          gap: '3rem',
          position: 'static', // Back to normal flow as requested
          boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
          marginBottom: '1rem'
        }}>
          {stageConfig.tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                background: 'none',
                border: 'none',
                padding: '1.2rem 0',
                fontSize: '0.65rem',
                fontWeight: 800,
                cursor: 'pointer',
                color: activeTab === t.id ? 'var(--accent)' : 'var(--text-dim)',
                borderBottom: activeTab === t.id ? '3px solid var(--accent)' : '3px solid transparent',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                transition: 'all 0.3s ease',
                opacity: activeTab === t.id ? 1 : 0.6
              }}
            >
              <span style={{
                color: activeTab === t.id ? 'var(--accent)' : 'inherit',
                display: 'flex',
                alignItems: 'center'
              }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </header>

        {/* CONTENIDO DE PESTAÑAS */}
        <div style={{ padding: '0 1rem' }}>
          {error ? <p className="error">{error}</p> : null}

          {activeTab === 'profile' && (
            <div className="reveal">
              {/* Sección de disponibilidad Prioritaria */}
              {application?.suggested_slot_1 && !application?.meet_link && ['new', 'docs_validation', 'virtual_pending'].includes(application.status_key) && (
                <div className="pro-card" style={{ marginBottom: '2.5rem', border: '2px solid var(--accent)', background: 'linear-gradient(135deg, rgba(61, 90, 254, 0.05) 0%, rgba(61, 90, 254, 0.02) 100%)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ padding: '0.8rem', background: 'var(--accent)', borderRadius: '12px', color: 'white' }}>
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--accent)', fontWeight: 800 }}>// ACCIÓN CRÍTICA REQUERIDA</span>
                        <h3 style={{ fontSize: '1.8rem', marginTop: '0.2rem' }}>VALIDAR DISPONIBILIDAD</h3>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                    {[application.suggested_slot_1, application.suggested_slot_2, application.suggested_slot_3].filter(Boolean).map((slot, i) => (
                      <button key={i} className="glass-card btn-magnetic" onClick={() => scheduleVirtualInterview(slot!)} disabled={scheduling} style={{ padding: '1.5rem', border: '1px solid var(--border-light)', textAlign: 'left', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                          <Clock size={10} style={{ opacity: 0.6 }} />
                          <div className="mono" style={{ fontSize: '0.55rem', opacity: 0.6 }}>OPCIÓN AGENDADA {i + 1}</div>
                        </div>
                        <div style={{ fontWeight: 900, fontSize: '1.1rem', lineHeight: '1.2', marginBottom: '1.2rem' }}>
                          {new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' }).format(new Date(slot!)).toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {scheduling ? (
                            <Clock size={12} className="animate-spin" />
                          ) : (
                            <Video size={12} />
                          )}
                          {scheduling ? "SINCRONIZANDO..." : "CONFIRMAR MEET"}
                          <ArrowRight size={12} style={{ marginLeft: 'auto' }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {application?.meet_link && (
                <div className="pro-card" style={{ marginBottom: '2.5rem', background: 'var(--accent)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 15px 35px rgba(61, 90, 254, 0.2)', padding: '2rem 2.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.4rem' }}>MEET CONFIGURADO</h3>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {isMeetJoinable ? (
                      <a href={application.meet_link} target="_blank" rel="noreferrer" className="btn-magnetic" style={{ margin: '1rem 0', background: 'white', color: 'var(--accent)', padding: '1rem 2rem', fontWeight: 800, borderRadius: 'var(--radius-pro)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z"></path><rect x="3" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>
                        UNIRSE AHORA
                      </a>
                    ) : (
                      <button disabled className="btn-magnetic" style={{ margin: '1rem 0', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', padding: '1rem 2rem', fontWeight: 800, borderRadius: 'var(--radius-pro)', border: 'none', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4 }}><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z"></path><rect x="3" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>
                        UNIRSE AHORA
                      </button>
                    )}
                    {!isMeetJoinable && (
                      <span className="mono" style={{ fontSize: '0.65rem', color: '#ffe082', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                        <Clock size={10} />
                        SE HABILITARÁ 30 MIN ANTES DE LA REUNIÓN
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="card" style={{ padding: '2rem', borderRadius: 'var(--radius-pro)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '2rem' }}>
                    <GraduationCap size={18} style={{ color: 'var(--accent)' }} />
                    <h3 className="mono" style={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>DATOS COMPLEMENTARIOS</h3>
                  </div>
                  <div className="detail-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.8rem' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Grado Académico</span>
                      <strong style={{ fontSize: '0.85rem' }}>{application.recruit_candidates?.education_level}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.8rem' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Estado de Certificado</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {application.recruit_candidates?.has_education_certificate ? <CheckCircle2 size={12} style={{ color: 'var(--success)' }} /> : <AlertCircle size={12} style={{ color: 'var(--warning)' }} />}
                        <strong style={{ fontSize: '0.85rem' }}>{application.recruit_candidates?.has_education_certificate ? "COMPLETADO" : "PENDIENTE"}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Fecha de Postulación</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={12} style={{ opacity: 0.4 }} />
                        <strong style={{ fontSize: '0.85rem' }}>{formatDateTime(application.submitted_at)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card" style={{ padding: '2rem', borderRadius: 'var(--radius-pro)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '2rem' }}>
                    <History size={18} style={{ color: 'var(--accent)' }} />
                    <h3 className="mono" style={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>TRAZA DE MOVIMIENTOS</h3>
                  </div>
                  <div className="timeline-compact" style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {statusHistory.map(h => (
                      <div key={h.id} style={{ fontSize: '0.75rem', padding: '1rem 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{statusMap[h.status_key]?.label || h.status_key}</strong>
                          <small style={{ opacity: 0.5 }}>{new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(h.changed_at))}</small>
                        </div>
                        <p style={{ opacity: 0.7, fontSize: '0.7rem' }}>{h.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div id="status-transition-form" className="card" style={{ marginTop: '2rem', padding: '2.5rem', border: nextStatus ? '2px solid var(--accent)' : '1px solid var(--border-light)', transition: 'all 0.3s ease' }}>
                <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--accent)' }}>// CONTROL DE FLUJO MANUAL</span>
                <h3 style={{ marginBottom: '1.5rem' }}>TRANSICIÓN DE ESTADO</h3>

                {application?.status_key === 'interview_scheduled' && !isInterviewPassed ? (
                  <div className="pro-card" style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-light)', borderRadius: '16px', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                      <div style={{ padding: '1rem', background: 'rgba(61, 90, 254, 0.1)', borderRadius: '50%', color: 'var(--accent)' }}>
                        <Clock size={32} />
                      </div>
                    </div>
                    <h4 className="mono" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>ENTREVISTA POR REALIZAR</h4>
                    <p style={{ opacity: 0.6, fontSize: '0.75rem', maxWidth: '300px', margin: '0 auto' }}>
                      Las acciones de evaluación se habilitarán automáticamente una vez pase la hora programada: <br />
                      <strong style={{ color: 'var(--accent)' }}>{formatDateTime(activeInterview?.scheduled_at)}</strong>
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleStatusChange} className="form-stack">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>FASE DESTINO
                        <select className="input" value={nextStatus} onChange={e => setNextStatus(e.target.value)} style={{ marginTop: '0.5rem' }}>
                          <option value="">Selecciona...</option>
                          {allowedTransitions.map(st => <option key={st} value={st}>{statusMap[st]?.label || st}</option>)}
                        </select>
                      </label>
                      <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>MOTIVO DEL CAMBIO
                        <input className="input" placeholder="Justifica este movimiento..." value={statusReason} onChange={e => setStatusReason(e.target.value)} style={{ marginTop: '0.5rem' }} />
                      </label>
                    </div>

                    {nextStatus === 'interview_scheduled' && (
                      <div className="reveal" style={{ padding: '1.5rem', background: 'var(--bg-accent)', borderRadius: '16px', marginBottom: '1.5rem', border: '1px dashed var(--accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={14} style={{ color: 'var(--accent)' }} />
                            <span className="mono" style={{ fontSize: '0.65rem', fontWeight: 800 }}>
                              {application?.suggested_slot_1 ? 'HORARIOS PROPUESTOS POR EL CANDIDATO' : 'CONFIGURAR PROPUESTA DE HORARIOS'}
                            </span>
                          </div>
                        </div>

                        <div className="slots-container" style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                          gap: '0.6rem',
                          maxHeight: '300px',
                          overflowY: 'auto',
                          padding: '0.5rem'
                        }}>
                          {availableSlots.map((val: any) => {
                            const iso = typeof val === 'string' ? val : val.toISOString();
                            const tDate = new Date(iso).getTime();
                            const isSelected = slot1 && new Date(slot1).getTime() === tDate;

                            const displayDate = iso.split('T')[0];
                            const displayTime = iso.split('T')[1].substring(0, 5);

                            return (
                              <button
                                key={iso}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSlot1("");
                                  } else {
                                    setSlot1(iso);
                                  }
                                }}
                                style={{
                                  padding: '1rem 0.5rem',
                                  borderRadius: '12px',
                                  border: isSelected ? '2.5px solid var(--accent)' : '1px solid var(--border-light)',
                                  background: isSelected ? 'rgba(61, 90, 254, 0.1)' : 'var(--bg-card)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  textAlign: 'center'
                                }}
                              >
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, marginBottom: '0.4rem', opacity: 0.6 }}>
                                  {displayDate}
                                </div>
                                <div style={{ fontSize: '1rem', fontWeight: 900, color: isSelected ? 'var(--accent)' : 'inherit' }}>
                                  {displayTime}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {statusError && <p className="error" style={{ marginTop: '1rem' }}>{statusError}</p>}
                      </div>
                    )}

                    <button className="btn-primary" type="submit" style={{ padding: '1rem', width: '100%', fontWeight: 800 }}>
                      {statusSubmitting ? 'PROCESANDO...' : 'EJECUTAR TRANSICIÓN'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {activeTab === 'interviews' && (
            <div className="reveal">
              <div className="card" style={{ padding: '2.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>GESTIÓN DE ENTREVISTAS</h3>
                <form onSubmit={handleInterviewSubmit} className="form-stack">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', alignItems: 'flex-end' }}>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>TIPO
                      <select className="input" value={interviewForm.interview_type} onChange={e => setInterviewForm(p => ({ ...p, interview_type: e.target.value }))} style={{ marginTop: '0.5rem' }}>
                        <option value="phone">Filtro Telefónico</option>
                        <option value="virtual">Virtual (Meet)</option>
                        <option value="in_person">Presencial</option>
                      </select>
                    </label>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>FECHA Y HORA
                      <input type="datetime-local" className="input" value={interviewForm.scheduled_at} onChange={e => setInterviewForm(p => ({ ...p, scheduled_at: e.target.value }))} style={{ marginTop: '0.5rem' }} />
                    </label>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>MODALIDAD / LINK
                      <input className="input" placeholder="URL o Sala..." value={interviewForm.location} onChange={e => setInterviewForm(p => ({ ...p, location: e.target.value }))} style={{ marginTop: '0.5rem' }} />
                    </label>
                    <button className="btn-primary" type="submit" style={{ padding: '0.8rem' }}>AGENDAR</button>
                  </div>
                  {interviewError && <p className="error" style={{ marginTop: '1rem' }}>{interviewError}</p>}
                </form>
              </div>

              <div style={{ marginTop: '3rem' }}>
                <h4 className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', borderLeft: '4px solid var(--accent)', paddingLeft: '1rem', marginBottom: '1.5rem' }}>HISTORIAL DE ENTREVISTAS</h4>
                {interviews.map(i => (
                  <div key={i.id} className="glass-card" style={{ marginBottom: '1rem', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-light)', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                      <div style={{ background: 'var(--bg-accent)', minWidth: '55px', height: '55px', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--accent)' }}>
                          {i.scheduled_at ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', timeZone: 'America/Mexico_City' }).format(new Date(i.scheduled_at)) : '—'}
                        </div>
                        <small className="mono" style={{ fontSize: '0.45rem', opacity: 0.6 }}>
                          {i.scheduled_at ? new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'America/Mexico_City' }).format(new Date(i.scheduled_at)).toUpperCase() : '—'}
                        </small>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: i.result === 'pending' ? 'var(--warning)' : (i.result === 'pass' ? 'var(--success)' : 'var(--danger)') }} />
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.05em' }}>{i.interview_type.toUpperCase()}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', opacity: 0.6, fontSize: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MapPin size={10} />
                            <span>{i.location || 'REMOTO'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={10} />
                            <span>
                              {i.scheduled_at ? new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' }).format(new Date(i.scheduled_at)) : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      {i.result === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                          <button className="btn-ghost" style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #22c55e', color: '#166534', background: 'rgba(34, 197, 94, 0.05)' }} onClick={async () => {
                            await supabase.from("recruit_interviews").update({ result: 'pass' }).eq("id", i.id);
                            toast.success("APROBADO");
                            loadData();
                          }}>
                            <CheckCircle2 size={12} />
                            APROBAR
                          </button>
                          <button className="btn-ghost" style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #ef4444', color: '#991b1b', background: 'rgba(239, 68, 68, 0.05)' }} onClick={async () => {
                            await supabase.from("recruit_interviews").update({ result: 'fail' }).eq("id", i.id);
                            toast.info("DESCARTADO");
                            loadData();
                          }}>
                            <Trash2 size={12} />
                            DESCARTAR
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', background: 'var(--bg-accent)', borderRadius: '8px' }}>
                          {i.result === 'pass' ? <CheckCircle2 size={12} style={{ color: 'var(--success)' }} /> : <XCircle size={12} style={{ color: 'var(--danger)' }} />}
                          <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.05em' }}>{i.result.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="reveal">
              <div className="card" style={{ padding: '2.5rem', borderRadius: '24px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                  <MessageSquare size={20} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ margin: 0 }}>BITÁCORA DE RECLUTADOR</h3>
                </div>
                <form onSubmit={handleAddNote} className="form-stack">
                  <ReactQuill theme="snow" value={noteText} onChange={setNoteText} style={{ height: '240px', marginBottom: '4.5rem' }} />
                  <button className="btn-primary" type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '1rem' }}>
                    <Plus size={16} />
                    GUARDAR OBSERVACIÓN
                  </button>
                </form>
              </div>
              <div className="note-list" style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {notes.map(n => (
                  <div key={n.id} className="note-item" style={{ background: 'var(--bg-accent)', padding: '1.8rem', borderRadius: '20px', border: '1px solid var(--border-light)', position: 'relative' }}>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-main)' }} dangerouslySetInnerHTML={{ __html: n.note }} />
                    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
                        <User size={12} />
                        <small className="mono" style={{ fontSize: '0.6rem', fontWeight: 700 }}>RH: {n.profiles?.full_name}</small>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.5 }}>
                        <Clock size={12} />
                        <small className="mono" style={{ fontSize: '0.6rem' }}>{new Date(n.created_at).toLocaleString()}</small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="reveal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <h3>REPOSITORIO DOCUMENTAL</h3>
                {['new', 'validation', 'docs_validation'].includes(application?.status_key || '') && (
                  <button className="btn-magnetic" onClick={validateFullExpediente} style={{ fontSize: '0.7rem', padding: '0.8rem 2rem' }}>VALIDAR TODO EL EXPEDIENTE</button>
                )}
              </div>

              <div className="doc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                {documents.map(d => (
                  <div
                    key={d.id}
                    className="card doc-card-interactive"
                    onClick={() => handleDownload(d)}
                    style={{
                      padding: '2rem',
                      border: '1px solid var(--border-light)',
                      borderRadius: '24px',
                      background: 'var(--bg-card)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    {/* Icono de Link Externo discreto arriba a la derecha */}
                    <div style={{ position: 'absolute', top: '1.2rem', right: '1.2rem', opacity: 0.3, color: 'var(--text-main)' }}>
                      <ExternalLink size={14} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                      <div style={{ padding: '0.8rem', background: 'var(--bg-accent)', borderRadius: '12px', color: 'var(--accent)' }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{d.recruit_document_types?.name.toUpperCase()}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem', opacity: 0.5 }}>
                          <Clock size={10} />
                          <small className="mono" style={{ fontSize: '0.55rem' }}>{new Date(d.uploaded_at).toLocaleDateString()}</small>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div
                        style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* SI ESTÁ BAJO REVISIÓN O PENDIENTE, MOSTRAR ACCIONES */}
                        {(d.validation_status === 'under_review' || d.validation_status === 'pending') && (
                          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                            <button
                              className="btn-primary"
                              onClick={() => updateDocStatus(d.id, 'validated')}
                              style={{ flex: 1, padding: '0.6rem', fontSize: '0.65rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', pointerEvents: d.validation_status === 'under_review' ? 'auto' : 'none', opacity: d.validation_status === 'under_review' ? 1 : 0.5 }}
                            >
                              <CheckCircle2 size={14} />
                              VALIDAR
                            </button>
                            <button
                              className="btn-ghost"
                              onClick={() => updateDocStatus(d.id, 'rejected')}
                              style={{ flex: 1, padding: '0.6rem', fontSize: '0.65rem', borderRadius: '10px', border: '1px solid var(--danger)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', pointerEvents: d.validation_status === 'under_review' ? 'auto' : 'none', opacity: d.validation_status === 'under_review' ? 1 : 0.5 }}
                            >
                              <XCircle size={14} />
                              RECHAZAR
                            </button>
                          </div>
                        )}

                        {/* SI ESTÁ VALIDADO */}
                        {d.validation_status === 'validated' && (
                          <div style={{ width: '100%', padding: '0.6rem', background: 'rgba(34, 197, 94, 0.1)', color: '#166534', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.65rem', fontWeight: 800 }}>
                            <CheckCircle2 size={14} />
                            DOCUMENTO VALIDADO
                          </div>
                        )}

                        {/* SI ESTÁ RECHAZADO */}
                        {d.validation_status === 'rejected' && (
                          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
                            <div style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: '#991b1b', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.65rem', fontWeight: 800 }}>
                              <XCircle size={14} />
                              RECHAZADO
                            </div>
                            <button className="btn-ghost" onClick={() => updateDocStatus(d.id, 'under_review')} style={{ padding: '0.6rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </section>
  );
}
