import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
import { formatDateTime } from "@/lib/format";
import { functionsBaseUrl, supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabaseClient";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useAppToast, useCrumbs } from "@/app/layouts/CrmLayout";
import {
  Calendar,
  FileText,
  MessageSquare,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  Video,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Clock,
  Briefcase,
  ShieldCheck,
  History,
  Plus,
  ExternalLink,
  Pencil,
  UserPlus,
  ClipboardList,
  Award
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
  category: string;
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
    label: string;
    stage: string;
    is_required: boolean;
  } | null;
}

interface InterviewRow {
  id: string;
  interview_type: "phone" | "in_person" | "virtual";
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

interface OnboardingHostRow {
  id: string;
  full_name: string;
  email: string;
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
  const { setCrumbs } = useCrumbs();
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [transitions, setTransitions] = useState<StatusTransitionRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
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
  const [interviewSaving, setInterviewSaving] = useState(false);
  const [interviewResult, setInterviewResult] = useState<string>("pending");
  const [interviewNotes, setInterviewNotes] = useState<string>("");

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

  const [hosts, setHosts] = useState<OnboardingHostRow[]>([]);
  const [onboardingForm, setOnboardingForm] = useState({
    scheduled_at: "",
    location: "",
    dress_code: "",
    host_id: "",
    notes: "",
  });
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingSaved, setOnboardingSaved] = useState(false);
  const [onboardingEditMode, setOnboardingEditMode] = useState(false);
  const [showManualTransition, setShowManualTransition] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  const [inPersonForm, setInPersonForm] = useState({
    scheduled_at: "",
    location: "",
    interviewer_id: "",
    notes: "",
  });
  const [inPersonSaving, setInPersonSaving] = useState(false);

  // Document preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [viewedDocs, setViewedDocs] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'profile' | 'interviews' | 'notes' | 'documents'>('profile');

  const ALL_TABS = useMemo(() => [
    { id: 'profile', label: 'EXPEDIENTE', icon: <User size={16} /> },
    { id: 'interviews', label: 'ENTREVISTAS', icon: <Calendar size={16} /> },
    { id: 'notes', label: 'BITÁCORA', icon: <MessageSquare size={16} /> },
    { id: 'documents', label: 'DOCUMENTACIÓN', icon: <FileText size={16} /> }
  ], []);

  const stageConfig = useMemo(() => {
    if (!application) return { tabs: ALL_TABS, focus: 'GENERAL', nextStepText: 'CARGANDO...', docsValidated: false, allRequiredUploaded: false };
    const s = application.status_key;

    // Verificar si todos los documentos cargados están VALIDADOS
    const docsValidated = documents.length > 0 && documents.every(d => d.validation_status === 'validated');

    const visibleStages = ['application'];
    if (s === 'documents_pending' || s === 'documents_complete' || s === 'onboarding' || s === 'onboarding_scheduled' || s === 'hired') {
      visibleStages.push('post_interview', 'onboarding');
    }

    let tabs = ['profile', 'notes'];
    let focus = 'REVISIÓN GENERAL';
    let nextStepText = 'REVISAR INFORMACIÓN';

    if (s === 'new' || s === 'validation') {
      tabs = ['profile', 'documents', 'notes'];
      focus = docsValidated ? 'AGENDAR REUNIÓN VIRTUAL' : 'REVISIÓN DE SOLICITUD';
      nextStepText = docsValidated ? 'CONFIRMAR HORARIO DEL CANDIDATO' : 'VALIDAR SOLICITUD DE EMPLEO';
    } else if (s === 'virtual_scheduled') {
      tabs = ['profile', 'documents', 'notes'];
      focus = 'REUNIÓN VIRTUAL AGENDADA';
      nextStepText = 'REGISTRAR DICTAMEN DE EVALUACIÓN';
    } else if (s === 'virtual_done') {
      tabs = ['profile', 'interviews', 'notes'];
      focus = 'ENTREVISTA VIRTUAL COMPLETADA';
      nextStepText = 'AGENDAR REUNIÓN PRESENCIAL';
    } else if (s === 'in_person_scheduled') {
      tabs = ['profile', 'documents', 'notes'];
      focus = 'REUNIÓN PRESENCIAL AGENDADA';
      nextStepText = 'REGISTRAR DICTAMEN PRESENCIAL';
    } else if (s === 'in_person_done') {
      tabs = ['profile', 'interviews', 'notes'];
      focus = 'ENTREVISTA PRESENCIAL COMPLETADA';
      nextStepText = 'REGISTRAR RESULTADO Y AVANZAR';
    } else if (s === 'documents_pending') {
      tabs = ['profile', 'documents', 'notes'];
      focus = docsValidated ? 'EXPEDIENTE LISTO' : 'PAPELEO DE CONTRATACIÓN';
      nextStepText = docsValidated ? 'MARCAR EXPEDIENTE COMPLETO' : 'VALIDAR DOCUMENTOS PARA INGRESO';
    } else if (s === 'documents_complete') {
      tabs = ['profile', 'notes'];
      focus = 'PROGRAMAR ONBOARDING';
      nextStepText = 'COMPLETAR DATOS DE ONBOARDING';
    } else if (s === 'onboarding' || s === 'onboarding_scheduled') {
      tabs = ['profile', 'documents', 'notes'];
      focus = 'PROCESO DE INGRESO';
      nextStepText = s === 'onboarding_scheduled' ? 'ONBOARDING PROGRAMADO' : 'PROGRAMAR ONBOARDING';
    } else if (s === 'rejected') {
      tabs = ['profile', 'documents', 'notes'];
      focus = 'HISTORIAL';
      nextStepText = 'CANDIDATO RECHAZADO';
    } else if (s === 'hired') {
      tabs = ['profile', 'documents', 'notes'];
      focus = 'CONTRATADO';
      nextStepText = 'CANDIDATO CONTRATADO';
    } else {
      tabs = ['profile', 'interviews', 'notes', 'documents'];
    }

    // Verificar si todos los documentos OBLIGATORIOS han sido subidos y validados
    const requiredTypes = documentTypes.filter(dt => dt.is_required && visibleStages.includes(dt.stage));
    const allRequiredUploaded = requiredTypes.length > 0 &&
      requiredTypes.every(dt => documents.some(d => d.recruit_document_types?.id === dt.id));
    const allRequiredValidated = allRequiredUploaded &&
      requiredTypes.every(dt =>
        documents
          .filter(d => d.recruit_document_types?.id === dt.id)
          .every(d => d.validation_status === 'validated')
      );

    return {
      tabs: ALL_TABS.filter(t => tabs.includes(t.id)),
      focus,
      nextStepText,
      docsValidated,
      allRequiredUploaded,
      allRequiredValidated,
      visibleStages
    };
  }, [application, ALL_TABS, documents, documentTypes]);

