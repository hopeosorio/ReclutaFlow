import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useAuth } from "@/app/AuthProvider";
import { useAppToast } from "@/app/layouts/CrmLayout";
import { formatDateTime } from "@/lib/format";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabaseClient";

interface JobPostingRow {
  id: string;
  title: string;
  branch: string | null;
  area: string | null;
  employment_type: string | null;
  description_short: string | null;
  status: "active" | "paused" | "closed";
}

interface JobProfileRow {
  id: string;
  job_posting_id: string;
  role_summary: string | null;
  requirements: string | null;
  min_education: string | null;
  skills: string | null;
  experience: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  benefits: string | null;
  schedule: string | null;
  salary_range: string | null;
  location_details: string | null;
  growth_plan: string | null;
  internal_notes: string | null;
}

interface ScreeningQuestionRow {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  is_required: boolean;
}

interface DocumentTypeRow {
  id: string;
  name: string;
  label: string;
  stage: "application" | "post_interview" | "onboarding";
  is_required: boolean;
  is_active: boolean;
}

interface TemplateRow {
  id: string;
  template_key: string;
  subject: string;
  body_md: string;
  is_active: boolean;
}

interface TemplateVariableRow {
  variable_key: string;
  label: string;
  description: string | null;
  example_value: string | null;
  is_active: boolean;
  sort_order: number;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: "rh_admin" | "rh_recruiter" | "interviewer";
}

interface StatusRow {
  status_key: string;
  label: string;
  requires_reason: boolean;
  is_active: boolean;
  sort_order: number;
}

interface StatusTransitionRow {
  from_status_key: string;
  to_status_key: string;
  is_active: boolean;
  template_key: string | null;
}

interface EventLogRow {
  id: string;
  event_key: string;
  entity_type: string;
  entity_id: string | null;
  application_id: string | null;
  template_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
  recruit_message_templates: { template_key: string | null; subject: string | null } | null;
}

interface PreviewApplicationRow {
  id: string;
  submitted_at: string;
  recruit_candidates: {
    recruit_persons: {
      first_name: string;
      last_name: string;
      email: string | null;
    } | null;
  } | null;
  recruit_job_postings: {
    title: string | null;
  } | null;
}

interface OnboardingHostRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
}

interface HiredApplicationRow {
  id: string;
  status_key: string;
  updated_at: string;
  traffic_light: "red" | "yellow" | "green" | null;
  recruit_candidates: {
    person_id: string;
    recruit_persons: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; } | null;
  } | null;
  recruit_job_postings: { title: string; branch: string | null; } | null;
  recruit_application_status_history: { status_key: string; changed_at: string; }[];
  rehire_flag?: { color: "red" | "yellow" | "green"; reason: string; set_at: string; } | null;
}

