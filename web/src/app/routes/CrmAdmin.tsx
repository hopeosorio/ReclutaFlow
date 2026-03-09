import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/app/AuthProvider";
import { useAppToast } from "@/app/layouts/CrmLayout";
import LoadingScreen from "@/components/LoadingScreen";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabaseClient";

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
  stage: "application" | "post_interview" | "onboarding";
  is_required: boolean;
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

const tabs = [
  { id: "vacantes", label: "Vacantes" },
  { id: "preguntas", label: "Preguntas" },
  { id: "documentos", label: "Documentos" },
  { id: "plantillas", label: "Plantillas" },
  { id: "usuarios", label: "Usuarios" },
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

const formatPreviewDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Mexico_City" }).format(date);
};

const formatPreviewTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }).format(date);
};

type CaretInput = HTMLInputElement | HTMLTextAreaElement | null;

const insertTokenAtCaret = (value: string, token: string, input: CaretInput) => {
  if (!input || input.selectionStart === null || input.selectionEnd === null) {
    const nextValue = `${value}${token}`;
    return { nextValue, cursor: nextValue.length };
  }
  const start = input.selectionStart;
  const end = input.selectionEnd;
  return {
    nextValue: `${value.slice(0, start)}${token}${value.slice(end)}`,
    cursor: start + token.length,
  };
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
    stage: "application",
    is_required: false,
  });
  const [docEdits, setDocEdits] = useState<Record<string, { stage: DocumentTypeRow["stage"]; is_required: boolean }>>({});
  const [docError, setDocError] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({
    template_key: "",
    subject: "",
    body_md: "",
  });
  const [templateEdits, setTemplateEdits] = useState<Record<string, { subject: string; body_md: string; is_active: boolean }>>({});
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [templateFocus, setTemplateFocus] = useState<{ id: string; field: "subject" | "body" } | null>(null);
  const templateSubjectRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const templateBodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

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

  const [roleEdits, setRoleEdits] = useState<Record<string, ProfileRow["role"]>>({});
  const [roleError, setRoleError] = useState<string | null>(null);

  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricSummary, setMetricSummary] = useState({ statusChanged: 0, emailSent: 0, emailFailed: 0 });
  const [metricEvents, setMetricEvents] = useState<EventLogRow[]>([]);

  const [previewMode, setPreviewMode] = useState<"catalog" | "application">("catalog");
  const [previewApplications, setPreviewApplications] = useState<PreviewApplicationRow[]>([]);
  const [previewApplicationId, setPreviewApplicationId] = useState("");
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [previewListLoading, setPreviewListLoading] = useState(false);
  const [previewDetailsLoading, setPreviewDetailsLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);

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
        .select("id, name, stage, is_required")
        .order("name"),
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
    ]);

    if (jobsRes.error) setError(jobsRes.error.message);
    if (jobProfilesRes.error) setError(jobProfilesRes.error.message);
    if (docsRes.error) setError(docsRes.error.message);
    if (templatesRes.error) setError(templatesRes.error.message);
    if (variablesRes.error) setError(variablesRes.error.message);
    if (profilesRes.error) setError(profilesRes.error.message);
    if (statusesRes.error) setError(statusesRes.error.message);
    if (transitionsRes.error) setError(transitionsRes.error.message);

    setJobs((jobsRes.data as JobPostingRow[]) ?? []);
    setJobProfiles((jobProfilesRes.data as JobProfileRow[]) ?? []);
    setDocumentTypes((docsRes.data as DocumentTypeRow[]) ?? []);
    setTemplates((templatesRes.data as TemplateRow[]) ?? []);
    setTemplateVariables((variablesRes.data as TemplateVariableRow[]) ?? []);
    setProfiles((profilesRes.data as ProfileRow[]) ?? []);
    setStatuses((statusesRes.data as StatusRow[]) ?? []);
    setTransitions((transitionsRes.data as StatusTransitionRow[]) ?? []);
    setTransitionEdits({});

    setLoading(false);
  };

  const loadMetrics = async () => {
    if (!isAdmin) return;
    setMetricsLoading(true);
    setMetricsError(null);

    const { data, error: metricsLoadError } = await supabase
      .from("recruit_event_logs")
      .select(
        "id, event_key, entity_type, entity_id, application_id, template_id, metadata, created_at, profiles:created_by(full_name), recruit_message_templates(template_key, subject)",
      )
      .order("created_at", { ascending: false })
      .limit(30);

    if (metricsLoadError) {
      setMetricsError(metricsLoadError.message);
      setMetricEvents([]);
      setMetricSummary({ statusChanged: 0, emailSent: 0, emailFailed: 0 });
      setMetricsLoading(false);
      return;
    }

    const events = (data as unknown as EventLogRow[]) ?? [];
    const summary = events.reduce(
      (acc, event) => {
        if (event.event_key === "status_changed") acc.statusChanged += 1;
        if (event.event_key === "email_sent") acc.emailSent += 1;
        if (event.event_key === "email_failed") acc.emailFailed += 1;
        return acc;
      },
      { statusChanged: 0, emailSent: 0, emailFailed: 0 },
    );

    setMetricEvents(events);
    setMetricSummary(summary);
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

    const { data: application, error: applicationError } = await supabase
      .from("recruit_applications")
      .select(
        "id, assigned_to, job_posting_id, recruit_job_postings(title, branch), recruit_candidates(recruit_persons(first_name, last_name, email))",
      )
      .eq("id", applicationId)
      .single();

    if (applicationError || !application) {
      setPreviewError(applicationError?.message ?? "No se pudo cargar la solicitud.");
      setPreviewData({});
      setPreviewDetailsLoading(false);
      return;
    }

    const person = (application.recruit_candidates as any)?.recruit_persons;
    const name = `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim();
    const jobTitle = (application.recruit_job_postings as any)?.title ?? "";
    const jobBranch = (application.recruit_job_postings as any)?.branch ?? "";
    let recruiterName = "";

    if (application.assigned_to) {
      const { data: recruiter } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", application.assigned_to)
        .maybeSingle();
      recruiterName = recruiter?.full_name ?? "";
    }

    const { data: interview } = await supabase
      .from("recruit_interviews")
      .select("scheduled_at, location, profiles:interviewer_id(full_name)")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const scheduleDate = formatPreviewDate(interview?.scheduled_at ?? null);
    const scheduleTime = formatPreviewTime(interview?.scheduled_at ?? null);
    const location = interview?.location ?? "";
    const interviewerName = (interview?.profiles as any)?.full_name ?? "";

    setPreviewData({
      name,
      job_title: jobTitle,
      job_branch: jobBranch,
      schedule_date: scheduleDate,
      schedule_time: scheduleTime,
      location,
      recruiter_name: recruiterName,
      interviewer_name: interviewerName,
      contact_email: person?.email ?? "",
      datetime: scheduleDate && scheduleTime ? `${scheduleDate} ${scheduleTime}` : scheduleDate || scheduleTime,
    });

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

  if (loading) {
    return <LoadingScreen label="Cargando panel admin" />;
  }

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
    if (!docForm.name.trim()) {
      setDocError("El nombre del documento es obligatorio.");
      return;
    }

    const { error: insertError } = await supabase.from("recruit_document_types").insert({
      name: docForm.name.trim(),
      stage: docForm.stage,
      is_required: docForm.is_required,
    });

    if (insertError) {
      setDocError(insertError.message);
      return;
    }

    setDocForm({ name: "", stage: "application", is_required: false });
    toast.success("Tipo de documento agregado");
    await loadAll();
  };

  const handleDocSave = async (doc: DocumentTypeRow) => {
    const edit = docEdits[doc.id];
    if (!edit || (edit.stage === doc.stage && edit.is_required === doc.is_required)) return;

    const { error: updateError } = await supabase
      .from("recruit_document_types")
      .update({ stage: edit.stage, is_required: edit.is_required })
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
    const edit = transitionEdits[key];
    if (!edit) return;
    const templateChanged = edit.template_key !== (transition.template_key ?? null);
    if (!templateChanged && edit.is_active === transition.is_active) return;

    const { error: updateError } = await supabase
      .from("recruit_status_transitions")
      .update({ is_active: edit.is_active, template_key: edit.template_key })
      .eq("from_status_key", transition.from_status_key)
      .eq("to_status_key", transition.to_status_key);

    if (updateError) {
      setTransitionError(updateError.message);
      return;
    }

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

  const insertTemplateToken = (
    templateId: string,
    token: string,
    fields: { subject: string; body_md: string; is_active?: boolean },
    update: (next: { subject: string; body_md: string; is_active?: boolean }) => void,
  ) => {
    const field = templateFocus?.id === templateId ? templateFocus.field : "body";
    const input =
      field === "subject" ? templateSubjectRefs.current[templateId] : templateBodyRefs.current[templateId];
    const currentValue = field === "subject" ? fields.subject : fields.body_md;
    const { nextValue, cursor } = insertTokenAtCaret(currentValue, token, input);
    const nextFields =
      field === "subject" ? { ...fields, subject: nextValue } : { ...fields, body_md: nextValue };
    update(nextFields);
    if (input) {
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(cursor, cursor);
      }, 0);
    }
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
              <form className="form-grid" onSubmit={handleDocSubmit}>
                <label>
                  Nombre
                  <input
                    className="input"
                    value={docForm.name}
                    onChange={(event) => setDocForm((prev) => ({ ...prev, name: event.target.value }))}
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
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={docForm.is_required}
                    onChange={(event) => setDocForm((prev) => ({ ...prev, is_required: event.target.checked }))}
                  />
                  Obligatorio
                </label>
                <div className="form-actions">
                  <button className="btn-primary" type="submit">
                    Agregar documento
                  </button>
                </div>
              </form>
              {docError ? <p className="error">{docError}</p> : null}
            </div>
            <div className="table">
              <div className="table-row table-head table-row--docs">
                <span>Documento</span>
                <span>Etapa</span>
                <span>Obligatorio</span>
                <span></span>
              </div>
              {documentTypes.map((doc) => {
                const edit = docEdits[doc.id] ?? { stage: doc.stage, is_required: doc.is_required };
                return (
                  <div className="table-row table-row--docs" key={doc.id}>
                    <span className="table-primary">
                      <strong>{doc.name}</strong>
                    </span>
                    <span>
                      <select
                        className="input"
                        value={edit.stage}
                        onChange={(event) =>
                          setDocEdits((prev) => ({
                            ...prev,
                            [doc.id]: {
                              ...edit,
                              stage: event.target.value as DocumentTypeRow["stage"],
                            },
                          }))
                        }
                      >
                        <option value="application">Solicitud</option>
                        <option value="post_interview">Post-entrevista</option>
                        <option value="onboarding">Onboarding</option>
                      </select>
                    </span>
                    <span>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={edit.is_required}
                          onChange={(event) =>
                            setDocEdits((prev) => ({
                              ...prev,
                              [doc.id]: { ...edit, is_required: event.target.checked },
                            }))
                          }
                        />
                        {edit.is_required ? "Sí" : "No"}
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
            <div className="card">
              <h4>Nueva plantilla</h4>
              <div className="template-editor">
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
                        ref={(node) => {
                          templateSubjectRefs.current["new"] = node;
                        }}
                        onFocus={() => setTemplateFocus({ id: "new", field: "subject" })}
                        onChange={(event) =>
                          setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Contenido
                      <textarea
                        className="input"
                        value={templateForm.body_md}
                        ref={(node) => {
                          templateBodyRefs.current["new"] = node;
                        }}
                        onFocus={() => setTemplateFocus({ id: "new", field: "body" })}
                        onChange={(event) => setTemplateForm((prev) => ({ ...prev, body_md: event.target.value }))}
                      />
                    </label>
                  </div>
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
                            insertTemplateToken(
                              "new",
                              variable.token,
                              { subject: templateForm.subject, body_md: templateForm.body_md },
                              (next) =>
                                setTemplateForm((prev) => ({
                                  ...prev,
                                  subject: next.subject,
                                  body_md: next.body_md,
                                })),
                            )
                          }
                        >
                          <span>{variable.token}</span>
                          <small>{variable.label}</small>
                        </button>
                      ))}
                    </div>
                    {usingFallbackCatalog ? (
                      <p className="helper">Catálogo oficial vacío, mostrando ejemplos locales.</p>
                    ) : null}
                    {variableCatalog.length === 0 ? (
                      <p className="helper">No hay variables activas en el catálogo.</p>
                    ) : null}
                    <small className="helper">
                      Se inserta en el campo activo. Si no hay foco, se agrega al contenido.
                    </small>
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
                    <div className="preview-text">
                      {renderTemplatePreview(templateForm.body_md || "Sin contenido", previewValues)}
                    </div>
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
            </div>
            {templateError ? <p className="error">{templateError}</p> : null}
            <div className="table template-list">
              {templates.map((template) => {
                const edit = templateEdits[template.id] ?? {
                  subject: template.subject,
                  body_md: template.body_md,
                  is_active: template.is_active,
                };
                const usedVariables = extractTemplateVariables(edit.subject, edit.body_md);
                const unknownVariables = usedVariables.filter((key) => !variableKeys.has(key));
                return (
                  <div className="card" key={template.id}>
                    <div className="template-editor">
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
                              ref={(node) => {
                                templateSubjectRefs.current[template.id] = node;
                              }}
                              onFocus={() => setTemplateFocus({ id: template.id, field: "subject" })}
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
                          <label>
                            Contenido
                            <textarea
                              className="input"
                              value={edit.body_md}
                              ref={(node) => {
                                templateBodyRefs.current[template.id] = node;
                              }}
                              onFocus={() => setTemplateFocus({ id: template.id, field: "body" })}
                              onChange={(event) =>
                                setTemplateEdits((prev) => ({
                                  ...prev,
                                  [template.id]: { ...edit, body_md: event.target.value },
                                }))
                              }
                            />
                          </label>
                        </div>
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
                                  insertTemplateToken(template.id, variable.token, edit, (next) =>
                                    setTemplateEdits((prev) => ({
                                      ...prev,
                                      [template.id]: {
                                        subject: next.subject,
                                        body_md: next.body_md,
                                        is_active: edit.is_active,
                                      },
                                    })),
                                  )
                                }
                              >
                                <span>{variable.token}</span>
                                <small>{variable.label}</small>
                              </button>
                            ))}
                          </div>
                          {usingFallbackCatalog ? (
                            <p className="helper">Catálogo oficial vacío, mostrando ejemplos locales.</p>
                          ) : null}
                          {variableCatalog.length === 0 ? (
                            <p className="helper">No hay variables activas en el catálogo.</p>
                          ) : null}
                          <small className="helper">
                            Se inserta en el campo activo. Si no hay foco, se agrega al contenido.
                          </small>
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
                          <div className="preview-text">
                            {renderTemplatePreview(edit.body_md || "Sin contenido", previewValues)}
                          </div>
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

        {activeTab === "estatus" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Catálogo de estatus</h3>
            </div>
            <div className="table">
              <div className="table-row table-head table-row--admin">
                <span>Estatus</span>
                <span>Etiqueta</span>
                <span>Motivo obligatorio</span>
                <span>Activo</span>
              </div>
              {statuses.map((status) => (
                <div className="table-row table-row--admin" key={status.status_key}>
                  <span className="table-primary">
                    <strong>{status.status_key}</strong>
                    <small>Orden {status.sort_order}</small>
                  </span>
                  <span>{status.label}</span>
                  <span>{status.requires_reason ? "Sí" : "No"}</span>
                  <span>{status.is_active ? "Sí" : "No"}</span>
                </div>
              ))}
            </div>
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
                    {statusOptions.map((status) => (
                      <option key={status.status_key} value={status.status_key}>
                        {status.label}
                      </option>
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
                    {statusOptions.map((status) => (
                      <option key={status.status_key} value={status.status_key}>
                        {status.label}
                      </option>
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
                    {templates.map((template) => (
                      <option key={template.id} value={template.template_key}>
                        {template.subject} ({template.template_key})
                      </option>
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
                  <button className="btn-primary" type="submit">
                    Guardar transición
                  </button>
                </div>
              </form>
              {transitionError ? <p className="error">{transitionError}</p> : null}
              <div className="table">
                <div className="table-row table-head table-row--transition">
                  <span>Origen</span>
                  <span>Destino</span>
                  <span>Correo</span>
                  <span>Activa</span>
                  <span></span>
                </div>
                {transitions.length === 0 ? (
                  <p>No hay transiciones configuradas.</p>
                ) : (
                  transitions.map((transition) => {
                    const key = buildTransitionKey(transition);
                    const edit = transitionEdits[key] ?? {
                      is_active: transition.is_active,
                      template_key: transition.template_key ?? "",
                    };
                    return (
                      <div className="table-row table-row--transition" key={key}>
                        <span className="table-primary">
                          <strong>
                            {statusLabelMap[transition.from_status_key]?.label ?? transition.from_status_key}
                          </strong>
                          <small>{transition.from_status_key}</small>
                        </span>
                        <span className="table-primary">
                          <strong>
                            {statusLabelMap[transition.to_status_key]?.label ?? transition.to_status_key}
                          </strong>
                          <small>{transition.to_status_key}</small>
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
                            {templates.map((template) => (
                              <option key={template.id} value={template.template_key}>
                                {template.subject} ({template.template_key})
                              </option>
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
                          <button
                            className="btn-ghost"
                            type="button"
                            onClick={() => handleTransitionSave(transition)}
                          >
                            Guardar
                          </button>
                          <button
                            className="btn-ghost"
                            type="button"
                            onClick={() => handleTransitionDelete(transition)}
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

        {activeTab === "metricas" ? (
          <div className="admin-section">
            <div className="card">
              <h3>Métricas recientes</h3>
              <p className="lead">Resumen de los últimos 30 eventos registrados en el sistema.</p>
            </div>
            {metricsError ? <p className="error">{metricsError}</p> : null}
            <div className="metrics-grid">
              <div className="card metric-card">
                <span>Cambios de estatus</span>
                <strong>{metricSummary.statusChanged}</strong>
                <small>Últimos 30 eventos</small>
              </div>
              <div className="card metric-card">
                <span>Correos enviados</span>
                <strong>{metricSummary.emailSent}</strong>
                <small>Últimos 30 eventos</small>
              </div>
              <div className="card metric-card">
                <span>Correos fallidos</span>
                <strong>{metricSummary.emailFailed}</strong>
                <small>Últimos 30 eventos</small>
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