  const activeInterview = useMemo(() => {
    return interviews.find(i => i.result === 'pending') || interviews[0];
  }, [interviews]);


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
      baseTransitions = baseTransitions.filter(st => !['interview_scheduled', 'interview_done_pass', 'interview_done_fail'].includes(st));
    }

    return baseTransitions;
  }, [application, transitions, stageConfig.docsValidated]);

  const loadData = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
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

    const person = appData.recruit_candidates?.recruit_persons;
    const candidateName = person ? `${person.first_name} ${person.last_name}` : "Candidato";
    setCrumbs([{ label: "Pipeline", to: "/crm" }, { label: candidateName }]);

    setRehireFlags([]);

    const personId = appData.recruit_candidates?.recruit_persons?.id ?? null;

    const requests: any[] = [
      supabase
        .from("recruit_statuses")
        .select("status_key, label, category, requires_reason")
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
          "id, storage_path, validation_status, validation_notes, uploaded_at, validated_at, recruit_document_types!inner(id, name, label, stage, is_required, is_active)",
        )
        .eq("application_id", id)
        .eq("recruit_document_types.is_active", true)
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
      supabase
        .from("recruit_document_types")
        .select("id, name, label, stage, is_required")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("recruit_onboarding_plans")
        .select("id, scheduled_at, location, dress_code, host_name, host_id, notes")
        .eq("application_id", id)
        .maybeSingle(),
      supabase
        .from("recruit_onboarding_hosts")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name")
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
    const [statusRes, transitionRes, noteRes, docRes, interviewRes, historyRes, typeRes, onboardingPlanRes, hostsRes] = results;

    if (statusRes?.error) setError(statusRes.error.message);
    if (transitionRes?.error) setError(transitionRes.error.message);
    if (noteRes?.error) setError(noteRes.error.message);
    if (docRes?.error) setError(docRes.error.message);
    if (interviewRes?.error) setError(interviewRes.error.message);
    if (historyRes?.error) setError(historyRes.error.message);
    if (typeRes?.error) setError(typeRes.error.message);

    setStatuses((statusRes?.data as any) ?? []);
    setTransitions((transitionRes?.data as any) ?? []);
    setNotes((noteRes?.data as any) ?? []);
    const loadedDocs: DocumentRow[] = (docRes?.data as any) ?? [];
    setDocuments(loadedDocs);
    // Restore viewed state from localStorage, keyed by storage_path so a re-upload invalidates it
    setViewedDocs(new Set(
      loadedDocs
        .filter(d => localStorage.getItem(`viewed_doc_${d.id}_${d.storage_path}`) === '1')
        .map(d => d.id)
    ));
    setDocumentTypes((typeRes?.data as any) ?? []);

    const ivs = (interviewRes?.data as any) ?? [];
    setInterviews(ivs);
    // Pre-fill result form with the first pending interview if any
    const pending = ivs.find((i: any) => i.result === 'pending');
    if (pending) {
      // Si es presencial, NO precargamos las notas logísticas en el dictamen para mantenerlo limpio
      setInterviewNotes(pending.interview_type === 'in_person' ? "" : (pending.notes || ""));
      setInterviewResult(pending.result || "pending");
    }
    setStatusHistory((historyRes?.data as any) ?? []);
    const existingPlan = onboardingPlanRes?.data ?? null;
    const planExists = !!(existingPlan?.scheduled_at);
    setOnboardingSaved(planExists);
    setOnboardingEditMode(!planExists);
    if (existingPlan?.scheduled_at) {
      const dt = new Date(existingPlan.scheduled_at);
      const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setOnboardingForm({
        scheduled_at: localIso,
        location: existingPlan.location ?? "",
        dress_code: existingPlan.dress_code ?? "",
        host_id: existingPlan.host_id ?? "",
        notes: existingPlan.notes ?? "",
      });
    }
    setHosts((hostsRes?.data as OnboardingHostRow[]) ?? []);

    let offset = 9;
    if (personId) {
      const rehireRes = results[offset];
      if (rehireRes?.error) setError(rehireRes.error.message);
      setRehireFlags((rehireRes?.data as any) ?? []);
      offset += 1;
    }





    setLoading(false);
  }, [id, profile?.role]);

  useEffect(() => {
    loadData();
    return () => setCrumbs([]);
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

  const triggerStatusChange = async (newStatus: string, reason?: string, note?: string, extraVariables: any = {}) => {
    // 1. Manejo especial de agendamiento (Selección de Slot)
    // 2. Ejecutar cambio de estatus CENTRALIZADO (Lógica de Oro)
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("Sesión expirada. Recarga la página e inicia sesión nuevamente.");

    const res = await fetch(`${supabaseUrl}/functions/v1/change_status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": supabaseAnonKey!,
      },
      body: JSON.stringify({
        application_id: id,
        status_key: newStatus,
        reason: reason || null,
        note: note || null,
        variables: { custom_note: note || "", ...extraVariables },
      }),
    });

    const statusData = await res.json();
    if (!res.ok) {
      throw new Error(statusData?.details ?? statusData?.error ?? statusData?.message ?? JSON.stringify(statusData) ?? `Error ${res.status}`);
    }

    return { ok: true, email: statusData?.email };
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
      const result: any = await triggerStatusChange(nextStatus, statusReason.trim(), statusNote.trim());
      if (result.email?.template_key) {
        toast.info(`Estatus actualizado. Correo "${result.email.template_key}" en cola.`);
      } else {
        toast.success("Estatus actualizado con éxito.");
      }

      const resolvedStatus = nextStatus;
      setStatusReason("");
      setStatusNote("");
      setShowManualTransition(false);
      await loadData(true);
      setNextStatus("");

      // Correos post-transición — solo si el edge function no los mandó ya
      if (!result.email?.template_key) {
        const { data: { session: postSession } } = await supabase.auth.getSession();
        const postToken = postSession?.access_token;
        if (postToken && id) {
          if (resolvedStatus === 'hired') {
            fetch(`${supabaseUrl}/functions/v1/send_email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${postToken}`, "apikey": supabaseAnonKey! },
              body: JSON.stringify({ application_id: id, template_key: "welcome_onboarding" }),
            });
          }
          if (resolvedStatus === 'documents_pending') {
            fetch(`${supabaseUrl}/functions/v1/send_email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${postToken}`, "apikey": supabaseAnonKey! },
              body: JSON.stringify({ application_id: id, template_key: "documents_request" }),
            });
          }
          if (resolvedStatus === 'in_person_scheduled') {
            // El correo ya debería haber sido enviado por el Edge Function con las variables correctas
            // No obstante, si necesitas un refuerzo manual, asegúrate de pasar las variables de la plantilla:
            // Pero lo ideal es confiar en triggerStatusChange pasándole las variables directamente.
          }
        }
      }
    } catch (err: any) {
      console.error("Transition Error:", err);
      setStatusError(err.message);
    }
    setStatusSubmitting(false);
  };

  const handleInterviewSignOff = async () => {
    if (!activeInterview) return;
    setInterviewSaving(true);
    try {
      // 1. Guardar el resultado físico en la tabla de entrevistas
      const { error: ivError } = await supabase
        .from("recruit_interviews")
        .update({ result: interviewResult, notes: interviewNotes.trim() })
        .eq("id", activeInterview.id);

      if (ivError) throw ivError;

      // 2. Ejecutar la transición de estatus según el resultado
      if (interviewResult === 'pass') {
        if (application?.status_key === 'virtual_scheduled') {
          // Aprobado Virtual: virtual_scheduled → virtual_done → in_person_scheduled (manual next)
          await triggerStatusChange('virtual_done', 'REUNIÓN VIRTUAL: APROBADO', interviewNotes.trim());
          // Note: We don't auto-transition to in_person_scheduled because we need to pick a date/time/location
        } else if (application?.status_key === 'in_person_scheduled') {
          // Aprobado Presencial: in_person_scheduled → in_person_done → documents_pending (automático)
          await triggerStatusChange('in_person_done', 'REUNIÓN PRESENCIAL: APROBADO', interviewNotes.trim());
          await triggerStatusChange('documents_pending', 'Avance automático tras aprobación de reunión presencial', undefined);
        }
      } else if (interviewResult === 'fail') {
        await triggerStatusChange('rejected', 'ENTREVISTA: NO APROBADO', interviewNotes.trim());
      }

      toast.success("Resultado de entrevista procesado con éxito.");
      await loadData(true);
    } catch (err: any) {
      toast.error(`Error al procesar resultado: ${err.message}`);
    }
    setInterviewSaving(false);
  };

  const handleInPersonSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!inPersonForm.scheduled_at) {
      toast.error("La fecha y hora son obligatorias.");
      return;
    }
    setInPersonSaving(true);
    try {
      // 1. Crear la entrevista presencial
      const { error: ivError } = await supabase
        .from("recruit_interviews")
        .insert({
          application_id: id,
          interview_type: 'in_person',
          scheduled_at: inPersonForm.scheduled_at,
          location: inPersonForm.location,
          interviewer_id: inPersonForm.interviewer_id || user?.id,
          notes: inPersonForm.notes,
          result: 'pending'
        });

      if (ivError) throw ivError;

      // 2. Transicionar a in_person_scheduled enviando las variables de correo directamente
      await triggerStatusChange('in_person_scheduled', 'Cita presencial agendada', undefined, {
        name: application?.recruit_candidates?.recruit_persons?.first_name || "Candidato",
        job_title: application?.recruit_job_postings?.title || "la vacante",
        interview_date: inPersonForm.scheduled_at ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(inPersonForm.scheduled_at)) : 'Pendiente',
        location: inPersonForm.location || 'Oficinas',
        interviewer_name: application?.profiles?.full_name || 'Personal de RH',
        notes_text: inPersonForm.notes || 'Sin notas adicionales.'
      });

      toast.success("Cita presencial agendada y notificada.");
      await loadData(true);
    } catch (err: any) {
      toast.error(`Error al agendar: ${err.message}`);
    }
    setInPersonSaving(false);
  };

  // --- GENERADOR DE HORARIOS DISPONIBLES ---
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
    await loadData(true);
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
    await loadData(true);
    toast.success(`Documento ${status === 'validated' ? 'validado' : (status === 'rejected' ? 'rechazado' : 'actualizado')}`);
  };

  const handleReject = async (docId: string, note: string) => {
    const { error } = await supabase
      .from("recruit_application_documents")
      .update({
        validation_status: "rejected",
        validation_notes: note.trim() || null,
        validated_at: new Date().toISOString(),
      })
      .eq("id", docId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRejectingDocId(null);
    setRejectNote("");
    await loadData(true);
    toast.info("Documento rechazado.");

    // Notify the candidate by email
    try {
      const rejectedDoc = documents.find(d => d.id === docId);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && application?.id) {
        await fetch(`${supabaseUrl}/functions/v1/send_email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": supabaseAnonKey!,
          },
          body: JSON.stringify({
            application_id: application.id,
            template_key: "document_rejected",
            variables: {
              doc_name: rejectedDoc?.recruit_document_types?.label || rejectedDoc?.recruit_document_types?.name || "documento",
              rejection_reason: note.trim() || "No se especificó un motivo.",
            },
          }),
        });
      }
    } catch (emailErr) {
      console.warn("No se pudo enviar notificación de rechazo:", emailErr);
    }
  };


  const sendDocumentsReminder = async () => {
    setSendingReminder(true);
    try {
      const { data: refreshData } = await supabase.auth.getSession();
      const token = refreshData?.session?.access_token;
      if (!token) throw new Error("Sesión expirada.");
      const res = await fetch(`${supabaseUrl}/functions/v1/send_email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": supabaseAnonKey! },
        body: JSON.stringify({ application_id: id, template_key: "documents_request" }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      toast.success("Recordatorio enviado al candidato.");
    } catch (err: any) {
      toast.error(`Error al enviar recordatorio: ${err.message}`);
    } finally {
      setSendingReminder(false);
    }
  };

  const completeExpediente = async () => {
    const allValidated = documents.length > 0 && documents.every(d => d.validation_status === 'validated');
    if (!allValidated) {
      toast.error("Aún hay documentos sin validar.");
      return;
    }
    try {
      await triggerStatusChange("documents_complete", "Expediente de contratación completo y validado.");
      toast.success("Expediente marcado como completo.");
      await loadData(true);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleOnboardingSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setOnboardingError(null);
    if (!onboardingForm.scheduled_at) {
      setOnboardingError("Debes seleccionar fecha y hora de onboarding.");
      return;
    }
    if (!onboardingForm.host_id) {
      setOnboardingError("Debes seleccionar un anfitrión responsable.");
      return;
    }
    setOnboardingSaving(true);
    try {
      const selectedHost = hosts.find(h => h.id === onboardingForm.host_id) ?? null;

      const { error: upsertError } = await supabase
        .from("recruit_onboarding_plans")
        .upsert({
          application_id: id,
          scheduled_at: onboardingForm.scheduled_at,
          location: onboardingForm.location || null,
          dress_code: onboardingForm.dress_code || null,
          host_id: onboardingForm.host_id,
          host_name: selectedHost?.full_name || null,
          notes: onboardingForm.notes || null,
          created_by: user?.id,
        }, { onConflict: 'application_id' });

      if (upsertError) throw upsertError;

      // Cambio de estatus directo via RPC para evitar que change_status
      // dispare emails automáticos configurados en recruit_status_transitions
      if (application?.status_key !== 'onboarding_scheduled') {
        const { error: rpcError } = await supabase.rpc('recruit_change_status', {
          p_application_id: id,
          p_status_key: 'onboarding_scheduled',
          p_reason: 'Onboarding programado.',
          p_note: null,
        });
        if (rpcError) throw rpcError;
      }

      // Enviar correos en paralelo
      const { data: { session: onbSession } } = await supabase.auth.getSession();
      const token = onbSession?.access_token;
      if (token && id) {
        const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": supabaseAnonKey! };
        await Promise.allSettled([
          // Candidato: detalles de fecha/hora/lugar/vestimenta del onboarding
          fetch(`${supabaseUrl}/functions/v1/send_email`, {
            method: "POST", headers,
            body: JSON.stringify({ application_id: id, template_key: "onboarding_details" }),
          }),
          // Anfitrión: notificación de ingreso
          selectedHost ? fetch(`${supabaseUrl}/functions/v1/send_email`, {
            method: "POST", headers,
            body: JSON.stringify({
              application_id: id,
              template_key: "onboarding_host_notification",
              to_address: selectedHost.email,
              variables: { host_name: selectedHost.full_name },
            }),
          }) : Promise.resolve(),
        ]);
      }

      toast.success("Plan guardado. Notificaciones enviadas al candidato y al anfitrión.");
      setOnboardingSaved(true);
      setOnboardingEditMode(false);
      await loadData(true);
    } catch (err: any) {
      setOnboardingError(err.message);
    } finally {
      setOnboardingSaving(false);
    }
  };

  const handleDownload = async (doc: DocumentRow) => {
    try {
      const { data, error: downloadError } = await supabase.storage.from('recruit-docs').createSignedUrl(doc.storage_path, 300);
      if (downloadError) throw downloadError;
      setPreviewUrl(data.signedUrl);
      setPreviewName(doc.recruit_document_types?.label ?? doc.recruit_document_types?.name ?? "Documento");
      localStorage.setItem(`viewed_doc_${doc.id}_${doc.storage_path}`, '1');
      setViewedDocs(prev => new Set(prev).add(doc.id));
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
        await loadData(true);
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

    // Auto-advance: si la entrevista fue aprobada y el expediente está en virtual_scheduled
    if (payload.result === 'pass' && application?.status_key === 'virtual_scheduled') {
      try {
        await triggerStatusChange('virtual_done', 'Entrevista completada y aprobada');
      } catch (err) {
        console.error("Error al avanzar estatus automáticamente:", err);
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

    await loadData(true);
  };



  if (loading && !application) return null;

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

      const { data: { session: sivSession } } = await supabase.auth.getSession();
      const { data: funcData, error: funcError } = await supabase.functions.invoke('schedule_interview', {
        headers: sivSession?.access_token ? { Authorization: `Bearer ${sivSession.access_token}` } : undefined,
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

      // Enviar correo de citación al candidato
      const { data: { session: emailSession } } = await supabase.auth.getSession();
      if (emailSession?.access_token) {
        fetch(`${supabaseUrl}/functions/v1/send_email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${emailSession.access_token}`,
            'apikey': supabaseAnonKey!,
          },
          body: JSON.stringify({ application_id: application.id, template_key: 'schedule_interview' }),
        }).catch(() => { });
      }

      toast.success('ENTREVISTA AGENDADA: Los correos de notificación están en camino.');
      await loadData(true);
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
          <span className={`badge badge-${application.status_key}`}>{statusLabel}</span>
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
            <ArrowLeft size={12} />
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
            {application?.status_key === 'hired' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.2rem', background: 'rgba(34,197,94,0.08)', borderRadius: '12px', border: '1px solid #22c55e' }}>
                <CheckCircle size={12} style={{ color: '#22c55e' }} />
                <span className="mono" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#16a34a' }}>PROCESO COMPLETADO</span>
              </div>
            ) : application?.status_key === 'rejected' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.2rem', background: 'rgba(239,68,68,0.06)', borderRadius: '12px', border: '1px solid #ef4444' }}>
                <XCircle size={12} style={{ color: '#ef4444' }} />
                <span className="mono" style={{ fontSize: '0.65rem', fontWeight: 800, color: '#dc2626' }}>CANDIDATO NO SELECCIONADO</span>
              </div>
            ) : (
              <>
                <span className="mono" style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.6 }}>SIGUIENTE ACCIÓN:</span>

                {/* new/validation: sin docs validados → ir a validar */}
                {!stageConfig.docsValidated && ['new', 'validation'].includes(application?.status_key || '') ? (
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button className="btn-magnetic" onClick={() => setActiveTab('documents')} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 900, borderRadius: '12px' }}>
                      VALIDAR DOCUMENTOS
                    </button>
                    <button className="btn-magnetic" onClick={() => { setActiveTab('profile'); setNextStatus('rejected'); setShowManualTransition(true); setTimeout(() => document.getElementById('status-transition-form')?.scrollIntoView({ behavior: 'smooth' }), 80); }} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'rgba(239,68,68,0.05)', color: 'var(--danger)', border: '1px solid currentColor', fontWeight: 900, borderRadius: '12px' }}>
                      NO SELECCIONADO
                    </button>
                  </div>

                ) : stageConfig.docsValidated && ['new', 'validation'].includes(application?.status_key || '') ? (
                  /* docs validados → elegir siguiente etapa */
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button className="btn-magnetic" onClick={() => {
                      setActiveTab('profile');
                      if (application?.status_key === 'new') {
                        setNextStatus('validation');
                        setShowManualTransition(true);
                        setTimeout(() => document.getElementById('status-transition-form')?.scrollIntoView({ behavior: 'smooth' }), 80);
                      } else if (application?.suggested_slot_1) {
                        setShowManualTransition(false);
                        setTimeout(() => document.getElementById('slot-confirmation-panel')?.scrollIntoView({ behavior: 'smooth' }), 80);
                      } else {
                        setNextStatus('virtual_scheduled');
                        setShowManualTransition(true);
                        setTimeout(() => document.getElementById('status-transition-form')?.scrollIntoView({ behavior: 'smooth' }), 80);
                      }
                    }} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 900, borderRadius: '12px' }}>
                      REUNIÓN VIRTUAL
                    </button>
                    <button className="btn-magnetic" onClick={() => {
                      setActiveTab('profile');
                      setNextStatus('rejected');
                      setShowManualTransition(true);
                      setTimeout(() => document.getElementById('status-transition-form')?.scrollIntoView({ behavior: 'smooth' }), 80);
                    }} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'rgba(239,68,68,0.05)', color: 'var(--danger)', border: '1px solid currentColor', fontWeight: 900, borderRadius: '12px' }}>
                      NO SELECCIONADO
                    </button>
                  </div>

                ) : application?.status_key === 'documents_pending' ? (
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button className="btn-magnetic" onClick={() => setActiveTab('documents')} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'rgba(61,90,254,0.08)', color: 'var(--accent)', border: '1px solid var(--accent)', fontWeight: 900, borderRadius: '12px' }}>
                      REVISAR DOCUMENTOS
                    </button>
                    <button
                      className="btn-magnetic"
                      onClick={completeExpediente}
                      disabled={!stageConfig.allRequiredValidated}
                      style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: stageConfig.allRequiredValidated ? 'var(--accent)' : 'rgba(61,90,254,0.08)', color: stageConfig.allRequiredValidated ? 'white' : 'var(--text-dim)', border: 'none', fontWeight: 900, borderRadius: '12px', opacity: stageConfig.allRequiredValidated ? 1 : 0.45, cursor: stageConfig.allRequiredValidated ? 'pointer' : 'not-allowed', transition: 'opacity 0.2s' }}
                      title={!stageConfig.allRequiredUploaded ? 'Faltan documentos obligatorios por subir' : !stageConfig.allRequiredValidated ? 'Faltan documentos por validar' : ''}
                    >
                      EXPEDIENTE COMPLETO →
                    </button>
                  </div>

                ) : application?.status_key === 'documents_complete' ? (
                  <button className="btn-magnetic" onClick={() => document.getElementById('onboarding-panel')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 900, borderRadius: '12px' }}>
                    PROGRAMAR ONBOARDING ↓
                  </button>

                ) : application?.status_key === 'onboarding' ? (
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    {!onboardingSaved && (
                      <span className="mono" style={{ fontSize: '0.6rem', opacity: 0.5 }}>GUARDA EL PLAN PRIMERO ↓</span>
                    )}
                    <button
                      className="btn-magnetic"
                      disabled={!onboardingSaved}
                      onClick={() => { setNextStatus('hired'); setShowManualTransition(true); setTimeout(() => document.getElementById('status-transition-form')?.scrollIntoView({ behavior: 'smooth' }), 50); }}
                      style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: onboardingSaved ? 'var(--accent)' : 'var(--bg-accent)', color: onboardingSaved ? 'white' : 'var(--text-muted)', border: 'none', fontWeight: 900, borderRadius: '12px', opacity: onboardingSaved ? 1 : 0.5, cursor: onboardingSaved ? 'pointer' : 'not-allowed' }}
                    >
                      CONTRATADO ✓
                    </button>
                    <button
                      className="btn-magnetic"
                      disabled={!onboardingSaved}
                      onClick={() => { setNextStatus('rejected'); setShowManualTransition(true); setTimeout(() => document.getElementById('status-transition-form')?.scrollIntoView({ behavior: 'smooth' }), 50); }}
                      style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'rgba(239,68,68,0.05)', color: onboardingSaved ? 'var(--danger)' : 'var(--text-muted)', border: `1px solid ${onboardingSaved ? 'currentColor' : 'var(--border-light)'}`, fontWeight: 900, borderRadius: '12px', opacity: onboardingSaved ? 1 : 0.5, cursor: onboardingSaved ? 'pointer' : 'not-allowed' }}
                    >
                      NO SELECCIONADO
                    </button>
                  </div>

                ) : application?.status_key === 'virtual_scheduled' || application?.status_key === 'in_person_scheduled' ? (
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button className="btn-magnetic" onClick={() => { setInterviewResult('pass'); setTimeout(() => document.getElementById('interview-signoff-panel')?.scrollIntoView({ behavior: 'smooth' }), 80); }} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 900, borderRadius: '12px' }}>
                      ENTREVISTA APROBADA ✓
                    </button>
                    <button className="btn-magnetic" onClick={() => { setInterviewResult('fail'); setTimeout(() => document.getElementById('interview-signoff-panel')?.scrollIntoView({ behavior: 'smooth' }), 80); }} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'rgba(239,68,68,0.05)', color: 'var(--danger)', border: '1px solid currentColor', fontWeight: 900, borderRadius: '12px' }}>
                      NO APROBADO
                    </button>
                  </div>

                ) : application?.status_key === 'virtual_done' ? (
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button className="btn-magnetic" onClick={() => { document.getElementById('in-person-scheduling-panel')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 900, borderRadius: '12px' }}>
                      AGENDAR REUNIÓN PRESENCIAL ↓
                    </button>
                    <button className="btn-magnetic" onClick={() => { setActiveTab('profile'); setNextStatus('rejected'); setShowManualTransition(true); setTimeout(() => document.getElementById('status-transition-form')?.scrollIntoView({ behavior: 'smooth' }), 80); }} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'rgba(239,68,68,0.05)', color: 'var(--danger)', border: '1px solid currentColor', fontWeight: 900, borderRadius: '12px' }}>
                      NO SELECCIONADO
                    </button>
                  </div>

                ) : application?.status_key === 'onboarding_scheduled' ? (
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button className="btn-magnetic" onClick={() => { setNextStatus('hired'); setShowManualTransition(true); setTimeout(() => document.getElementById('status-transition-form')?.scrollIntoView({ behavior: 'smooth' }), 50); }} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 900, borderRadius: '12px' }}>
                      CONTRATADO ✓
                    </button>
                    <button className="btn-magnetic" onClick={() => { setNextStatus('rejected'); setShowManualTransition(true); setTimeout(() => document.getElementById('status-transition-form')?.scrollIntoView({ behavior: 'smooth' }), 50); }} style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', background: 'rgba(239,68,68,0.05)', color: 'var(--danger)', border: '1px solid currentColor', fontWeight: 900, borderRadius: '12px' }}>
                      NO SELECCIONADO
                    </button>
                  </div>

                ) : (
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    {allowedTransitions.sort((a, b) => {
                      const priority = ['virtual_scheduled', 'rejected'];
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
                          background: st === 'rejected' ? 'rgba(239, 68, 68, 0.05)' : (st === 'virtual_scheduled' ? 'var(--accent)' : 'var(--bg-accent)'),
                          color: st === 'rejected' ? 'var(--danger)' : (st === 'virtual_scheduled' ? 'white' : 'var(--accent)'),
                          border: st === 'virtual_scheduled' ? 'none' : '1px solid currentColor',
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
          padding: '0 2.5rem',
          borderRadius: '16px',
          border: '1px solid var(--border-light)',
          display: 'flex',
          position: 'static',
          boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
          marginBottom: '1rem'
        }}>
          {stageConfig.tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                flex: 1,
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
                justifyContent: 'center',
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
              <div style={{ marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '2rem', borderRadius: 'var(--radius-pro)', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '2rem' }}>
                    <History size={18} style={{ color: 'var(--accent)' }} />
                    <h3 className="mono" style={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>LÍNEA DE TIEMPO</h3>
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {statusHistory.length === 0 && (
                      <p style={{ fontSize: '0.72rem', opacity: 0.4, textAlign: 'center', padding: '1.5rem 0' }}>Sin movimientos registrados</p>
                    )}
                    {statusHistory.map((h, idx) => {
                      const cat = statusMap[h.status_key]?.category ?? 'pipeline';
                      const isNegative = h.status_key === 'rejected';
                      const isPositive = ['hired', 'virtual_done'].includes(h.status_key);
                      const isInterview = cat === 'interview' || h.status_key === 'virtual_scheduled';
                      const isOnboarding = ['onboarding', 'onboarding_scheduled'].includes(h.status_key);
                      const color = isNegative ? '#ef4444'
                        : isPositive ? '#22c55e'
                          : isInterview ? '#8b5cf6'
                            : isOnboarding ? '#f59e0b'
                              : 'var(--accent)';
                      const IconComp = isNegative ? XCircle
                        : h.status_key === 'hired' ? Award
                          : h.status_key === 'new' ? UserPlus
                            : h.status_key === 'validation' ? ClipboardList
                              : isOnboarding ? Briefcase
                                : ['documents_pending', 'documents_complete'].includes(h.status_key) ? FileText
                                  : isInterview ? Calendar
                                    : isPositive ? CheckCircle
                                      : ArrowRight;
                      const isLast = idx === statusHistory.length - 1;
                      return (
                        <div key={h.id} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                          {/* Columna izquierda: ícono + línea */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: `${color}18`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <IconComp size={14} style={{ color }} />
                            </div>
                            {!isLast && <div style={{ width: '2px', flex: 1, minHeight: '16px', background: 'var(--border-light)', margin: '4px 0' }} />}
                          </div>
                          {/* Columna derecha: contenido */}
                          <div style={{ flex: 1, paddingBottom: isLast ? '0' : '1.1rem', paddingTop: '0.3rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                              <span style={{ fontSize: '0.73rem', fontWeight: 700, color, lineHeight: 1.3 }}>
                                {statusMap[h.status_key]?.label || h.status_key}
                              </span>
                              <span style={{ fontSize: '0.63rem', opacity: 0.45, whiteSpace: 'nowrap', flexShrink: 0, paddingTop: '0.05rem' }}>
                                {new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(h.changed_at))}
                              </span>
                            </div>
                            {h.reason && (
                              <p style={{ 
                                margin: '0.25rem 0 0', 
                                fontSize: '0.66rem', 
                                opacity: 0.6, 
                                lineHeight: 1.4,
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap'
                              }}>
                                {h.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ─── INTERVIEW SIGN OFF PANEL ─── */}
              {activeInterview && (application?.status_key === 'virtual_scheduled' || application?.status_key === 'in_person_scheduled') && (
                <div id="interview-signoff-panel" className="reveal" style={{ marginBottom: '2rem' }}>
                  <div className="pro-card" style={{ border: '2px solid var(--accent)', background: 'linear-gradient(135deg, rgba(61, 90, 254, 0.06) 0%, rgba(61, 90, 254, 0.02) 100%)' }}>

                    {/* Cabecera: fecha + botón meet */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ padding: '0.7rem', background: 'var(--accent)', borderRadius: '12px', color: 'white', flexShrink: 0 }}>
                          {application.status_key === 'virtual_scheduled' ? <Video size={20} /> : <MapPin size={20} />}
                        </div>
                        <div>
                          <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--accent)', fontWeight: 800 }}>
                            // {application.status_key === 'virtual_scheduled' ? 'ENTREVISTA VIRTUAL AGENDADA' : 'ENTREVISTA PRESENCIAL AGENDADA'}
                          </span>
                          <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.3rem' }}>{formatDateTime(activeInterview.scheduled_at)}</h3>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                        {application.status_key === 'virtual_scheduled' && (
                          <>
                            {isMeetJoinable ? (
                              <a href={application?.meet_link ?? '#'} target="_blank" rel="noreferrer" className="btn-magnetic" style={{ background: 'var(--accent)', color: 'white', padding: '0.7rem 1.4rem', fontWeight: 800, borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', pointerEvents: application?.meet_link ? 'auto' : 'none', opacity: application?.meet_link ? 1 : 0.5 }}>
                                <Video size={14} /> UNIRSE AHORA
                              </a>
                            ) : (
                              <button disabled style={{ background: 'rgba(61,90,254,0.08)', color: 'var(--accent)', padding: '0.7rem 1.4rem', fontWeight: 800, borderRadius: '12px', border: '1px dashed var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', cursor: 'not-allowed', opacity: 0.5 }}>
                                <Video size={14} /> UNIRSE AHORA
                              </button>
                            )}
                            {!isMeetJoinable && (
                              <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700 }}>
                                <Clock size={10} /> SE HABILITA 30 MIN ANTES
                              </span>
                            )}
                          </>
                        )}
                        {application.status_key === 'in_person_scheduled' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
                            <MapPin size={14} />
                            <span className="mono" style={{ fontSize: '0.65rem', fontWeight: 700 }}>{activeInterview.location || 'Oficinas'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }} className="form-stack">
                      <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-dim)' }}>DICTAMEN DE EVALUACIÓN
                        <select className="input" style={{ marginTop: '0.4rem' }} value={interviewResult} onChange={e => setInterviewResult(e.target.value)}>
                          <option value="pending">Pendiente</option>
                          <option value="pass">Aprobado — pasar a la siguiente fase</option>
                          <option value="fail">No aprobado — cerrar solicitud</option>
                        </select>
                      </label>
                      <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-dim)' }}>OBSERVACIONES Y FEEDBACK
                        <textarea className="input" style={{ marginTop: '0.4rem', minHeight: '90px' }} placeholder="Fortalezas, áreas de mejora, notas del entrevistador..." value={interviewNotes} onChange={e => setInterviewNotes(e.target.value)} />
                      </label>
                      <button
                        className="btn-magnetic"
                        onClick={handleInterviewSignOff}
                        disabled={interviewSaving || interviewResult === 'pending'}
                        style={{ width: '100%', padding: '0.9rem', background: 'var(--accent)', color: 'white', fontWeight: 800, borderRadius: '12px', border: 'none', opacity: interviewResult === 'pending' ? 0.4 : 1, cursor: interviewResult === 'pending' ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s' }}
                      >
                        {interviewSaving ? 'GUARDANDO...' : 'CERRAR FASE DE ENTREVISTA'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── IN-PERSON INTERVIEW SCHEDULING PANEL ─── */}
              {application?.status_key === 'virtual_done' && (
                <div id="in-person-scheduling-panel" className="reveal" style={{ animationDelay: '0.2s', marginBottom: '2rem' }}>
                  <div className="pro-card" style={{ border: `2px solid var(--accent)`, background: 'linear-gradient(135deg, rgba(61,90,254,0.05) 0%, rgba(61,90,254,0.02) 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                      <MapPin size={20} style={{ color: 'var(--accent)' }} />
                      <div>
                        <span className="mono" style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--accent)' }}>// ACCIÓN REQUERIDA</span>
                        <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.1rem' }}>AGENDAR REUNIÓN PRESENCIAL</h3>
                      </div>
                    </div>

                    <form onSubmit={handleInPersonSchedule} className="form-stack">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                        <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>FECHA Y HORA *
                          <input
                            type="datetime-local"
                            className="input"
                            value={inPersonForm.scheduled_at}
                            onChange={e => setInPersonForm(p => ({ ...p, scheduled_at: e.target.value }))}
                            style={{ marginTop: '0.5rem' }}
                            required
                          />
                        </label>
                        <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>UBICACIÓN / SUCURSAL *
                          <input
                            className="input"
                            placeholder="Ej: Sucursal Centro, Planta Alta"
                            value={inPersonForm.location}
                            onChange={e => setInPersonForm(p => ({ ...p, location: e.target.value }))}
                            style={{ marginTop: '0.5rem' }}
                            required
                          />
                        </label>
                        <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>ENTREVISTADOR *
                          <select
                            className="input"
                            value={inPersonForm.interviewer_id}
                            onChange={e => setInPersonForm(p => ({ ...p, interviewer_id: e.target.value }))}
                            style={{ marginTop: '0.5rem' }}
                            required
                          >
                            <option value="">— Seleccionar entrevistador —</option>
                            <option value={application.assigned_to || ""}>{application.profiles?.full_name || "Reclutador Asignado"}</option>
                          </select>
                        </label>
                        <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>NOTAS / INDICACIONES
                          <input
                            className="input"
                            placeholder="Vestimenta, documentos, parking..."
                            value={inPersonForm.notes}
                            onChange={e => setInPersonForm(p => ({ ...p, notes: e.target.value }))}
                            style={{ marginTop: '0.5rem' }}
                          />
                        </label>
                      </div>
                      <button type="submit" className="btn-primary" disabled={inPersonSaving} style={{ padding: '1.1rem', width: '100%', fontWeight: 800, marginTop: '1.5rem', letterSpacing: '0.05em' }}>
                        {inPersonSaving ? 'AGENDANDO...' : 'CONFIRMAR CITA Y NOTIFICAR AL CANDIDATO'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* ─── ONBOARDING PANEL ─── */}
              {(['documents_complete', 'onboarding', 'onboarding_scheduled'].includes(application?.status_key || '')) && (
                <div id="onboarding-panel" className="reveal" style={{ animationDelay: '0.3s', marginBottom: '2rem' }}>
                  <div className="pro-card" style={{ border: `2px solid ${onboardingSaved && !onboardingEditMode ? '#22c55e' : 'var(--accent)'}`, background: onboardingSaved && !onboardingEditMode ? 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.02) 100%)' : 'linear-gradient(135deg, rgba(61,90,254,0.05) 0%, rgba(61,90,254,0.02) 100%)' }}>

                    {/* ── CABECERA ── */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        {onboardingSaved && !onboardingEditMode
                          ? <CheckCircle size={20} style={{ color: '#22c55e' }} />
                          : <Briefcase size={20} style={{ color: 'var(--accent)' }} />
                        }
                        <div>
                          <span className="mono" style={{ fontSize: '0.55rem', fontWeight: 800, color: onboardingSaved && !onboardingEditMode ? '#16a34a' : 'var(--accent)' }}>
                            {onboardingSaved && !onboardingEditMode ? '// PLAN CONFIRMADO' : '// PLAN DE ONBOARDING'}
                          </span>
                          <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.1rem' }}>ONBOARDING</h3>
                        </div>
                      </div>
                      {onboardingSaved && !onboardingEditMode && (
                        <button
                          className="btn-ghost"
                          onClick={() => setOnboardingEditMode(true)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', padding: '0.5rem 1rem', borderRadius: '10px' }}
                        >
                          <Pencil size={12} /> EDITAR
                        </button>
                      )}
                    </div>

                    {/* ── VISTA RESUMEN (plan guardado) ── */}
                    {onboardingSaved && !onboardingEditMode ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span className="mono" style={{ fontSize: '0.55rem', fontWeight: 800, opacity: 0.5 }}>FECHA Y HORA</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                              {onboardingForm.scheduled_at
                                ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(onboardingForm.scheduled_at))
                                : '—'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span className="mono" style={{ fontSize: '0.55rem', fontWeight: 800, opacity: 0.5 }}>LUGAR</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MapPin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{onboardingForm.location || '—'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span className="mono" style={{ fontSize: '0.55rem', fontWeight: 800, opacity: 0.5 }}>VESTIMENTA</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Briefcase size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{onboardingForm.dress_code || '—'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <span className="mono" style={{ fontSize: '0.55rem', fontWeight: 800, opacity: 0.5 }}>ANFITRIÓN</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <User size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                              {hosts.find(h => h.id === onboardingForm.host_id)?.full_name || '—'}
                            </span>
                          </div>
                        </div>
                        {onboardingForm.notes && (
                          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border-light)' }}>
                            <span className="mono" style={{ fontSize: '0.55rem', fontWeight: 800, opacity: 0.5 }}>INSTRUCCIONES</span>
                            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8, lineHeight: 1.5 }}>{onboardingForm.notes}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── FORMULARIO (sin plan o editando) ── */
                      <form onSubmit={handleOnboardingSubmit} className="form-stack">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>FECHA Y HORA DE INGRESO *
                            <input
                              type="datetime-local"
                              className="input"
                              value={onboardingForm.scheduled_at}
                              onChange={e => setOnboardingForm(p => ({ ...p, scheduled_at: e.target.value }))}
                              style={{ marginTop: '0.5rem' }}
                              required
                            />
                          </label>
                          <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>LUGAR / SUCURSAL
                            <input
                              className="input"
                              placeholder="Ej: Oficinas Corporativas, Piso 2"
                              value={onboardingForm.location}
                              onChange={e => setOnboardingForm(p => ({ ...p, location: e.target.value }))}
                              style={{ marginTop: '0.5rem' }}
                            />
                          </label>
                          <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>CÓDIGO DE VESTIMENTA
                            <input
                              className="input"
                              placeholder="Ej: Formal, Casual, Uniforme"
                              value={onboardingForm.dress_code}
                              onChange={e => setOnboardingForm(p => ({ ...p, dress_code: e.target.value }))}
                              style={{ marginTop: '0.5rem' }}
                            />
                          </label>
                          <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>ANFITRIÓN / RESPONSABLE *
                            <select
                              className="input"
                              value={onboardingForm.host_id}
                              onChange={e => setOnboardingForm(p => ({ ...p, host_id: e.target.value }))}
                              style={{ marginTop: '0.5rem' }}
                              required
                            >
                              <option value="">— Seleccionar anfitrión —</option>
                              {hosts.map(h => (
                                <option key={h.id} value={h.id}>{h.full_name} ({h.email})</option>
                              ))}
                            </select>
                            {hosts.length === 0 && (
                              <small style={{ color: 'var(--warning)', marginTop: '0.3rem', display: 'block' }}>
                                Sin anfitriones registrados. Agrégalos en Admin → Anfitriones.
                              </small>
                            )}
                          </label>
                        </div>
                        <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>INSTRUCCIONES ADICIONALES
                          <textarea
                            className="input"
                            placeholder="Indicaciones especiales, documentos a traer, estacionamiento, etc."
                            value={onboardingForm.notes}
                            onChange={e => setOnboardingForm(p => ({ ...p, notes: e.target.value }))}
                            style={{ marginTop: '0.5rem', minHeight: '80px' }}
                          />
                        </label>
                        {onboardingError && <p className="error">{onboardingError}</p>}
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                          {onboardingSaved && (
                            <button type="button" className="btn-ghost" onClick={() => setOnboardingEditMode(false)} style={{ padding: '1rem', fontWeight: 800, flex: '0 0 auto' }}>
                              CANCELAR
                            </button>
                          )}
                          <button type="submit" className="btn-primary" disabled={onboardingSaving} style={{ padding: '1rem', flex: 1, fontWeight: 800 }}>
                            {onboardingSaving ? 'GUARDANDO...' : 'GUARDAR PLAN DE ONBOARDING'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* ─── PANEL DE HORARIOS PROPUESTOS ─── */}
              {application?.suggested_slot_1 && !application?.meet_link && (application.status_key === 'virtual_scheduled' || (application.status_key === 'validation' && stageConfig.docsValidated)) && (
                <div id="slot-confirmation-panel" className="pro-card" style={{ marginTop: '2rem', border: '2px solid var(--accent)', background: 'linear-gradient(135deg, rgba(61, 90, 254, 0.05) 0%, rgba(61, 90, 254, 0.02) 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ padding: '0.8rem', background: 'var(--accent)', borderRadius: '12px', color: 'white', flexShrink: 0 }}>
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--accent)', fontWeight: 800 }}>// ACCIÓN REQUERIDA</span>
                      <h3 style={{ fontSize: '1.5rem', marginTop: '0.2rem', marginBottom: '0.3rem' }}>CONFIRMAR HORARIO DE ENTREVISTA</h3>
                      <p style={{ margin: 0, opacity: 0.6, fontSize: '0.75rem' }}>El candidato propuso el siguiente horario. Confirmalo para generar el Meet automáticamente.</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {[application.suggested_slot_1, application.suggested_slot_2, application.suggested_slot_3].filter(Boolean).map((slot, i) => {
                      const date = new Date(slot!);
                      const weekday = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'America/Mexico_City' }).format(date).toUpperCase();
                      const dayMonth = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(date).toUpperCase();
                      const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' }).format(date).toUpperCase();
                      return (
                        <button
                          key={i}
                          onClick={() => scheduleVirtualInterview(slot!)}
                          disabled={scheduling}
                          style={{
                            padding: 0, border: '1.5px solid var(--border-light)', borderRadius: '20px',
                            textAlign: 'left', overflow: 'hidden', background: 'var(--bg-card)',
                            display: 'flex', flexDirection: 'column', cursor: scheduling ? 'not-allowed' : 'pointer',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                            opacity: scheduling ? 0.6 : 1,
                          }}
                          onMouseEnter={e => { if (!scheduling) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(61,90,254,0.12)'; } }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                        >
                          {/* Header con badge de opción */}
                          <div style={{ padding: '1.25rem 1.5rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <span className="mono" style={{ fontSize: '0.55rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>OPCIÓN PROPUESTA</span>

                            {/* Fecha */}
                            <div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>{weekday}</div>
                              <div style={{ fontSize: '1rem', fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{dayMonth}</div>
                            </div>

                            {/* Hora */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.9rem', background: 'rgba(61,90,254,0.08)', borderRadius: '10px', border: '1px solid rgba(61,90,254,0.15)' }}>
                              <Clock size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                              <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--accent)', letterSpacing: '0.02em' }}>{time}</span>
                            </div>
                          </div>

                          {/* CTA */}
                          <div style={{ padding: '0.9rem 1.5rem', background: scheduling ? 'rgba(61,90,254,0.3)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            {scheduling ? <Clock size={13} className="animate-spin" style={{ color: 'white' }} /> : <Video size={13} style={{ color: 'white' }} />}
                            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.6rem', letterSpacing: '0.08em' }}>
                              {scheduling ? 'GENERANDO MEET...' : 'CONFIRMAR Y GENERAR MEET'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!['hired', 'rejected'].includes(application?.status_key ?? '') && <div id="status-transition-form" style={{ marginTop: '2rem' }}>
                <button
                  onClick={() => setShowManualTransition(p => !p)}
                  className="btn-ghost"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'transparent', fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-dim)', letterSpacing: '0.08em' }}
                >
                  <span className="mono">// TRANSICIÓN MANUAL DE ESTADO</span>
                  <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', display: 'inline-block', transform: showManualTransition ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                </button>

                {showManualTransition && (
                  <div className="reveal" style={{ marginTop: '0.5rem', padding: '2rem', border: '1px solid var(--border-light)', borderRadius: '16px', background: 'var(--bg-card)' }}>
                    {(
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
                        {statusError && <p className="error">{statusError}</p>}
                        <button className="btn-primary" type="submit" style={{ padding: '0.9rem', width: '100%', fontWeight: 800 }}>
                          {statusSubmitting ? 'PROCESANDO...' : 'EJECUTAR TRANSICIÓN'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>}
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
                            loadData(true);
                          }}>
                            <CheckCircle size={12} />
                            APROBAR
                          </button>
                          <button className="btn-ghost" style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #ef4444', color: '#991b1b', background: 'rgba(239, 68, 68, 0.05)' }} onClick={async () => {
                            await supabase.from("recruit_interviews").update({ result: 'fail' }).eq("id", i.id);
                            toast.info("DESCARTADO");
                            loadData(true);
                          }}>
                            <Trash2 size={12} />
                            DESCARTAR
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', background: 'var(--bg-accent)', borderRadius: '8px' }}>
                          {i.result === 'pass' ? <CheckCircle size={12} style={{ color: 'var(--success)' }} /> : <XCircle size={12} style={{ color: 'var(--danger)' }} />}
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
              {/* ── Notas existentes ── */}
              {notes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', opacity: 0.4 }}>
                  <FileText size={28} style={{ marginBottom: '0.8rem' }} />
                  <p className="mono" style={{ fontSize: '0.7rem' }}>Sin observaciones registradas aún.</p>
                </div>
              ) : (
                <div className="note-list" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  {notes.map(n => (
                    <div key={n.id} className="note-item" style={{ background: 'var(--bg-accent)', padding: '1.8rem', borderRadius: '20px', border: '1px solid var(--border-light)', position: 'relative' }}>
                      <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'anywhere' }} dangerouslySetInnerHTML={{ __html: n.note }} />
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
              )}

              {/* ── Formulario nueva observación ── */}
              <div className="card" style={{ padding: '2.5rem', borderRadius: '24px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                  <Plus size={18} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ margin: 0 }}>NUEVA OBSERVACIÓN</h3>
                </div>
                <form onSubmit={handleAddNote} className="form-stack">
                  <ReactQuill theme="snow" value={noteText} onChange={setNoteText} style={{ height: '200px', marginBottom: '4.5rem' }} />
                  <button className="btn-primary" type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '1rem' }}>
                    <Plus size={16} />
                    GUARDAR OBSERVACIÓN
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="reveal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <h3>REPOSITORIO DOCUMENTAL</h3>
                {application?.status_key === 'documents_pending' && (
                  <button className="btn-ghost" onClick={sendDocumentsReminder} disabled={sendingReminder} style={{ fontSize: '0.65rem', padding: '0.7rem 1.4rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    {sendingReminder ? 'ENVIANDO...' : '✉ SOLICITAR DOCUMENTOS'}
                  </button>
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
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                          {(d.recruit_document_types as any)?.label?.toUpperCase() || (d.recruit_document_types as any)?.name?.toUpperCase() || 'DOCUMENTO'}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem', opacity: 0.5 }}>
                          <Clock size={10} />
                          <small className="mono" style={{ fontSize: '0.55rem' }}>{new Date(d.uploaded_at).toLocaleDateString()}</small>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Badge: archivo re-subido por el candidato */}
                      {d.validation_status === 'under_review' && d.validated_at && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '6px', padding: '3px 10px' }}>
                          <RotateCcw size={10} style={{ color: '#8b5cf6' }} />
                          <span className="mono" style={{ fontSize: '0.52rem', color: '#8b5cf6', fontWeight: 700 }}>ARCHIVO RESUBIDO</span>
                        </div>
                      )}
                      <div
                        style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* SI ESTÁ BAJO REVISIÓN O PENDIENTE, MOSTRAR ACCIONES */}
                        {(d.validation_status === 'under_review' || d.validation_status === 'pending') && (
                          <div style={{ width: '100%' }}>
                            {rejectingDocId !== d.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className="btn-primary"
                                    onClick={() => updateDocStatus(d.id, 'validated')}
                                    disabled={!viewedDocs.has(d.id) || d.validation_status !== 'under_review'}
                                    style={{ flex: 1, padding: '0.6rem', fontSize: '0.65rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: (!viewedDocs.has(d.id) || d.validation_status !== 'under_review') ? 0.4 : 1, cursor: (!viewedDocs.has(d.id) || d.validation_status !== 'under_review') ? 'not-allowed' : 'pointer' }}
                                  >
                                    <CheckCircle size={14} />
                                    VALIDAR
                                  </button>
                                  <button
                                    className="btn-ghost"
                                    onClick={() => { setRejectingDocId(d.id); setRejectNote(""); }}
                                    disabled={!viewedDocs.has(d.id) || d.validation_status !== 'under_review'}
                                    style={{ flex: 1, padding: '0.6rem', fontSize: '0.65rem', borderRadius: '10px', border: '1px solid var(--danger)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: (!viewedDocs.has(d.id) || d.validation_status !== 'under_review') ? 0.4 : 1, cursor: (!viewedDocs.has(d.id) || d.validation_status !== 'under_review') ? 'not-allowed' : 'pointer' }}
                                  >
                                    <XCircle size={14} />
                                    RECHAZAR
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <input
                                  className="input"
                                  placeholder="Motivo del rechazo..."
                                  value={rejectNote}
                                  onChange={(e) => setRejectNote(e.target.value)}
                                  style={{ fontSize: '0.7rem', padding: '0.5rem 0.75rem' }}
                                  autoFocus
                                />
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                  <button
                                    className="btn-primary"
                                    onClick={() => handleReject(d.id, rejectNote)}
                                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.6rem', borderRadius: '8px', background: 'var(--danger)', border: 'none' }}
                                  >
                                    CONFIRMAR RECHAZO
                                  </button>
                                  <button
                                    className="btn-ghost"
                                    onClick={() => setRejectingDocId(null)}
                                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.6rem', borderRadius: '8px' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* SI ESTÁ VALIDADO */}
                        {d.validation_status === 'validated' && (
                          <div style={{ width: '100%', padding: '0.6rem', background: 'rgba(34, 197, 94, 0.1)', color: '#166534', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.65rem', fontWeight: 800 }}>
                            <CheckCircle size={14} />
                            DOCUMENTO VALIDADO
                          </div>
                        )}

                        {/* SI ESTÁ RECHAZADO */}
                        {d.validation_status === 'rejected' && (
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem' }}>
                              <div style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: '#991b1b', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.65rem', fontWeight: 800 }}>
                                <XCircle size={14} />
                                RECHAZADO
                              </div>
                              <button className="btn-ghost" onClick={() => updateDocStatus(d.id, 'under_review')} style={{ padding: '0.6rem', borderRadius: '10px', border: '1px solid var(--border-light)' }} title="Reabrir para revisión">
                                <RotateCcw size={14} />
                              </button>
                            </div>
                            {d.validation_notes && (
                              <p style={{ fontSize: '0.65rem', color: '#991b1b', margin: 0, padding: '0.4rem 0.6rem', background: 'rgba(239,68,68,0.05)', borderRadius: '6px', lineHeight: 1.4 }}>
                                {d.validation_notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* --- 📝 FALTANTES: DOCUMENTOS NO SUBIDOS (Filtrado por etapa) --- */}
                {documentTypes
                  .filter(type => stageConfig.visibleStages?.includes(type.stage))
                  .filter(type => !documents.some(d => d.recruit_document_types?.id === type.id))
                  .map(missing => (
                    <div
                      key={missing.id}
                      style={{
                        padding: '2rem',
                        border: '2px dashed var(--border-light)',
                        borderRadius: '24px',
                        background: 'rgba(255,255,255,0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '1rem',
                        opacity: 0.6,
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ padding: '0.8rem', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '12px', color: 'var(--text-dim)' }}>
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 800, margin: 0, opacity: 0.8 }}>{missing.label?.toUpperCase() || missing.name.toUpperCase()}</h4>
                        <small className="mono" style={{ fontSize: '0.5rem', color: missing.is_required ? 'var(--warning)' : 'var(--text-dim)' }}>
                          {missing.is_required ? 'REQUISITO OBLIGATORIO' : 'OPCIONAL'}
                        </small>
                      </div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.3rem 0.8rem', background: 'rgba(0,0,0,0.1)', borderRadius: '6px', opacity: 0.4 }}>
                        PENDIENTE DE CARGA
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