function formatTenure(startStr: string, endStr: string | null): string {
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000);
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays % 30;
  const parts = [];
  if (years > 0) parts.push(`${years} año${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mes${months !== 1 ? 'es' : ''}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} día${days !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

const tabs = [
  { id: "vacantes", label: "Vacantes" },
  { id: "preguntas", label: "Preguntas" },
  { id: "documentos", label: "Documentos" },
  { id: "plantillas", label: "Plantillas" },
  { id: "usuarios", label: "Usuarios" },
  { id: "anfitriones", label: "Anfitriones" },
  { id: "contratados", label: "Contratados" },
  { id: "estatus", label: "Estatus" },
  { id: "metricas", label: "Métricas" },
];

type TemplateVariableDefinition = {
  key: string;
  label: string;
  token: string;
  example: string;
  description?: string | null;
};

const fallbackTemplateVariables: TemplateVariableDefinition[] = [
  { key: "name", label: "Nombre del candidato", token: "{name}", example: "Ana Perez" },
  { key: "job_title", label: "Vacante", token: "{job_title}", example: "Asesor de Ventas" },
  { key: "job_branch", label: "Sucursal", token: "{job_branch}", example: "Sucursal Centro" },
  { key: "schedule_date", label: "Fecha agenda", token: "{schedule_date}", example: "10/03/2026" },
  { key: "schedule_time", label: "Hora agenda", token: "{schedule_time}", example: "10:00" },
  { key: "location", label: "Lugar", token: "{location}", example: "Sucursal Centro, Piso 2" },
  { key: "recruiter_name", label: "Reclutador", token: "{recruiter_name}", example: "Laura Gomez" },
  { key: "interviewer_name", label: "Entrevistador", token: "{interviewer_name}", example: "Carlos Ruiz" },
  { key: "coupon_code", label: "Cupón", token: "{coupon_code}", example: "MEWI-2026" },
  { key: "onboarding_date", label: "Fecha onboarding", token: "{onboarding_date}", example: "17/03/2026" },
  { key: "onboarding_time", label: "Hora onboarding", token: "{onboarding_time}", example: "09:00" },
  { key: "dress_code", label: "Vestimenta", token: "{dress_code}", example: "Formal ejecutivo" },
  { key: "contact_phone", label: "Teléfono contacto", token: "{contact_phone}", example: "55 1234 5678" },
  { key: "contact_email", label: "Correo contacto", token: "{contact_email}", example: "rh@mewi.com" },
];

const buildPreviewValues = (variables: TemplateVariableDefinition[]) =>
  variables.reduce<Record<string, string>>((acc, variable) => {
    acc[variable.key] = variable.example;
    return acc;
  }, {});

const templateVariablePattern = /\{([a-zA-Z0-9_]+)\}/g;

const renderTemplatePreview = (template: string, variables: Record<string, string>) =>
  template.replace(templateVariablePattern, (match, key) => variables[key] ?? match);

const isHtmlContent = (str: string) => /<[a-z][\s\S]*>/i.test(str);

const extractTemplateVariables = (subject: string, body: string) => {
  const matches = new Set<string>();
  const scan = (value: string) => {
    for (const match of value.matchAll(templateVariablePattern)) {
      if (match[1]) matches.add(match[1]);
    }
  };
  scan(subject);
  scan(body);
  return Array.from(matches);
};

const buildTransitionKey = (transition: StatusTransitionRow) =>
  `${transition.from_status_key}__${transition.to_status_key}`;

export default function CrmAdmin() {
  const { profile } = useAuth();
  const { toast } = useAppToast();
  const [activeTab, setActiveTab] = useState("vacantes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<JobPostingRow[]>([]);
  const [jobProfiles, setJobProfiles] = useState<JobProfileRow[]>([]);
  const [questions, setQuestions] = useState<ScreeningQuestionRow[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateVariables, setTemplateVariables] = useState<TemplateVariableRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [transitions, setTransitions] = useState<StatusTransitionRow[]>([]);

  const [jobForm, setJobForm] = useState({
    title: "",
    branch: "",
    area: "",
    employment_type: "",
    description_short: "",
    status: "active",
  });
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobEdits, setJobEdits] = useState<Record<string, { status: JobPostingRow["status"] }>>({});
  const [profileJobId, setProfileJobId] = useState("");
  const [profileForm, setProfileForm] = useState({
    role_summary: "",
    requirements: "",
    min_education: "",
    skills: "",
    experience: "",
    responsibilities: "",
    qualifications: "",
    benefits: "",
    schedule: "",
    salary_range: "",
    location_details: "",
    growth_plan: "",
    internal_notes: "",
  });
  const [profileError, setProfileError] = useState<string | null>(null);

  const [questionJobId, setQuestionJobId] = useState("");
  const [questionForm, setQuestionForm] = useState({
    question_text: "",
    question_type: "text",
    options: "",
    is_required: false,
  });
  const [questionError, setQuestionError] = useState<string | null>(null);

  const [docForm, setDocForm] = useState({
    name: "",
    label: "",
    stage: "application",
    is_required: false,
    is_active: true,
  });
  const [docEdits, setDocEdits] = useState<Record<string, { label: string; stage: DocumentTypeRow["stage"]; is_required: boolean; is_active: boolean }>>({});
  const [docError, setDocError] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({
    template_key: "",
    subject: "",
    body_md: "",
  });
  const [templateEdits, setTemplateEdits] = useState<Record<string, { subject: string; body_md: string; is_active: boolean }>>({});
  const [templateError, setTemplateError] = useState<string | null>(null);

  const templateSubjectRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [variableForm, setVariableForm] = useState({
    variable_key: "",
    label: "",
    description: "",
    example_value: "",
    sort_order: 0,
    is_active: true,
  });
  const [variableEdits, setVariableEdits] = useState<
    Record<string, { label: string; description: string; example_value: string; sort_order: number; is_active: boolean }>
  >({});
  const [variableError, setVariableError] = useState<string | null>(null);

  const [transitionForm, setTransitionForm] = useState({
    from_status_key: "",
    to_status_key: "",
    is_active: true,
    template_key: "",
  });
  const [transitionEdits, setTransitionEdits] = useState<Record<string, { is_active: boolean; template_key: string | null }>>({});
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [statusEdits, setStatusEdits] = useState<Record<string, { label: string; requires_reason: boolean; is_active: boolean; sort_order: number }>>({});
  const [statusError, setStatusError] = useState<string | null>(null);

  const [roleEdits, setRoleEdits] = useState<Record<string, ProfileRow["role"]>>({});
  const [roleError, setRoleError] = useState<string | null>(null);

  const [hosts, setHosts] = useState<OnboardingHostRow[]>([]);
  const [hostForm, setHostForm] = useState({ full_name: "", email: "", phone: "" });
  const [hostSaving, setHostSaving] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  const [hiredApps, setHiredApps] = useState<HiredApplicationRow[]>([]);
  const [hiredSearch, setHiredSearch] = useState("");
  const [descontratarId, setDescontratarId] = useState<string | null>(null);
  const [descontratarForm, setDescontratarForm] = useState({ color: "green" as "red" | "yellow" | "green", reason: "" });
  const [descontratarSaving, setDescontratarSaving] = useState(false);
  const [descontratarError, setDescontratarError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [addEmployeeForm, setAddEmployeeForm] = useState({ first_name: '', last_name: '', email: '', phone: '', job_posting_id: '', hired_at: today });
  const [addEmployeeSaving, setAddEmployeeSaving] = useState(false);
  const [addEmployeeError, setAddEmployeeError] = useState<string | null>(null);

  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricSummary, setMetricSummary] = useState<{ statusChanged: number; emailSent: number; emailFailed: number; statusBreakdown: unknown[] }>({ statusChanged: 0, emailSent: 0, emailFailed: 0, statusBreakdown: [] });
  const [metricEvents, setMetricEvents] = useState<EventLogRow[]>([]);

  const [previewMode, setPreviewMode] = useState<"catalog" | "application">("catalog");
  const [previewApplications, setPreviewApplications] = useState<PreviewApplicationRow[]>([]);
  const [previewApplicationId, setPreviewApplicationId] = useState("");
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [previewListLoading, setPreviewListLoading] = useState(false);
  const [previewDetailsLoading, setPreviewDetailsLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  // ── Plantillas: estado de expansión, form nuevo y email de prueba ────────
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [testEmailMap, setTestEmailMap] = useState<Record<string, string>>({});
  const [sendingTestEmail, setSendingTestEmail] = useState<Record<string, boolean>>({});

  const isAdmin = profile?.role === "rh_admin";
  const statusLabelMap = useMemo(() => {
    return statuses.reduce<Record<string, StatusRow>>((acc, status) => {
      acc[status.status_key] = status;
      return acc;
    }, {});
  }, [statuses]);
  const statusOptions = useMemo(() => {
    const active = statuses.filter((status) => status.is_active);
    return active.length > 0 ? active : statuses;
  }, [statuses]);
  const templateVariableCatalog = useMemo(() => {
    if (templateVariables.length === 0) return [];
    return templateVariables
      .filter((variable) => variable.is_active)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((variable) => ({
        key: variable.variable_key,
        label: variable.label,
        token: `{${variable.variable_key}}`,
        example: variable.example_value ?? variable.label,
        description: variable.description,
      }));
  }, [templateVariables]);
  const usingFallbackCatalog = templateVariables.length === 0;
  const variableCatalog = usingFallbackCatalog ? fallbackTemplateVariables : templateVariableCatalog;
  const catalogPreviewValues = useMemo(() => buildPreviewValues(variableCatalog), [variableCatalog]);
  const previewValues = useMemo(() => {
    if (previewMode === "application" && Object.keys(previewData).length > 0) {
      return { ...catalogPreviewValues, ...previewData };
    }
    return catalogPreviewValues;
  }, [previewMode, previewData, catalogPreviewValues]);
  const variableKeys = useMemo(() => new Set(variableCatalog.map((variable) => variable.key)), [variableCatalog]);
  const eventLabelMap = useMemo(
    () => ({
      status_changed: "Cambio de estatus",
      email_sent: "Correo enviado",
      email_failed: "Correo fallido",
    }),
    [],
  );
  const newTemplateVariables = useMemo(
    () => extractTemplateVariables(templateForm.subject, templateForm.body_md),
    [templateForm.subject, templateForm.body_md],
  );
  const newUnknownVariables = useMemo(
    () => newTemplateVariables.filter((key) => !variableKeys.has(key)),
    [newTemplateVariables, variableKeys],
  );

  const loadAll = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);

    const [
      jobsRes,
      jobProfilesRes,
      docsRes,
      templatesRes,
      variablesRes,
      profilesRes,
      statusesRes,
      transitionsRes,
      hostsRes,
      hiredRes,
      rehireFlagsRes,
    ] = await Promise.all([
      supabase
        .from("recruit_job_postings")
        .select("id, title, branch, area, employment_type, description_short, status")
        .order("created_at", { ascending: false }),
      supabase
        .from("recruit_job_profiles")
        .select(
          "id, job_posting_id, role_summary, requirements, min_education, skills, experience, responsibilities, qualifications, benefits, schedule, salary_range, location_details, growth_plan, internal_notes",
        ),
      supabase
        .from("recruit_document_types")
        .select("id, name, label, stage, is_required, is_active")
        .order("label"),
      supabase
        .from("recruit_message_templates")
        .select("id, template_key, subject, body_md, is_active")
        .order("template_key"),
      supabase
        .from("recruit_template_variables")
        .select("variable_key, label, description, example_value, is_active, sort_order")
        .order("sort_order"),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("full_name"),
      supabase
        .from("recruit_statuses")
        .select("status_key, label, requires_reason, is_active, sort_order")
        .order("sort_order"),
      supabase
        .from("recruit_status_transitions")
        .select("from_status_key, to_status_key, is_active, template_key")
        .order("from_status_key")
        .order("to_status_key"),
      supabase
        .from("recruit_onboarding_hosts")
        .select("id, full_name, email, phone, is_active")
        .order("full_name"),
      supabase
        .from("recruit_applications")
        .select("id, status_key, updated_at, traffic_light, recruit_candidates(person_id, recruit_persons(id, first_name, last_name, email, phone)), recruit_job_postings(title, branch), recruit_application_status_history(status_key, changed_at)")
        .in("status_key", ["hired", "terminated"])
        .order("updated_at", { ascending: false }),
      supabase
        .from("recruit_rehire_flags")
        .select("person_id, color, reason, set_at")
        .order("set_at", { ascending: false }),
    ]);

    if (jobsRes.error) setError(jobsRes.error.message);
    if (jobProfilesRes.error) setError(jobProfilesRes.error.message);
    if (docsRes.error) setError(docsRes.error.message);
    if (templatesRes.error) setError(templatesRes.error.message);
    if (variablesRes.error) setError(variablesRes.error.message);
    if (profilesRes.error) setError(profilesRes.error.message);
    if (statusesRes.error) setError(statusesRes.error.message);
    if (transitionsRes.error) setError(transitionsRes.error.message);
    if (hostsRes.error) setError(hostsRes.error.message);
    if (hiredRes.error) setError(hiredRes.error.message);

    setJobs((jobsRes.data as JobPostingRow[]) ?? []);
    setJobProfiles((jobProfilesRes.data as JobProfileRow[]) ?? []);
    setDocumentTypes((docsRes.data as DocumentTypeRow[]) ?? []);
    setTemplates((templatesRes.data as TemplateRow[]) ?? []);
    setTemplateVariables((variablesRes.data as TemplateVariableRow[]) ?? []);
    setProfiles((profilesRes.data as ProfileRow[]) ?? []);
    setStatuses((statusesRes.data as StatusRow[]) ?? []);
    setTransitions((transitionsRes.data as StatusTransitionRow[]) ?? []);
    setHosts((hostsRes.data as OnboardingHostRow[]) ?? []);
    const flagsByPerson: Record<string, any> = {};
    for (const f of (rehireFlagsRes.data ?? [])) {
      if (!flagsByPerson[f.person_id]) flagsByPerson[f.person_id] = f;
    }
    const hired = ((hiredRes.data ?? []) as any[]).map(app => ({
      ...app,
      recruit_candidates: Array.isArray(app.recruit_candidates) ? app.recruit_candidates[0] : app.recruit_candidates,
      recruit_job_postings: Array.isArray(app.recruit_job_postings) ? app.recruit_job_postings[0] : app.recruit_job_postings,
      rehire_flag: flagsByPerson[
        (Array.isArray(app.recruit_candidates) ? app.recruit_candidates[0] : app.recruit_candidates)?.person_id
      ] ?? null,
    }));
    setHiredApps(hired as HiredApplicationRow[]);
    setTransitionEdits({});

    setLoading(false);
  };

  const loadMetrics = async () => {
    if (!isAdmin) return;
    setMetricsLoading(true);
    setMetricsError(null);

    const { data, error: metricsLoadError } = await supabase.functions.invoke("get_crm_metrics");

    if (metricsLoadError || data?.error) {
      setMetricsError(metricsLoadError?.message || data?.error || "Error al cargar métricas.");
      setMetricEvents([]);
      setMetricSummary({ statusChanged: 0, emailSent: 0, emailFailed: 0, statusBreakdown: [] });
    } else {
      const summary = data?.summary || {};
      setMetricEvents(data?.recent_events || []);
      setMetricSummary({
        statusChanged: summary.total_applications || 0,
        emailSent: summary.emails_sent || 0,
        emailFailed: summary.emails_failed || 0,
        statusBreakdown: summary.status_breakdown || [], // Guardamos el desglose estratégico
      });
    }

    setMetricsLoading(false);
  };

  const loadPreviewApplications = async () => {
    if (!isAdmin) return;
    setPreviewListLoading(true);
    setPreviewError(null);

    const { data, error: previewLoadError } = await supabase
      .from("recruit_applications")
      .select(
        "id, submitted_at, recruit_candidates(recruit_persons(first_name, last_name, email)), recruit_job_postings(title)",
      )
      .order("submitted_at", { ascending: false })
      .limit(10);

    if (previewLoadError) {
      setPreviewError(previewLoadError.message);
      setPreviewApplications([]);
    } else {
      setPreviewApplications((data as unknown as PreviewApplicationRow[]) ?? []);
    }

    setPreviewLoaded(true);
    setPreviewListLoading(false);
  };

  const loadPreviewData = async (applicationId: string) => {
    if (!applicationId) return;
    setPreviewDetailsLoading(true);
    setPreviewError(null);

    const { data, error: functionError } = await supabase.functions.invoke("get_application_preview", {
      body: { application_id: applicationId },
    });

    if (functionError || data?.error) {
      setPreviewError(functionError?.message || data?.error || "Error al cargar previsualización.");
      setPreviewData({});
    } else {
      setPreviewData(data?.variables || {});
    }

    setPreviewDetailsLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab !== "metricas") return;
    loadMetrics();
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab !== "plantillas" || previewLoaded) return;
    loadPreviewApplications();
  }, [activeTab, previewLoaded, isAdmin]);

  useEffect(() => {
    if (previewMode !== "application") return;
    if (!previewApplicationId) {
      setPreviewData({});
      return;
    }
    loadPreviewData(previewApplicationId);
  }, [previewMode, previewApplicationId]);

  useEffect(() => {
    if (!questionJobId && jobs.length > 0) {
      setQuestionJobId(jobs[0].id);
    }
  }, [jobs, questionJobId]);

  useEffect(() => {
    if (!profileJobId && jobs.length > 0) {
      setProfileJobId(jobs[0].id);
    }
  }, [jobs, profileJobId]);

  useEffect(() => {
    const profile = jobProfiles.find((item) => item.job_posting_id === profileJobId);
    setProfileForm({
      role_summary: profile?.role_summary ?? "",
      requirements: profile?.requirements ?? "",
      min_education: profile?.min_education ?? "",
      skills: profile?.skills ?? "",
      experience: profile?.experience ?? "",
      responsibilities: profile?.responsibilities ?? "",
      qualifications: profile?.qualifications ?? "",
      benefits: profile?.benefits ?? "",
      schedule: profile?.schedule ?? "",
      salary_range: profile?.salary_range ?? "",
      location_details: profile?.location_details ?? "",
      growth_plan: profile?.growth_plan ?? "",
      internal_notes: profile?.internal_notes ?? "",
    });
  }, [profileJobId, jobProfiles]);

  useEffect(() => {
    if (statuses.length === 0) return;
    setTransitionForm((prev) => {
      const fromStatus = prev.from_status_key || statuses[0].status_key;
      let toStatus = prev.to_status_key;
      if (!toStatus) {
        const fallback = statuses.find((status) => status.status_key !== fromStatus) ?? statuses[0];
        toStatus = fallback.status_key;
      }
      if (fromStatus === prev.from_status_key && toStatus === prev.to_status_key) {
        return prev;
      }
      return { ...prev, from_status_key: fromStatus, to_status_key: toStatus };
    });
  }, [statuses]);

  useEffect(() => {
    const loadQuestions = async () => {
      if (!questionJobId) {
        setQuestions([]);
        return;
      }
      const { data, error: questionLoadError } = await supabase
        .from("recruit_screening_questions")
        .select("id, question_text, question_type, options, is_required")
        .eq("job_posting_id", questionJobId)
        .order("created_at", { ascending: false });

      if (questionLoadError) {
        setQuestionError(questionLoadError.message);
        return;
      }

      const parsed = (data ?? []).map((row) => ({
        ...row,
        options: Array.isArray(row.options) ? (row.options as string[]) : null,
      })) as ScreeningQuestionRow[];

      setQuestions(parsed);
    };

    loadQuestions();
  }, [questionJobId]);

  if (!isAdmin) {
    return (
      <section className="crm-section">
        <h2>Acceso restringido</h2>
        <p>Esta sección está disponible solo para RH Admin.</p>
      </section>
    );
  }

  if (loading) return null;

  const handleJobSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setJobError(null);
    if (!jobForm.title.trim()) {
      setJobError("El título es obligatorio.");
      return;
    }

    const { error: insertError } = await supabase.from("recruit_job_postings").insert({
      title: jobForm.title.trim(),
      branch: jobForm.branch.trim() || null,
      area: jobForm.area.trim() || null,
      employment_type: jobForm.employment_type.trim() || null,
      description_short: jobForm.description_short.trim() || null,
      status: jobForm.status,
    });

    if (insertError) {
      setJobError(insertError.message);
      return;
    }

    setJobForm({ title: "", branch: "", area: "", employment_type: "", description_short: "", status: "active" });
    toast.success("Vacante creada correctamente");
    await loadAll();
  };

  const handleJobStatusSave = async (job: JobPostingRow) => {
    const edit = jobEdits[job.id];
    if (!edit || edit.status === job.status) return;
    const { error: updateError } = await supabase
      .from("recruit_job_postings")
      .update({ status: edit.status })
      .eq("id", job.id);

    if (updateError) {
      setJobError(updateError.message);
      toast.error(`Error al actualizar: ${updateError.message}`);
      return;
    }
    toast.success("Estatus de vacante actualizado");
    await loadAll();
  };

  const handleQuestionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setQuestionError(null);
    if (!questionJobId) {
      setQuestionError("Selecciona una vacante primero.");
      return;
    }
    if (!questionForm.question_text.trim()) {
      setQuestionError("La pregunta es obligatoria.");
      return;
    }

    const needsOptions = ["single_choice", "multi_choice"].includes(questionForm.question_type);
    const options = needsOptions
      ? questionForm.options
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      : null;

    const { error: insertError } = await supabase.from("recruit_screening_questions").insert({
      job_posting_id: questionJobId,
      question_text: questionForm.question_text.trim(),
      question_type: questionForm.question_type,
      options,
      is_required: questionForm.is_required,
    });

    if (insertError) {
      setQuestionError(insertError.message);
      return;
    }

    setQuestionForm({ question_text: "", question_type: "text", options: "", is_required: false });
    toast.success("Pregunta agregada al cuestionario");
    const { data, error: questionLoadError } = await supabase
      .from("recruit_screening_questions")
      .select("id, question_text, question_type, options, is_required")
      .eq("job_posting_id", questionJobId)
      .order("created_at", { ascending: false });

    if (!questionLoadError) {
      const parsed = (data ?? []).map((row) => ({
        ...row,
        options: Array.isArray(row.options) ? (row.options as string[]) : null,
      })) as ScreeningQuestionRow[];
      setQuestions(parsed);
    }
  };

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();
    setProfileError(null);
    if (!profileJobId) {
      setProfileError("Selecciona una vacante.");
      return;
    }

    const { error: upsertError } = await supabase.from("recruit_job_profiles").upsert(
      {
        job_posting_id: profileJobId,
        role_summary: profileForm.role_summary.trim() || null,
        requirements: profileForm.requirements.trim() || null,
        min_education: profileForm.min_education.trim() || null,
        skills: profileForm.skills.trim() || null,
        experience: profileForm.experience.trim() || null,
        responsibilities: profileForm.responsibilities.trim() || null,
        qualifications: profileForm.qualifications.trim() || null,
        benefits: profileForm.benefits.trim() || null,
        schedule: profileForm.schedule.trim() || null,
        salary_range: profileForm.salary_range.trim() || null,
        location_details: profileForm.location_details.trim() || null,
        growth_plan: profileForm.growth_plan.trim() || null,
        internal_notes: profileForm.internal_notes.trim() || null,
      },
      { onConflict: "job_posting_id" },
    );

    if (upsertError) {
      setProfileError(upsertError.message);
      return;
    }

    await loadAll();
  };

  const handleQuestionDelete = async (questionId: string) => {
    setQuestionError(null);
    const { error: deleteError } = await supabase
      .from("recruit_screening_questions")
      .delete()
      .eq("id", questionId);

    if (deleteError) {
      setQuestionError(deleteError.message);
      toast.error(`Error al eliminar: ${deleteError.message}`);
      return;
    }
    setQuestions((prev) => prev.filter((question) => question.id !== questionId));
    toast.success("Pregunta eliminada");
  };

  const handleDocSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setDocError(null);
    if (!docForm.name.trim() || !docForm.label.trim()) {
      setDocError("El nombre técnico y la etiqueta son obligatorios.");
      return;
    }

    const { error: insertError } = await supabase.from("recruit_document_types").insert({
      name: docForm.name.trim(),
      label: docForm.label.trim(),
      stage: docForm.stage,
      is_required: docForm.is_required,
      is_active: docForm.is_active,
    });

    if (insertError) {
      setDocError(insertError.message);
      return;
    }

    setDocForm({ name: "", label: "", stage: "application", is_required: false, is_active: true });
    toast.success("Tipo de documento agregado");
    await loadAll();
  };

  const handleDocSave = async (doc: DocumentTypeRow) => {
    const edit = docEdits[doc.id];
    if (
      !edit ||
      (edit.label === doc.label &&
        edit.stage === doc.stage &&
        edit.is_required === doc.is_required &&
        edit.is_active === doc.is_active)
    ) return;

    const { error: updateError } = await supabase
      .from("recruit_document_types")
      .update({ label: edit.label, stage: edit.stage, is_required: edit.is_required, is_active: edit.is_active })
      .eq("id", doc.id);

    if (updateError) {
      setDocError(updateError.message);
      toast.error(`Error al guardar: ${updateError.message}`);
      return;
    }
    toast.success("Documento actualizado");
    await loadAll();
  };

  const handleTransitionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTransitionError(null);
    if (!transitionForm.from_status_key || !transitionForm.to_status_key) {
      setTransitionError("Selecciona ambos estatus.");
      return;
    }
    if (transitionForm.from_status_key === transitionForm.to_status_key) {
      setTransitionError("El estatus origen y destino deben ser distintos.");
      return;
    }
    const alreadyExists = transitions.some(
      (t) => t.from_status_key === transitionForm.from_status_key && t.to_status_key === transitionForm.to_status_key,
    );
    if (alreadyExists) {
      setTransitionError("Esa transición ya existe. Edítala directamente en la lista.");
      return;
    }

    const { error: upsertError } = await supabase.from("recruit_status_transitions").upsert(
      {
        from_status_key: transitionForm.from_status_key,
        to_status_key: transitionForm.to_status_key,
        template_key: transitionForm.template_key || null,
        is_active: transitionForm.is_active,
      },
      { onConflict: "from_status_key,to_status_key" },
    );

    if (upsertError) {
      setTransitionError(upsertError.message);
      toast.error(`Error al guardar transición: ${upsertError.message}`);
      return;
    }
    toast.success("Transición de estatus guardada");
    setTransitionForm((prev) => ({ ...prev, is_active: true }));
    await loadAll();
  };

  const handleTransitionSave = async (transition: StatusTransitionRow) => {
    const key = buildTransitionKey(transition);
    const edit = transitionEdits[key] ?? {
      is_active: transition.is_active,
      template_key: transition.template_key ?? null,
    };
    const templateKey = edit.template_key || null;

    const { error: updateError } = await supabase
      .from("recruit_status_transitions")
      .update({ is_active: edit.is_active, template_key: templateKey })
      .eq("from_status_key", transition.from_status_key)
      .eq("to_status_key", transition.to_status_key);

    if (updateError) {
      setTransitionError(updateError.message);
      toast.error(`Error: ${updateError.message}`);
      return;
    }

    toast.success("Transición guardada.");
    await loadAll();
  };

  const handleTransitionDelete = async (transition: StatusTransitionRow) => {
    setTransitionError(null);
    const { error: deleteError } = await supabase
      .from("recruit_status_transitions")
      .delete()
      .eq("from_status_key", transition.from_status_key)
      .eq("to_status_key", transition.to_status_key);

    if (deleteError) {
      setTransitionError(deleteError.message);
      return;
    }

    setTransitions((prev) =>
      prev.filter(
        (row) =>
          row.from_status_key !== transition.from_status_key || row.to_status_key !== transition.to_status_key,
      ),
    );
  };

  const handleStatusSave = async (status: StatusRow) => {
    setStatusError(null);
    const edit = statusEdits[status.status_key];
    if (!edit) return;
    const { error: updateError } = await supabase
      .from("recruit_statuses")
      .update({
        label: edit.label.trim(),
        requires_reason: edit.requires_reason,
        is_active: edit.is_active,
        sort_order: edit.sort_order,
      })
      .eq("status_key", status.status_key);
    if (updateError) { setStatusError(updateError.message); return; }
    setStatuses((prev) =>
      prev.map((s) => s.status_key === status.status_key ? { ...s, ...edit } : s),
    );
    toast.success(`Estatus "${edit.label}" actualizado.`);
  };

  const handleVariableSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setVariableError(null);

    const rawKey = variableForm.variable_key.trim().toLowerCase();
    if (!rawKey) {
      setVariableError("La clave es obligatoria.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(rawKey)) {
      setVariableError("La clave solo puede usar letras, números y guion bajo.");
      return;
    }
    if (!variableForm.label.trim()) {
      setVariableError("La etiqueta es obligatoria.");
      return;
    }

    const { error: insertError } = await supabase.from("recruit_template_variables").insert({
      variable_key: rawKey,
      label: variableForm.label.trim(),
      description: variableForm.description.trim() || null,
      example_value: variableForm.example_value.trim() || null,
      sort_order: Number.isFinite(variableForm.sort_order) ? variableForm.sort_order : 0,
      is_active: variableForm.is_active,
    });

    if (insertError) {
      setVariableError(insertError.message);
      return;
    }

    setVariableForm({
      variable_key: "",
      label: "",
      description: "",
      example_value: "",
      sort_order: 0,
      is_active: true,
    });
    await loadAll();
  };

  const handleVariableSave = async (variable: TemplateVariableRow) => {
    const edit = variableEdits[variable.variable_key];
    if (!edit) return;

    const nextPayload = {
      label: edit.label.trim(),
      description: edit.description.trim() || null,
      example_value: edit.example_value.trim() || null,
      sort_order: edit.sort_order,
      is_active: edit.is_active,
    };

    if (
      nextPayload.label === variable.label &&
      nextPayload.description === variable.description &&
      nextPayload.example_value === variable.example_value &&
      nextPayload.sort_order === variable.sort_order &&
      nextPayload.is_active === variable.is_active
    ) {
      return;
    }

    const { error: updateError } = await supabase
      .from("recruit_template_variables")
      .update(nextPayload)
      .eq("variable_key", variable.variable_key);

    if (updateError) {
      setVariableError(updateError.message);
      return;
    }

    await loadAll();
  };

  const handleVariableDelete = async (variable: TemplateVariableRow) => {
    setVariableError(null);
    const { error: deleteError } = await supabase
      .from("recruit_template_variables")
      .delete()
      .eq("variable_key", variable.variable_key);

    if (deleteError) {
      setVariableError(deleteError.message);
      return;
    }

    setTemplateVariables((prev) => prev.filter((row) => row.variable_key !== variable.variable_key));
  };

  const handleSendTestEmail = async (template: TemplateRow, toAddress: string) => {
    if (!toAddress.trim()) {
      toast.error("Ingresa un correo destino para la prueba.");
      return;
    }
    if (!previewApplicationId) {
      toast.error("Selecciona una solicitud real en 'Datos para vista previa' antes de enviar la prueba.");
      return;
    }
    setSendingTestEmail((prev) => ({ ...prev, [template.id]: true }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const body: Record<string, unknown> = {
        template_key: template.template_key,
        to_address: toAddress.trim(),
        application_id: previewApplicationId,
      };
      const res = await fetch(`${supabaseUrl}/functions/v1/send_email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey ?? "",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(`Email de prueba enviado a ${toAddress.trim()}`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Error: ${err.error ?? err.message ?? "No se pudo enviar"}`);
      }
    } catch {
      toast.error("Error al enviar email de prueba.");
    } finally {
      setSendingTestEmail((prev) => ({ ...prev, [template.id]: false }));
    }
  };

  const handleTemplateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTemplateError(null);
    if (!templateForm.template_key.trim() || !templateForm.subject.trim() || !templateForm.body_md.trim()) {
      setTemplateError("Completa todos los campos de la plantilla.");
      return;
    }

    const { error: insertError } = await supabase.from("recruit_message_templates").insert({
      template_key: templateForm.template_key.trim(),
      subject: templateForm.subject.trim(),
      body_md: templateForm.body_md.trim(),
      is_active: true,
    });

    if (insertError) {
      setTemplateError(insertError.message);
      return;
    }

    setTemplateForm({ template_key: "", subject: "", body_md: "" });
    await loadAll();
  };

  const handleTemplateSave = async (template: TemplateRow) => {
    const edit = templateEdits[template.id];
    if (!edit) return;

    const { error: updateError } = await supabase
      .from("recruit_message_templates")
      .update({
        subject: edit.subject.trim(),
        body_md: edit.body_md.trim(),
        is_active: edit.is_active,
      })
      .eq("id", template.id);

    if (updateError) {
      setTemplateError(updateError.message);
      return;
    }

    await loadAll();
  };

  const handleRoleSave = async (profileRow: ProfileRow) => {
    const nextRole = roleEdits[profileRow.id];
    if (!nextRole || nextRole === profileRow.role) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", profileRow.id);

    if (updateError) {
      setRoleError(updateError.message);
      return;
    }

    await loadAll();
  };

  const handleHostSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHostError(null);
    if (!hostForm.full_name.trim() || !hostForm.email.trim()) {
      setHostError("Nombre y correo son obligatorios.");
      return;
    }
    setHostSaving(true);
    const { error: insertError } = await supabase
      .from("recruit_onboarding_hosts")
      .insert({ full_name: hostForm.full_name.trim(), email: hostForm.email.trim(), phone: hostForm.phone.trim() || null });
    setHostSaving(false);
    if (insertError) { setHostError(insertError.message); return; }
    setHostForm({ full_name: "", email: "", phone: "" });
    await loadAll();
  };

  const toggleHostActive = async (host: OnboardingHostRow) => {
    await supabase.from("recruit_onboarding_hosts").update({ is_active: !host.is_active }).eq("id", host.id);
    await loadAll();
  };

  const handleAddEmployee = async (e: FormEvent) => {
    e.preventDefault();
    setAddEmployeeError(null);
    const f = addEmployeeForm;
    if (!f.first_name.trim() || !f.last_name.trim() || !f.job_posting_id) {
      setAddEmployeeError("Nombre, apellido y vacante son obligatorios.");
      return;
    }
    setAddEmployeeSaving(true);
    try {
      const { error } = await supabase.rpc('register_existing_employee', {
        p_first_name: f.first_name.trim(),
        p_last_name: f.last_name.trim(),
        p_email: f.email.trim(),
        p_phone: f.phone.trim(),
        p_job_posting_id: f.job_posting_id,
        p_hired_at: new Date(f.hired_at + 'T12:00:00').toISOString(),
        p_assigned_to: profile?.id ?? null,
      });
      if (error) throw error;

      setShowAddEmployee(false);
      setAddEmployeeForm({ first_name: '', last_name: '', email: '', phone: '', job_posting_id: '', hired_at: today });
      await loadAll();
    } catch (err: any) {
      setAddEmployeeError(err.message);
    }
    setAddEmployeeSaving(false);
  };

  const handleDescontratar = async (e: FormEvent) => {
    e.preventDefault();
    setDescontratarError(null);
    if (!descontratarForm.reason.trim()) {
      setDescontratarError("El motivo de salida es obligatorio.");
      return;
    }
    const app = hiredApps.find(a => a.id === descontratarId);
    const personId = app?.recruit_candidates?.person_id;
    if (!personId) { setDescontratarError("No se encontró el perfil del empleado."); return; }
    setDescontratarSaving(true);
    // 1. Guardar semáforo de recontratación
    await supabase.from("recruit_rehire_flags").delete().eq("person_id", personId);
    const { error } = await supabase
      .from("recruit_rehire_flags")
      .insert({ person_id: personId, color: descontratarForm.color, reason: descontratarForm.reason.trim(), set_by: profile?.id });
    if (error) { setDescontratarSaving(false); setDescontratarError(error.message); return; }
    // 2. Cambiar estatus a terminated via edge function
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token && descontratarId) {
      await fetch(`${supabaseUrl}/functions/v1/change_status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": supabaseAnonKey! },
        body: JSON.stringify({ application_id: descontratarId, status_key: "terminated", reason: descontratarForm.reason.trim() }),
      });
    }
    setDescontratarSaving(false);
    setDescontratarId(null);
    setDescontratarForm({ color: "green", reason: "" });
    await loadAll();
  };

  return (
    <section className="crm-section">
      <div className="crm-header">
        <div>
          <p className="eyebrow">// CONSOLA CENTRAL RH</p>
          <h2 style={{ fontSize: '3rem', letterSpacing: '-0.05em' }}>Configuración Base</h2>
          <p>Control total sobre vacantes, flujos operativos y comunicaciones.</p>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <div className="admin-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn-ghost ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "vacantes" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Vacantes activas</h3>
              <form className="form-grid" onSubmit={handleJobSubmit}>
                <label>
                  Título de la vacante
                  <input
                    className="input"
                    value={jobForm.title}
                    onChange={(event) => setJobForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </label>
                <label>
                  Área
                  <input
                    className="input"
                    value={jobForm.area}
                    onChange={(event) => setJobForm((prev) => ({ ...prev, area: event.target.value }))}
                  />
                </label>
                <label>
                  Sucursal
                  <input
                    className="input"
                    value={jobForm.branch}
                    onChange={(event) => setJobForm((prev) => ({ ...prev, branch: event.target.value }))}
                  />
                </label>
                <label>
                  Tipo de empleo
                  <input
                    className="input"
                    value={jobForm.employment_type}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, employment_type: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Descripción corta
                  <input
                    className="input"
                    value={jobForm.description_short}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, description_short: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Estatus
                  <select
                    className="input"
                    value={jobForm.status}
                    onChange={(event) => setJobForm((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="active">Activa</option>
                    <option value="paused">Pausada</option>
                    <option value="closed">Cerrada</option>
                  </select>
                </label>
                <div className="form-actions">
                  <button className="btn-primary" type="submit">
                    Crear vacante
                  </button>
                </div>
              </form>
              {jobError ? <p className="error">{jobError}</p> : null}
            </div>
            <div className="table">
              <div className="table-row table-head table-row--admin">
                <span>Vacante</span>
                <span>Área / Sucursal</span>
                <span>Estatus</span>
                <span></span>
              </div>
              {jobs.map((job) => {
                const edit = jobEdits[job.id] ?? { status: job.status };
                return (
                  <div className="table-row table-row--admin" key={job.id}>
                    <span className="table-primary">
                      <strong>{job.title}</strong>
                      <small>{job.description_short ?? "Sin descripción"}</small>
                    </span>
                    <span>{`${job.area ?? ""} ${job.branch ? `· ${job.branch}` : ""}`}</span>
                    <span>
                      <select
                        className="input"
                        value={edit.status}
                        onChange={(event) =>
                          setJobEdits((prev) => ({
                            ...prev,
                            [job.id]: { status: event.target.value as JobPostingRow["status"] },
                          }))
                        }
                      >
                        <option value="active">Activa</option>
                        <option value="paused">Pausada</option>
                        <option value="closed">Cerrada</option>
                      </select>
                    </span>
                    <span>
                      <button className="btn-ghost" type="button" onClick={() => handleJobStatusSave(job)}>
                        Guardar
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <h3>Perfil de puesto</h3>
              <p className="lead">Define requisitos y perfil del rol.</p>
              <label>
                Vacante
                <select
                  className="input"
                  value={profileJobId}
                  onChange={(event) => setProfileJobId(event.target.value)}
                >
                  <option value="">Selecciona</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </label>
              <form className="form-grid" onSubmit={handleProfileSave}>
                <label>
                  Resumen del rol
                  <textarea
                    className="input"
                    value={profileForm.role_summary}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, role_summary: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Requisitos
                  <textarea
                    className="input"
                    value={profileForm.requirements}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, requirements: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Escolaridad mínima
                  <select
                    className="input"
                    value={profileForm.min_education}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, min_education: event.target.value }))
                    }
                  >
                    <option value="">No requerida / Indistinto</option>
                    <option value="Primaria">Primaria</option>
                    <option value="Secundaria">Secundaria</option>
                    <option value="Bachillerato">Bachillerato / Preparatoria</option>
                    <option value="Técnico">Técnico / TSU</option>
                    <option value="Licenciatura Trunca">Licenciatura Trunca</option>
                    <option value="Licenciatura">Licenciatura / Ingeniería</option>
                    <option value="Maestría">Maestría</option>
                    <option value="Doctorado">Doctorado</option>
                  </select>
                </label>
                <label>
                  Horario
                  <input
                    className="input"
                    value={profileForm.schedule}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, schedule: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Rango salarial
                  <input
                    className="input"
                    value={profileForm.salary_range}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, salary_range: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Ubicación
                  <input
                    className="input"
                    value={profileForm.location_details}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, location_details: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Habilidades clave
                  <textarea
                    className="input"
                    value={profileForm.skills}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, skills: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Experiencia deseada
                  <textarea
                    className="input"
                    value={profileForm.experience}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, experience: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Responsabilidades
                  <textarea
                    className="input"
                    value={profileForm.responsibilities}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, responsibilities: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Competencias / Calificaciones
                  <textarea
                    className="input"
                    value={profileForm.qualifications}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, qualifications: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Beneficios
                  <textarea
                    className="input"
                    value={profileForm.benefits}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, benefits: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Plan de crecimiento
                  <textarea
                    className="input"
                    value={profileForm.growth_plan}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, growth_plan: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Notas internas (no visible al candidato)
                  <textarea
                    className="input"
                    value={profileForm.internal_notes}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, internal_notes: event.target.value }))
                    }
                  />
                </label>
                <div className="form-actions">
                  <button className="btn-ghost" type="submit">
                    Guardar perfil
                  </button>
                </div>
              </form>
              {profileError ? <p className="error">{profileError}</p> : null}
            </div>
          </div>
        ) : null}

        {activeTab === "preguntas" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Preguntas rápidas por vacante</h3>
              <form className="form-grid" onSubmit={handleQuestionSubmit}>
                <label>
                  Vacante
                  <select
                    className="input"
                    value={questionJobId}
                    onChange={(event) => setQuestionJobId(event.target.value)}
                  >
                    <option value="">Selecciona</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Pregunta
                  <input
                    className="input"
                    value={questionForm.question_text}
                    onChange={(event) =>
                      setQuestionForm((prev) => ({ ...prev, question_text: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Tipo
                  <select
                    className="input"
                    value={questionForm.question_type}
                    onChange={(event) =>
                      setQuestionForm((prev) => ({ ...prev, question_type: event.target.value }))
                    }
                  >
                    <option value="text">Texto</option>
                    <option value="boolean">Sí / No</option>
                    <option value="single_choice">Selección única</option>
                    <option value="multi_choice">Selección múltiple</option>
                    <option value="number">Número</option>
                  </select>
                </label>
                <label>
                  Opciones (separadas por coma)
                  <input
                    className="input"
                    value={questionForm.options}
                    onChange={(event) => setQuestionForm((prev) => ({ ...prev, options: event.target.value }))}
                    placeholder="Solo para selección"
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={questionForm.is_required}
                    onChange={(event) =>
                      setQuestionForm((prev) => ({ ...prev, is_required: event.target.checked }))
                    }
                  />
                  Obligatoria
                </label>
                <div className="form-actions">
                  <button className="btn-primary" type="submit">
                    Agregar pregunta
                  </button>
                </div>
              </form>
              {questionError ? <p className="error">{questionError}</p> : null}
            </div>
            <div className="table">
              {questions.length === 0 ? (
                <p>No hay preguntas configuradas.</p>
              ) : (
                questions.map((question) => (
                  <div className="table-row table-row--admin" key={question.id}>
                    <span className="table-primary">
                      <strong>{question.question_text}</strong>
                      <small>{question.question_type}</small>
                    </span>
                    <span>{question.options?.join(", ") ?? "—"}</span>
                    <span>{question.is_required ? "Obligatoria" : "Opcional"}</span>
                    <span>
                      <button
                        className="btn-ghost"
                        type="button"
                        onClick={() => handleQuestionDelete(question.id)}
                      >
                        Eliminar
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "documentos" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Checklist de documentos</h3>
              <p className="lead">
                Define qué documentos se solicitan en cada etapa del proceso. Los inactivos no se muestran al candidato ni al reclutador.
              </p>
              <form className="form-grid" onSubmit={handleDocSubmit}>
                <label>
                  Etiqueta (nombre visible)
                  <input
                    className="input"
                    placeholder="Ej: Acta de nacimiento"
                    value={docForm.label}
                    onChange={(event) => setDocForm((prev) => ({ ...prev, label: event.target.value }))}
                  />
                </label>
                <label>
                  Nombre técnico (clave única)
                  <input
                    className="input"
                    placeholder="Ej: acta_nacimiento"
                    value={docForm.name}
                    onChange={(event) =>
                      setDocForm((prev) => ({
                        ...prev,
                        name: event.target.value.toLowerCase().replace(/\s+/g, "_"),
                      }))
                    }
                  />
                </label>
                <label>
                  Etapa
                  <select
                    className="input"
                    value={docForm.stage}
                    onChange={(event) => setDocForm((prev) => ({ ...prev, stage: event.target.value }))}
                  >
                    <option value="application">Solicitud</option>
                    <option value="post_interview">Post-entrevista</option>
                    <option value="onboarding">Onboarding</option>
                  </select>
                </label>
                <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", paddingTop: "1.4rem" }}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={docForm.is_required}
                      onChange={(event) => setDocForm((prev) => ({ ...prev, is_required: event.target.checked }))}
                    />
                    Obligatorio
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={docForm.is_active}
                      onChange={(event) => setDocForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                    />
                    Activo
                  </label>
                </div>
                <div className="form-actions">
                  <button className="btn-primary" type="submit">
                    Agregar documento
                  </button>
                </div>
              </form>
              {docError ? <p className="error">{docError}</p> : null}
            </div>
            <div className="table">
              <div className="table-row table-head" style={{ gridTemplateColumns: "2fr 1fr 90px 90px 80px" }}>
                <span>Documento</span>
                <span>Etapa</span>
                <span>Obligatorio</span>
                <span>Activo</span>
                <span></span>
              </div>
              {documentTypes.map((doc) => {
                const edit = docEdits[doc.id] ?? {
                  label: doc.label,
                  stage: doc.stage,
                  is_required: doc.is_required,
                  is_active: doc.is_active,
                };
                return (
                  <div
                    className="table-row"
                    key={doc.id}
                    style={{
                      gridTemplateColumns: "2fr 1fr 90px 90px 80px",
                      opacity: edit.is_active ? 1 : 0.45,
                    }}
                  >
                    <span className="table-primary">
                      <input
                        className="input"
                        value={edit.label}
                        onChange={(event) =>
                          setDocEdits((prev) => ({ ...prev, [doc.id]: { ...edit, label: event.target.value } }))
                        }
                      />
                      <small style={{ opacity: 0.45, fontSize: "0.6rem" }}>{doc.name}</small>
                    </span>
                    <span>
                      <select
                        className="input"
                        value={edit.stage}
                        onChange={(event) =>
                          setDocEdits((prev) => ({
                            ...prev,
                            [doc.id]: { ...edit, stage: event.target.value as DocumentTypeRow["stage"] },
                          }))
                        }
                      >
                        <option value="application">Solicitud</option>
                        <option value="post_interview">Post-entrevista</option>
                        <option value="onboarding">Onboarding</option>
                      </select>
                    </span>
                    <span style={{ display: "flex", justifyContent: "center" }}>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={edit.is_required}
                          onChange={(event) =>
                            setDocEdits((prev) => ({ ...prev, [doc.id]: { ...edit, is_required: event.target.checked } }))
                          }
                        />
                        {edit.is_required ? "Sí" : "No"}
                      </label>
                    </span>
                    <span style={{ display: "flex", justifyContent: "center" }}>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={edit.is_active}
                          onChange={(event) =>
                            setDocEdits((prev) => ({ ...prev, [doc.id]: { ...edit, is_active: event.target.checked } }))
                          }
                        />
                        {edit.is_active ? "Sí" : "No"}
                      </label>
                    </span>
                    <span>
                      <button className="btn-ghost" type="button" onClick={() => handleDocSave(doc)}>
                        Guardar
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTab === "plantillas" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Plantillas de correo</h3>
              <p className="lead">Edita asuntos y contenidos con variables dinámicas. Las llaves <code>{"{variable}"}</code> se reemplazan al enviar el correo.</p>
            </div>
            <div className="card">
              <h4>Datos para vista previa</h4>
              <p className="lead">Elige cómo se reemplazan las variables al previsualizar.</p>
              <div className="form-grid">
                <label>
                  Modo
                  <select
                    className="input"
                    value={previewMode}
                    onChange={(event) =>
                      setPreviewMode(event.target.value as "catalog" | "application")
                    }
                  >
                    <option value="catalog">Ejemplos del catálogo</option>
                    <option value="application">Solicitud real</option>
                  </select>
                </label>
                {previewMode === "application" ? (
                  <label>
                    Solicitud
                    <select
                      className="input"
                      value={previewApplicationId}
                      onChange={(event) => setPreviewApplicationId(event.target.value)}
                    >
                      <option value="">Selecciona</option>
                      {previewApplications.map((app) => {
                        const person = app.recruit_candidates?.recruit_persons;
                        const name =
                          `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Candidato";
                        const jobTitle = app.recruit_job_postings?.title ?? "Sin vacante";
                        return (
                          <option key={app.id} value={app.id}>
                            {name} · {jobTitle}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                ) : null}
              </div>
              {previewListLoading ? <p className="helper">Cargando solicitudes recientes...</p> : null}
              {previewDetailsLoading ? <p className="helper">Cargando datos de la solicitud...</p> : null}
              {previewError ? <p className="error">{previewError}</p> : null}
              {previewMode === "application" && previewApplications.length === 0 && !previewListLoading ? (
                <p className="helper">No hay solicitudes recientes para usar en la vista previa.</p>
              ) : null}
            </div>
            {/* ── Nueva plantilla (colapsable) ── */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h4 style={{ margin: 0 }}>Nueva plantilla</h4>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => setShowNewTemplate((v) => !v)}
                >
                  {showNewTemplate ? "▲ Ocultar" : "▼ Crear nueva"}
                </button>
              </div>
              {showNewTemplate ? (
                <div className="template-editor" style={{ marginTop: "1rem" }}>
                  <form className="template-editor__form" onSubmit={handleTemplateSubmit}>
                    <div className="form-grid">
                      <label>
                        Clave
                        <input
                          className="input"
                          value={templateForm.template_key}
                          onChange={(event) =>
                            setTemplateForm((prev) => ({ ...prev, template_key: event.target.value }))
                          }
                        />
                      </label>
                      <label>
                        Asunto
                        <input
                          className="input"
                          value={templateForm.subject}
                          ref={(node) => { templateSubjectRefs.current["new"] = node; }}
                          onChange={(event) =>
                            setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))
                          }
                        />
                      </label>
                    </div>
                    <label style={{ display: "block", marginBottom: "0.5rem" }}>Contenido</label>
                    <ReactQuill
                      theme="snow"
                      value={templateForm.body_md}
                      onChange={(value) => setTemplateForm((prev) => ({ ...prev, body_md: value }))}
                      style={{ marginBottom: "1rem" }}
                    />
                    <div className="template-variables">
                      <p>Variables disponibles</p>
                      <div className="template-chips">
                        {variableCatalog.map((variable) => (
                          <button
                            className="template-chip"
                            type="button"
                            key={variable.key}
                            title={variable.description ?? ""}
                            onClick={() =>
                              setTemplateForm((prev) => ({
                                ...prev,
                                body_md: prev.body_md + variable.token,
                              }))
                            }
                          >
                            <span>{variable.token}</span>
                            <small>{variable.label}</small>
                          </button>
                        ))}
                      </div>
                      {variableCatalog.length === 0 ? (
                        <p className="helper">No hay variables activas en el catálogo.</p>
                      ) : null}
                    </div>
                    <div className="form-actions">
                      <button className="btn-primary" type="submit">
                        Crear plantilla
                      </button>
                    </div>
                  </form>
                  <div className="template-preview">
                    <h4>Vista previa</h4>
                    <div className="preview-block">
                      <small>Asunto</small>
                      <div className="preview-text">
                        {renderTemplatePreview(templateForm.subject || "Sin asunto", previewValues)}
                      </div>
                    </div>
                    <div className="preview-block">
                      <small>Mensaje</small>
                      {(() => {
                        const rendered = renderTemplatePreview(templateForm.body_md || "Sin contenido", previewValues);
                        return isHtmlContent(rendered)
                          ? <div className="preview-text" dangerouslySetInnerHTML={{ __html: rendered }} />
                          : <div className="preview-text">{rendered}</div>;
                      })()}
                    </div>
                    <div className="template-usage">
                      <small>Variables usadas</small>
                      {newTemplateVariables.length === 0 ? (
                        <p className="helper">No se detectaron variables en la plantilla.</p>
                      ) : (
                        <>
                          <div className="template-usage__chips">
                            {newTemplateVariables.map((key) => (
                              <span
                                key={`new-${key}`}
                                className={`template-token ${variableKeys.has(key) ? "" : "template-token--warn"}`}
                              >
                                {`{${key}}`}
                              </span>
                            ))}
                          </div>
                          {newUnknownVariables.length > 0 ? (
                            <p className="error">Algunas variables no están en el catálogo oficial.</p>
                          ) : (
                            <p className="helper">Todas las variables existen en el catálogo.</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {templateError ? <p className="error">{templateError}</p> : null}

            {/* ── Lista de plantillas (acordeón) ── */}
            <div className="template-list">
              {templates.map((template) => {
                const isExpanded = expandedTemplates.has(template.id);
                const edit = templateEdits[template.id] ?? {
                  subject: template.subject,
                  body_md: template.body_md,
                  is_active: template.is_active,
                };
                const usedVariables = extractTemplateVariables(edit.subject, edit.body_md);
                const unknownVariables = usedVariables.filter((key) => !variableKeys.has(key));
                const testEmail = testEmailMap[template.id] ?? "";
                return (
                  <div
                    className="card"
                    key={template.id}
                    style={{ opacity: edit.is_active ? 1 : 0.5, marginBottom: "0.5rem" }}
                  >
                    {/* ── Cabecera del acordeón ── */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        setExpandedTemplates((prev) => {
                          const next = new Set(prev);
                          if (next.has(template.id)) next.delete(template.id);
                          else next.add(template.id);
                          return next;
                        })
                      }
                    >
                      <span style={{ flex: 1 }}>
                        <strong style={{ fontSize: "0.85rem", fontFamily: "monospace" }}>
                          {template.template_key}
                        </strong>
                        <span style={{ color: "var(--text-muted, #aaa)", marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                          — {template.subject}
                        </span>
                      </span>
                      {edit.is_active ? (
                        <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", background: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: 600 }}>
                          ACTIVA
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "999px", background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 600 }}>
                          INACTIVA
                        </span>
                      )}
                      <button
                        className="btn-ghost"
                        type="button"
                        style={{ pointerEvents: "none", minWidth: "2rem" }}
                        tabIndex={-1}
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    </div>

                    {/* ── Cuerpo del acordeón ── */}
                    {isExpanded ? (
                      <div className="template-editor" style={{ marginTop: "1rem" }}>
                        <div className="template-editor__form">
                          <div className="form-grid">
                            <label>
                              Clave
                              <input className="input" value={template.template_key} disabled />
                            </label>
                            <label>
                              Asunto
                              <input
                                className="input"
                                value={edit.subject}
                                ref={(node) => { templateSubjectRefs.current[template.id] = node; }}
                                onChange={(event) =>
                                  setTemplateEdits((prev) => ({
                                    ...prev,
                                    [template.id]: { ...edit, subject: event.target.value },
                                  }))
                                }
                              />
                            </label>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={edit.is_active}
                                onChange={(event) =>
                                  setTemplateEdits((prev) => ({
                                    ...prev,
                                    [template.id]: { ...edit, is_active: event.target.checked },
                                  }))
                                }
                              />
                              Activa
                            </label>
                          </div>
                          <label style={{ display: "block", marginBottom: "0.5rem" }}>Contenido</label>
                          <ReactQuill
                            theme="snow"
                            value={edit.body_md}
                            onChange={(value) =>
                              setTemplateEdits((prev) => ({
                                ...prev,
                                [template.id]: { ...edit, body_md: value },
                              }))
                            }
                            style={{ marginBottom: "1rem" }}
                          />
                          <div className="template-variables">
                            <p>Variables disponibles</p>
                            <div className="template-chips">
                              {variableCatalog.map((variable) => (
                                <button
                                  className="template-chip"
                                  type="button"
                                  key={`${template.id}-${variable.key}`}
                                  title={variable.description ?? ""}
                                  onClick={() =>
                                    setTemplateEdits((prev) => ({
                                      ...prev,
                                      [template.id]: {
                                        ...edit,
                                        body_md: edit.body_md + variable.token,
                                      },
                                    }))
                                  }
                                >
                                  <span>{variable.token}</span>
                                  <small>{variable.label}</small>
                                </button>
                              ))}
                            </div>
                            {variableCatalog.length === 0 ? (
                              <p className="helper">No hay variables activas en el catálogo.</p>
                            ) : null}
                          </div>
                          <div className="form-actions">
                            <button
                              className="btn-ghost"
                              type="button"
                              onClick={() => handleTemplateSave(template)}
                            >
                              Guardar cambios
                            </button>
                          </div>
                          {/* ── Email de prueba ── */}
                          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <small style={{ display: "block", marginBottom: "0.5rem", opacity: 0.6 }}>
                              Enviar correo de prueba
                              {!previewApplicationId && (
                                <span style={{ color: "#f59e0b", marginLeft: "0.5rem" }}>
                                  — selecciona una solicitud en "Datos para vista previa"
                                </span>
                              )}
                            </small>
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <input
                                className="input"
                                type="email"
                                placeholder="correo@destino.com"
                                value={testEmail}
                                style={{ flex: 1 }}
                                onChange={(e) =>
                                  setTestEmailMap((prev) => ({ ...prev, [template.id]: e.target.value }))
                                }
                              />
                              <button
                                className="btn-ghost"
                                type="button"
                                disabled={sendingTestEmail[template.id] || !previewApplicationId}
                                onClick={() => handleSendTestEmail(template, testEmail)}
                              >
                                {sendingTestEmail[template.id] ? "Enviando…" : "Enviar prueba"}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="template-preview">
                          <h4>Vista previa</h4>
                          <div className="preview-block">
                            <small>Asunto</small>
                            <div className="preview-text">
                              {renderTemplatePreview(edit.subject || "Sin asunto", previewValues)}
                            </div>
                          </div>
                          <div className="preview-block">
                            <small>Mensaje</small>
                            {(() => {
                              const rendered = renderTemplatePreview(edit.body_md || "Sin contenido", previewValues);
                              return isHtmlContent(rendered)
                                ? <div className="preview-text" dangerouslySetInnerHTML={{ __html: rendered }} />
                                : <div className="preview-text">{rendered}</div>;
                            })()}
                          </div>
                          <div className="template-usage">
                            <small>Variables usadas</small>
                            {usedVariables.length === 0 ? (
                              <p className="helper">No se detectaron variables en la plantilla.</p>
                            ) : (
                              <>
                                <div className="template-usage__chips">
                                  {usedVariables.map((key) => (
                                    <span
                                      key={`${template.id}-${key}`}
                                      className={`template-token ${variableKeys.has(key) ? "" : "template-token--warn"}`}
                                    >
                                      {`{${key}}`}
                                    </span>
                                  ))}
                                </div>
                                {unknownVariables.length > 0 ? (
                                  <p className="error">Hay variables fuera del catálogo oficial.</p>
                                ) : (
                                  <p className="helper">Todas las variables existen en el catálogo.</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="card">
              <h4>Catálogo de variables</h4>
              <p className="lead">Define las variables disponibles en las plantillas y su ejemplo.</p>
              <form className="form-grid" onSubmit={handleVariableSubmit}>
                <label>
                  Clave (sin espacios)
                  <input
                    className="input"
                    value={variableForm.variable_key}
                    onChange={(event) =>
                      setVariableForm((prev) => ({ ...prev, variable_key: event.target.value }))
                    }
                    placeholder="ej: schedule_date"
                  />
                </label>
                <label>
                  Etiqueta
                  <input
                    className="input"
                    value={variableForm.label}
                    onChange={(event) => setVariableForm((prev) => ({ ...prev, label: event.target.value }))}
                  />
                </label>
                <label>
                  Descripción
                  <input
                    className="input"
                    value={variableForm.description}
                    onChange={(event) =>
                      setVariableForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Ejemplo
                  <input
                    className="input"
                    value={variableForm.example_value}
                    onChange={(event) =>
                      setVariableForm((prev) => ({ ...prev, example_value: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Orden
                  <input
                    className="input"
                    type="number"
                    value={variableForm.sort_order}
                    onChange={(event) =>
                      setVariableForm((prev) => ({
                        ...prev,
                        sort_order: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={variableForm.is_active}
                    onChange={(event) =>
                      setVariableForm((prev) => ({ ...prev, is_active: event.target.checked }))
                    }
                  />
                  Activa
                </label>
                <div className="form-actions">
                  <button className="btn-primary" type="submit">
                    Agregar variable
                  </button>
                </div>
              </form>
              {variableError ? <p className="error">{variableError}</p> : null}
              <div className="table">
                <div className="table-row table-head table-row--variables">
                  <span>Clave</span>
                  <span>Etiqueta</span>
                  <span>Descripción</span>
                  <span>Ejemplo</span>
                  <span>Orden</span>
                  <span>Activa</span>
                  <span></span>
                </div>
                {templateVariables.length === 0 ? (
                  <p>No hay variables registradas.</p>
                ) : (
                  templateVariables.map((variable) => {
                    const edit = variableEdits[variable.variable_key] ?? {
                      label: variable.label,
                      description: variable.description ?? "",
                      example_value: variable.example_value ?? "",
                      sort_order: variable.sort_order,
                      is_active: variable.is_active,
                    };
                    return (
                      <div className="table-row table-row--variables" key={variable.variable_key}>
                        <span className="table-primary">
                          <strong>{`{${variable.variable_key}}`}</strong>
                          <small>{variable.label}</small>
                        </span>
                        <span>
                          <input
                            className="input"
                            value={edit.label}
                            onChange={(event) =>
                              setVariableEdits((prev) => ({
                                ...prev,
                                [variable.variable_key]: { ...edit, label: event.target.value },
                              }))
                            }
                          />
                        </span>
                        <span>
                          <input
                            className="input"
                            value={edit.description}
                            onChange={(event) =>
                              setVariableEdits((prev) => ({
                                ...prev,
                                [variable.variable_key]: { ...edit, description: event.target.value },
                              }))
                            }
                          />
                        </span>
                        <span>
                          <input
                            className="input"
                            value={edit.example_value}
                            onChange={(event) =>
                              setVariableEdits((prev) => ({
                                ...prev,
                                [variable.variable_key]: { ...edit, example_value: event.target.value },
                              }))
                            }
                          />
                        </span>
                        <span>
                          <input
                            className="input"
                            type="number"
                            value={edit.sort_order}
                            onChange={(event) =>
                              setVariableEdits((prev) => ({
                                ...prev,
                                [variable.variable_key]: {
                                  ...edit,
                                  sort_order: Number(event.target.value || 0),
                                },
                              }))
                            }
                          />
                        </span>
                        <span>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={edit.is_active}
                              onChange={(event) =>
                                setVariableEdits((prev) => ({
                                  ...prev,
                                  [variable.variable_key]: { ...edit, is_active: event.target.checked },
                                }))
                              }
                            />
                            {edit.is_active ? "Sí" : "No"}
                          </label>
                        </span>
                        <span className="table-actions">
                          <button
                            className="btn-ghost"
                            type="button"
                            onClick={() => handleVariableSave(variable)}
                          >
                            Guardar
                          </button>
                          <button
                            className="btn-ghost"
                            type="button"
                            onClick={() => handleVariableDelete(variable)}
                          >
                            Eliminar
                          </button>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "usuarios" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Usuarios RH</h3>
              {roleError ? <p className="error">{roleError}</p> : null}
            </div>
            <div className="table">
              <div className="table-row table-head table-row--users">
                <span>Usuario</span>
                <span>Rol</span>
                <span></span>
              </div>
              {profiles.map((user) => {
                const edit = roleEdits[user.id] ?? user.role;
                return (
                  <div className="table-row table-row--users" key={user.id}>
                    <span className="table-primary">
                      <strong>{user.full_name ?? "Sin nombre"}</strong>
                      <small>{user.id}</small>
                    </span>
                    <span>
                      <select
                        className="input"
                        value={edit}
                        onChange={(event) =>
                          setRoleEdits((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as ProfileRow["role"],
                          }))
                        }
                      >
                        <option value="rh_admin">RH Admin</option>
                        <option value="rh_recruiter">RH Reclutador</option>
                        <option value="interviewer">Entrevistador</option>
                      </select>
                    </span>
                    <span>
                      <button className="btn-ghost" type="button" onClick={() => handleRoleSave(user)}>
                        Guardar
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTab === "contratados" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Empleados Contratados</h3>
              <p style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '1.2rem' }}>
                Historial de contrataciones. Al descontratar, registra el semáforo de recontratación para futuras postulaciones.
              </p>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className="input"
                  placeholder="Buscar por nombre, puesto o sucursal..."
                  value={hiredSearch}
                  onChange={e => setHiredSearch(e.target.value)}
                  style={{ maxWidth: 340 }}
                />
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => setShowAddEmployee(p => !p)}
                  style={{ padding: '0.7rem 1.4rem', fontSize: '0.65rem', fontWeight: 800, borderRadius: '12px', whiteSpace: 'nowrap' }}
                >
                  {showAddEmployee ? '✕ CANCELAR' : '+ REGISTRAR EMPLEADO EXISTENTE'}
                </button>
              </div>

              {showAddEmployee && (
                <form onSubmit={handleAddEmployee} style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid var(--accent)', borderRadius: '16px', background: 'rgba(61,90,254,0.03)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p className="mono" style={{ fontSize: '0.6rem', fontWeight: 800, margin: 0, opacity: 0.6 }}>// REGISTRAR EMPLEADO EXISTENTE</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>NOMBRE(S) *
                      <input className="input" style={{ marginTop: '0.4rem' }} value={addEmployeeForm.first_name} onChange={e => setAddEmployeeForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Ej: César" required />
                    </label>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>APELLIDO(S) *
                      <input className="input" style={{ marginTop: '0.4rem' }} value={addEmployeeForm.last_name} onChange={e => setAddEmployeeForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Ej: Osorio Hernández" required />
                    </label>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>CORREO ELECTRÓNICO
                      <input className="input" type="email" style={{ marginTop: '0.4rem' }} value={addEmployeeForm.email} onChange={e => setAddEmployeeForm(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" />
                    </label>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>TELÉFONO
                      <input className="input" style={{ marginTop: '0.4rem' }} value={addEmployeeForm.phone} onChange={e => setAddEmployeeForm(p => ({ ...p, phone: e.target.value }))} placeholder="55 1234 5678" />
                    </label>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>VACANTE / PUESTO *
                      <select className="input" style={{ marginTop: '0.4rem' }} value={addEmployeeForm.job_posting_id} onChange={e => setAddEmployeeForm(p => ({ ...p, job_posting_id: e.target.value }))} required>
                        <option value="">— Seleccionar vacante —</option>
                        {jobs.map(j => <option key={j.id} value={j.id}>{j.title}{j.branch ? ` · ${j.branch}` : ''}</option>)}
                      </select>
                    </label>
                    <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>FECHA DE CONTRATACIÓN *
                      <input className="input" type="date" style={{ marginTop: '0.4rem' }} value={addEmployeeForm.hired_at} onChange={e => setAddEmployeeForm(p => ({ ...p, hired_at: e.target.value }))} max={today} required />
                    </label>
                  </div>
                  {addEmployeeError && <p className="error">{addEmployeeError}</p>}
                  <button className="btn-primary" type="submit" disabled={addEmployeeSaving} style={{ alignSelf: 'flex-end', padding: '0.8rem 2rem', fontWeight: 800 }}>
                    {addEmployeeSaving ? 'REGISTRANDO...' : 'CONFIRMAR REGISTRO'}
                  </button>
                </form>
              )}
            </div>
            {(() => {
              const q = hiredSearch.trim().toLowerCase();
              const filtered = q
                ? hiredApps.filter(app => {
                  const p = app.recruit_candidates?.recruit_persons;
                  return (
                    `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.toLowerCase().includes(q) ||
                    (app.recruit_job_postings?.title ?? '').toLowerCase().includes(q) ||
                    (app.recruit_job_postings?.branch ?? '').toLowerCase().includes(q)
                  );
                })
                : hiredApps;
              return filtered.length === 0 ? (
                <div className="card"><p style={{ opacity: 0.5, fontSize: '0.8rem' }}>{q ? 'Sin resultados para esa búsqueda.' : 'Sin empleados contratados aún.'}</p></div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.3rem 0.9rem', borderRadius: '20px', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                      ● {filtered.filter(a => a.status_key === 'hired').length} ACTIVOS
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.3rem 0.9rem', borderRadius: '20px', background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                      ● {filtered.filter(a => a.status_key === 'terminated').length} BAJAS
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {filtered.map(app => {
                      const person = app.recruit_candidates?.recruit_persons;
                      const isOpen = descontratarId === app.id;
                      const flagColor = app.rehire_flag?.color;
                      const flagColors = { green: { bg: '#22c55e', label: 'PUEDE RECONTRATARSE' }, yellow: { bg: '#eab308', label: 'REVISAR ANTES DE CONTRATAR' }, red: { bg: '#ef4444', label: 'NO RECONTRATAR' } } as const;
                      const isTerminated = app.status_key === 'terminated';
                      const history = app.recruit_application_status_history ?? [];
                      const hiredAt = history.find(h => h.status_key === 'hired')?.changed_at ?? null;
                      const terminatedAt = history.find(h => h.status_key === 'terminated')?.changed_at ?? null;
                      const tenure = hiredAt ? formatTenure(hiredAt, terminatedAt) : null;
                      const fmtDate = (d: string) => new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' }).format(new Date(d));
                      const initials = person ? `${person.first_name[0]}${person.last_name[0]}`.toUpperCase() : '??';
                      return (
                        <div key={app.id} style={{ border: `1px solid ${isTerminated ? 'rgba(239,68,68,0.15)' : 'var(--border-light)'}`, borderRadius: '16px', overflow: 'hidden', background: isTerminated ? 'rgba(239,68,68,0.02)' : 'var(--bg-card)', transition: 'opacity 0.2s', opacity: isTerminated ? 0.75 : 1 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.5rem', padding: '1.2rem 1.5rem', alignItems: 'center' }}>

                            {/* Empleado */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', minWidth: 0 }}>
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: isTerminated ? 'rgba(239,68,68,0.12)' : 'rgba(61,90,254,0.1)', color: isTerminated ? '#ef4444' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', flexShrink: 0 }}>
                                {initials}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <Link to={`/crm/applications/${app.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                  <div style={{ fontWeight: 800, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px dashed var(--accent)' }}>
                                    {person ? `${person.first_name} ${person.last_name}` : '—'}
                                  </div>
                                </Link>
                                <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person?.email ?? ''}</div>
                                <div style={{ marginTop: '0.4rem' }}>
                                  <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.15rem 0.6rem', borderRadius: '10px', background: isTerminated ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: isTerminated ? '#ef4444' : '#22c55e' }}>
                                    {isTerminated ? '● BAJA' : '● ACTIVO'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Puesto + antigüedad */}
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{app.recruit_job_postings?.title ?? '—'}</div>
                              <div style={{ fontSize: '0.65rem', opacity: 0.55, marginTop: '0.15rem' }}>{app.recruit_job_postings?.branch ?? ''}</div>
                              {tenure && (
                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                  <div className="mono" style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)' }}>⏱ {tenure}</div>
                                  {hiredAt && <div className="mono" style={{ fontSize: '0.55rem', opacity: 0.45 }}>Ingreso: {fmtDate(hiredAt)}{terminatedAt ? ` · Baja: ${fmtDate(terminatedAt)}` : ''}</div>}
                                </div>
                              )}
                            </div>

                            {/* Acciones + semáforo */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                              {flagColor ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.6rem', fontWeight: 800, padding: '0.3rem 0.8rem', borderRadius: '20px', background: `${flagColors[flagColor].bg}22`, color: flagColors[flagColor].bg, whiteSpace: 'nowrap' }}>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: flagColors[flagColor].bg, display: 'inline-block' }} />
                                  {flagColors[flagColor].label}
                                </span>
                              ) : null}
                              {!isTerminated && (
                                <button
                                  className="btn-ghost"
                                  type="button"
                                  onClick={() => { setDescontratarId(isOpen ? null : app.id); setDescontratarError(null); setDescontratarForm({ color: 'green', reason: '' }); }}
                                  style={{ fontSize: '0.65rem', color: isOpen ? 'var(--text-muted)' : 'var(--danger)', borderColor: isOpen ? 'var(--border-light)' : 'var(--danger)', whiteSpace: 'nowrap' }}
                                >
                                  {isOpen ? 'CANCELAR' : 'DESCONTRATAR'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* ── Formulario de salida ── */}
                          {isOpen && (
                            <div style={{ padding: '1.5rem 2rem', background: 'var(--bg-accent)', borderTop: '1px solid var(--border-light)' }}>
                              <form onSubmit={handleDescontratar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <p className="mono" style={{ fontSize: '0.6rem', fontWeight: 800, margin: 0, opacity: 0.6 }}>// REGISTRAR SALIDA — {person?.first_name} {person?.last_name}</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                                  <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>SEMÁFORO DE RECONTRATACIÓN
                                    <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.8rem', alignItems: 'center' }}>
                                      {(['green', 'yellow', 'red'] as const).map(c => (
                                        <button
                                          key={c}
                                          type="button"
                                          onClick={() => setDescontratarForm(p => ({ ...p, color: c }))}
                                          title={c === 'green' ? 'Recontratable' : c === 'yellow' ? 'A criterio' : 'No recontratar'}
                                          style={{
                                            width: 36, height: 36, borderRadius: '50%',
                                            border: `3px solid ${descontratarForm.color === c ? flagColors[c].bg : 'transparent'}`,
                                            background: flagColors[c].bg,
                                            cursor: 'pointer',
                                            opacity: descontratarForm.color === c ? 1 : 0.35,
                                            transition: 'opacity 0.15s, border-color 0.15s',
                                            flexShrink: 0,
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </label>
                                  <label style={{ fontSize: '0.6rem', fontWeight: 800 }}>MOTIVO DE SALIDA *
                                    <textarea
                                      className="input"
                                      placeholder="Describe el motivo de la baja: renuncia voluntaria, término de contrato, desempeño, etc."
                                      value={descontratarForm.reason}
                                      onChange={e => setDescontratarForm(p => ({ ...p, reason: e.target.value }))}
                                      style={{ marginTop: '0.5rem', minHeight: '70px' }}
                                      required
                                    />
                                  </label>
                                </div>
                                {descontratarError && <p className="error">{descontratarError}</p>}
                                <button className="btn-primary" type="submit" disabled={descontratarSaving} style={{ alignSelf: 'flex-end', padding: '0.8rem 2rem', fontWeight: 800 }}>
                                  {descontratarSaving ? 'REGISTRANDO...' : 'CONFIRMAR SALIDA'}
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}

        {activeTab === "anfitriones" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Anfitriones de Onboarding</h3>
              <p style={{ opacity: 0.6, fontSize: '0.8rem', marginBottom: '1.5rem' }}>Responsables de recibir a los nuevos empleados. Al guardar un plan de onboarding se les envía una notificación automática.</p>
              <form className="form-grid" onSubmit={handleHostSubmit}>
                <label>
                  Nombre completo *
                  <input className="input" value={hostForm.full_name} onChange={e => setHostForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Ej: Carlos Ramírez" required />
                </label>
                <label>
                  Correo electrónico *
                  <input className="input" type="email" value={hostForm.email} onChange={e => setHostForm(p => ({ ...p, email: e.target.value }))} placeholder="carlos@empresa.com" required />
                </label>
                <label>
                  Teléfono (opcional)
                  <input className="input" value={hostForm.phone} onChange={e => setHostForm(p => ({ ...p, phone: e.target.value }))} placeholder="55 1234 5678" />
                </label>
                {hostError && <p className="error" style={{ gridColumn: '1/-1' }}>{hostError}</p>}
                <div className="form-actions" style={{ gridColumn: '1/-1' }}>
                  <button className="btn-ghost" type="submit" disabled={hostSaving}>{hostSaving ? "Guardando..." : "Agregar anfitrión"}</button>
                </div>
              </form>
            </div>
            <div className="table">
              <div className="table-row table-head table-row--admin">
                <span>Nombre</span>
                <span>Correo</span>
                <span>Teléfono</span>
                <span>Estado</span>
              </div>
              {hosts.length === 0 ? (
                <div className="table-row"><span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Sin anfitriones registrados.</span></div>
              ) : hosts.map(host => (
                <div className="table-row table-row--admin" key={host.id}>
                  <span className="table-primary"><strong>{host.full_name}</strong></span>
                  <span>{host.email}</span>
                  <span>{host.phone ?? "—"}</span>
                  <span>
                    <button className="btn-ghost" type="button" onClick={() => toggleHostActive(host)} style={{ fontSize: '0.7rem', color: host.is_active ? 'var(--success)' : 'var(--text-muted)' }}>
                      {host.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "estatus" ? (
          <div className="admin-section">

            {/* ── Catálogo de estatus (editable) ── */}
            <div className="card">
              <h3>Catálogo de estatus</h3>
              <p className="lead">Edita etiquetas, orden y configuración de cada estatus del pipeline.</p>
              {statusError ? <p className="error">{statusError}</p> : null}
            </div>
            <div className="table">
              <div className="table-row table-head" style={{ gridTemplateColumns: "2fr 2fr 80px 80px 70px 80px" }}>
                <span>Clave</span>
                <span>Etiqueta</span>
                <span>Orden</span>
                <span>Motivo</span>
                <span>Activo</span>
                <span></span>
              </div>
              {statuses.map((status) => {
                const edit = statusEdits[status.status_key] ?? {
                  label: status.label,
                  requires_reason: status.requires_reason,
                  is_active: status.is_active,
                  sort_order: status.sort_order,
                };
                return (
                  <div className="table-row" key={status.status_key} style={{ gridTemplateColumns: "2fr 2fr 80px 80px 70px 80px", opacity: edit.is_active ? 1 : 0.5 }}>
                    <span className="table-primary">
                      <strong style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{status.status_key}</strong>
                    </span>
                    <span>
                      <input
                        className="input"
                        value={edit.label}
                        onChange={(e) =>
                          setStatusEdits((prev) => ({ ...prev, [status.status_key]: { ...edit, label: e.target.value } }))
                        }
                      />
                    </span>
                    <span>
                      <input
                        className="input"
                        type="number"
                        value={edit.sort_order}
                        onChange={(e) =>
                          setStatusEdits((prev) => ({ ...prev, [status.status_key]: { ...edit, sort_order: Number(e.target.value) } }))
                        }
                      />
                    </span>
                    <span>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={edit.requires_reason}
                          onChange={(e) =>
                            setStatusEdits((prev) => ({ ...prev, [status.status_key]: { ...edit, requires_reason: e.target.checked } }))
                          }
                        />
                        {edit.requires_reason ? "Sí" : "No"}
                      </label>
                    </span>
                    <span>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={edit.is_active}
                          onChange={(e) =>
                            setStatusEdits((prev) => ({ ...prev, [status.status_key]: { ...edit, is_active: e.target.checked } }))
                          }
                        />
                        {edit.is_active ? "Sí" : "No"}
                      </label>
                    </span>
                    <span>
                      <button className="btn-ghost" type="button" onClick={() => handleStatusSave(status)}>
                        Guardar
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Nueva transición ── */}
            <div className="card">
              <h3>Reglas de transición</h3>
              <p className="lead">Define qué estatus se permiten como siguiente paso.</p>
              <form className="form-grid" onSubmit={handleTransitionSubmit}>
                <label>
                  Desde
                  <select
                    className="input"
                    value={transitionForm.from_status_key}
                    onChange={(event) =>
                      setTransitionForm((prev) => ({ ...prev, from_status_key: event.target.value }))
                    }
                  >
                    <option value="">Selecciona</option>
                    {statusOptions.map((s) => (
                      <option key={s.status_key} value={s.status_key}>{s.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Hacia
                  <select
                    className="input"
                    value={transitionForm.to_status_key}
                    onChange={(event) =>
                      setTransitionForm((prev) => ({ ...prev, to_status_key: event.target.value }))
                    }
                  >
                    <option value="">Selecciona</option>
                    {statusOptions
                      .filter((s) => s.status_key !== transitionForm.from_status_key)
                      .map((s) => (
                        <option key={s.status_key} value={s.status_key}>{s.label}</option>
                      ))}
                  </select>
                </label>
                <label>
                  Plantilla de correo
                  <select
                    className="input"
                    value={transitionForm.template_key}
                    onChange={(event) =>
                      setTransitionForm((prev) => ({ ...prev, template_key: event.target.value }))
                    }
                  >
                    <option value="">Sin correo</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.template_key}>{t.template_key}</option>
                    ))}
                  </select>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={transitionForm.is_active}
                    onChange={(event) =>
                      setTransitionForm((prev) => ({ ...prev, is_active: event.target.checked }))
                    }
                  />
                  Activa
                </label>
                <div className="form-actions">
                  <button className="btn-primary" type="submit">Agregar transición</button>
                </div>
              </form>
              {transitionError ? <p className="error">{transitionError}</p> : null}
            </div>

            {/* ── Transiciones agrupadas por origen ── */}
            {statusOptions.map((fromStatus) => {
              const group = transitions.filter((t) => t.from_status_key === fromStatus.status_key);
              if (group.length === 0) return null;
              return (
                <div className="card" key={fromStatus.status_key}>
                  <h4 style={{ marginBottom: "1rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                    {fromStatus.label}
                    <small style={{ marginLeft: "0.75rem", opacity: 0.5, fontWeight: 400 }}>{fromStatus.status_key}</small>
                  </h4>
                  <div className="table">
                    <div className="table-row table-head" style={{ gridTemplateColumns: "2fr 2fr 1fr 90px" }}>
                      <span>Destino</span>
                      <span>Correo automático</span>
                      <span>Activa</span>
                      <span></span>
                    </div>
                    {group.map((transition) => {
                      const key = buildTransitionKey(transition);
                      const edit = transitionEdits[key] ?? {
                        is_active: transition.is_active,
                        template_key: transition.template_key ?? "",
                      };
                      return (
                        <div className="table-row" key={key} style={{ gridTemplateColumns: "2fr 2fr 1fr 90px", opacity: edit.is_active ? 1 : 0.5 }}>
                          <span className="table-primary">
                            <strong>{statusLabelMap[transition.to_status_key]?.label ?? transition.to_status_key}</strong>
                            <small style={{ fontFamily: "monospace" }}>{transition.to_status_key}</small>
                          </span>
                          <span>
                            <select
                              className="input"
                              value={edit.template_key ?? ""}
                              onChange={(event) =>
                                setTransitionEdits((prev) => ({
                                  ...prev,
                                  [key]: { ...edit, template_key: event.target.value || null },
                                }))
                              }
                            >
                              <option value="">Sin correo</option>
                              {templates.map((t) => (
                                <option key={t.id} value={t.template_key}>{t.template_key}</option>
                              ))}
                            </select>
                          </span>
                          <span>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={edit.is_active}
                                onChange={(event) =>
                                  setTransitionEdits((prev) => ({
                                    ...prev,
                                    [key]: { ...edit, is_active: event.target.checked },
                                  }))
                                }
                              />
                              {edit.is_active ? "Sí" : "No"}
                            </label>
                          </span>
                          <span className="table-actions">
                            <button className="btn-ghost" type="button" onClick={() => handleTransitionSave(transition)}>Guardar</button>
                            <button className="btn-ghost" type="button" onClick={() => handleTransitionDelete(transition)}>Eliminar</button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {activeTab === "metricas" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Métricas recientes</h3>
              <p className="lead">Resumen de los últimos 30 eventos registrados en el sistema.</p>
            </div>
            {metricsError ? <p className="error">{metricsError}</p> : null}
            <div className="metrics-grid">
              <div className="card metric-card">
                <span>Candidatos Totales</span>
                <strong>{metricSummary.statusChanged}</strong>
                <small>Total registrados</small>
              </div>
              <div className="card metric-card">
                <span>Correos enviados</span>
                <strong>{metricSummary.emailSent}</strong>
                <small>Enviados con éxito</small>
              </div>
              <div className="card metric-card">
                <span>Correos fallidos</span>
                <strong>{metricSummary.emailFailed}</strong>
                <small>Requieren atención</small>
              </div>
            </div>

            {/* Nuevo desglose estratégico por Estatus */}
            <div className="card">
              <h4>Estado del Pipeline</h4>
              <p className="helper">Conteo de candidatos activos por fase del proceso.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {(metricSummary as any).statusBreakdown?.map((item: any) => {
                  const label = statusLabelMap[item.status_key]?.label || item.status_key;
                  return (
                    <div key={item.status_key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.8rem', borderRadius: '8px', background: 'var(--bg-accent)', border: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-main)' }}>{label}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--accent)', minWidth: '2rem', textAlign: 'right' }}>{item.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card">
              <div className="metrics-header">
                <div>
                  <h4>Eventos recientes</h4>
                  <p className="helper">Se muestran los últimos 30 eventos registrados.</p>
                </div>
                <button className="btn-ghost" type="button" onClick={loadMetrics} disabled={metricsLoading}>
                  {metricsLoading ? "Actualizando..." : "Actualizar"}
                </button>
              </div>
              {metricsLoading ? (
                <p>Cargando eventos...</p>
              ) : (
                <div className="timeline">
                  {metricEvents.length === 0 ? (
                    <p>No hay eventos registrados.</p>
                  ) : (
                    metricEvents.map((event) => {
                      const metadata = (event.metadata ?? {}) as Record<string, unknown>;
                      const summary =
                        event.event_key === "status_changed"
                          ? `${metadata.from_status_key ?? "—"} → ${metadata.to_status_key ?? "—"}`
                          : event.event_key === "email_sent" || event.event_key === "email_failed"
                            ? `${metadata.to_address ?? "Sin destinatario"}`
                            : "Evento registrado";

                      return (
                        <div className="timeline-item" key={event.id}>
                          <div>
                            <strong>{(eventLabelMap as Record<string, string>)[event.event_key] ?? event.event_key}</strong>
                            <p>{summary}</p>
                            {event.recruit_message_templates?.template_key ? (
                              <small>Plantilla: {event.recruit_message_templates.template_key}</small>
                            ) : null}
                          </div>
                          <div>
                            <small>{event.profiles?.full_name ?? "Sistema"}</small>
                            <small>{formatDateTime(event.created_at)}</small>
                            {event.application_id ? <small>Solicitud: {event.application_id}</small> : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
