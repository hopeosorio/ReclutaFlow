import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabaseClient";

interface ApplicationRow {
  id: string;
  status_key: string;
  updated_at: string;
  submitted_at: string;
  traffic_light: "red" | "yellow" | "green" | null;
  assigned_to: string | null;
  recruit_job_postings: {
    id: string;
    title: string;
    branch: string | null;
    area: string | null;
  } | null;
  recruit_candidates: {
    recruit_persons: {
      first_name: string;
      last_name: string;
      email: string | null;
    } | null;
  } | null;
  profiles: { id: string; full_name: string | null } | null;
}

interface RecruiterRow {
  id: string;
  full_name: string | null;
}

interface StatusRow {
  status_key: string;
  label: string;
  requires_reason: boolean;
}

interface JobRow {
  id: string;
  title: string;
}


const trafficLabels: Record<string, string> = {
  red: "Rojo",
  yellow: "Amarillo",
  green: "Verde",
};

const CrmColumns = [
  { id: "new", label: "01. RECEPCIÓN", group: "application" },
  { id: "docs_validation", label: "02. FILTRO DE EXPEDIENTES", group: "application" },
  { id: "virtual_pending", label: "03. REVISIÓN EJECUTIVA (PENDIENTE)", group: "interview" },
  { id: "virtual_scheduled", label: "04. ENTREVISTA PROGRAMADA", group: "interview" },
  { id: "virtual_done", label: "05. ENTREVISTA COMPLETADA", group: "interview" },
  { id: "final_docs", label: "06. DOCUMENTACIÓN FINAL", group: "onboarding" },
  { id: "onboarding_scheduled", label: "07. FECHA DE INGRESO FIJADA", group: "onboarding" },
  { id: "hired", label: "08. CONTRATADO / FIRMADO", group: "hired" },
];

export default function CrmDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const PAGE_SIZE = 15;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // CSV Export
  const exportCSV = (rows: ApplicationRow[], statusMap: Record<string, string>) => {
    const headers = ["Nombre", "Email", "Vacante", "Sucursal", "Estatus", "Semáforo", "Responsable", "Fecha Solicitud", "Actualizado"];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const trafficSpanish: Record<string, string> = { red: "Crítico", yellow: "Atención", green: "Óptimo" };

    const lines = rows.map((a) => {
      const person = a.recruit_candidates?.recruit_persons;
      const name = `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim();
      return [
        escape(name || "Anónimo"),
        escape(person?.email),
        escape(a.recruit_job_postings?.title),
        escape(a.recruit_job_postings?.branch),
        escape(statusMap[a.status_key] ?? a.status_key),
        escape(trafficSpanish[a.traffic_light ?? ""] ?? "Sin semáforo"),
        escape(a.profiles?.full_name ?? "Sin asignar"),
        escape(a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }) : ""),
        escape(a.updated_at ? new Date(a.updated_at).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" }) : ""),
      ].join(",");
    });

    const csv = [headers.join(","), ...lines].join("\r\n");
    // BOM for Excel Spanish compatibility
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.setAttribute("download", `pipeline_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Defer revoke so browser can start the download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [trafficFilter, setTrafficFilter] = useState("");
  const [recruiterFilter, setRecruiterFilter] = useState("");
  const [search, setSearch] = useState("");
  const [recruiters, setRecruiters] = useState<RecruiterRow[]>([]);

  const statusLabelMap = useMemo(() => {
    return statuses.reduce<Record<string, string>>((acc, status) => {
      acc[status.status_key] = status.label;
      return acc;
    }, {});
  }, [statuses]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!profile) return;
      setLoading(true);
      setError(null);

      let appsQuery = supabase
        .from("recruit_applications")
        .select(
          "id, status_key, updated_at, submitted_at, traffic_light, assigned_to, recruit_job_postings(id, title, branch, area), recruit_candidates(recruit_persons(first_name, last_name, email)), profiles:assigned_to(full_name)",
        )
        .order("updated_at", { ascending: false });

      // Si no es admin, filtrar solo las que le pertenecen
      if (profile.role !== "rh_admin") {
        appsQuery = appsQuery.eq("assigned_to", profile.id);
      }

      const statusQuery = supabase
        .from("recruit_statuses")
        .select("status_key, label, requires_reason")
        .eq("is_active", true)
        .order("sort_order");

      const jobQuery = supabase
        .from("recruit_job_postings")
        .select("id, title")
        .order("title");

      const recruiterQuery = supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["rh_admin", "rh_recruiter"])
        .order("full_name");

      const [appsRes, statusRes, jobRes, recruiterRes] = await Promise.all([appsQuery, statusQuery, jobQuery, recruiterQuery]);

      if (!active) return;

      if (appsRes.error) setError(appsRes.error.message);
      if (statusRes.error) setError(statusRes.error.message);
      if (jobRes.error) setError(jobRes.error.message);

      setApplications((appsRes.data as unknown as ApplicationRow[]) ?? []);
      setStatuses((statusRes.data as StatusRow[]) ?? []);
      setJobs((jobRes.data as JobRow[]) ?? []);
      setRecruiters((recruiterRes?.data as RecruiterRow[]) ?? []);

      setLoading(false);
    };

    loadData();

    return () => {
      active = false;
    };
  }, [profile]);

  const filteredApplications = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return applications.filter((app) => {
      if (statusFilter && app.status_key !== statusFilter) return false;
      if (jobFilter && app.recruit_job_postings?.id !== jobFilter) return false;
      if (trafficFilter && app.traffic_light !== trafficFilter) return false;
      if (recruiterFilter) {
        if (recruiterFilter === "__unassigned" && app.assigned_to) return false;
        if (recruiterFilter !== "__unassigned" && app.assigned_to !== recruiterFilter) return false;
      }

      if (searchTerm) {
        const person = app.recruit_candidates?.recruit_persons;
        const name = `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.toLowerCase();
        const email = person?.email?.toLowerCase() ?? "";
        if (!name.includes(searchTerm) && !email.includes(searchTerm)) return false;
      }

      return true;
    });
  }, [applications, statusFilter, jobFilter, trafficFilter, recruiterFilter, search]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, jobFilter, trafficFilter, recruiterFilter, search]);

  // ─── KPI Calculations ──────────────────────────────
  const kpis = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const active = applications.length;
    const thisWeek = applications.filter((a) => new Date(a.submitted_at) >= weekStart).length;
    const critical = applications.filter((a) => a.traffic_light === "red").length;

    const withDays = applications.filter((a) => a.submitted_at && a.updated_at);
    const avgDays = withDays.length > 0
      ? Math.round(
        withDays.reduce((sum, a) => {
          const diff = new Date(a.updated_at).getTime() - new Date(a.submitted_at).getTime();
          return sum + diff / 86400000;
        }, 0) / withDays.length
      )
      : 0;

    return { active, thisWeek, critical, avgDays };
  }, [applications]);

  return (
    <section className="crm-section">
      <div className="crm-header">
        <div>
          <span className="mono" style={{ fontSize: '0.6rem' }}>// RECLUTAMIENTO ACTIVO</span>
          <h2>Pipeline de Talento</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-ghost" type="button" onClick={() => exportCSV(filteredApplications, statusLabelMap)}>
            ↓ Exportar CSV
          </button>
          {profile?.role === "rh_admin" ? (
            <button className="btn-primary" type="button" onClick={() => navigate("/crm/admin")}>
              + Nueva Vacante
            </button>
          ) : null}
        </div>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <span className="kpi-label">Solicitudes Activas</span>
          <strong className="kpi-value">{loading ? "—" : kpis.active}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Esta Semana</span>
          <strong className="kpi-value">{loading ? "—" : kpis.thisWeek}</strong>
        </div>
        <div className="kpi-card kpi-card--alert">
          <span className="kpi-label">Críticas 🔴</span>
          <strong className="kpi-value">{loading ? "—" : kpis.critical}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Días Promedio</span>
          <strong className="kpi-value">{loading ? "—" : `${kpis.avgDays}d`}</strong>
        </div>
      </div>

      <div className="filters">
        <label>
          Búsqueda Inteligente
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Candidato o folio..."
          />
        </label>
        <label>
          Especialidad
          <select className="input" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
            <option value="">Todas las vacantes</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Cualquier estatus</option>
            {statuses.map((status) => (
              <option key={status.status_key} value={status.status_key}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <select className="input" value={trafficFilter} onChange={(event) => setTrafficFilter(event.target.value)}>
            <option value="">Todos</option>
            <option value="green">Óptimo (Verde)</option>
            <option value="yellow">Atención (Amarillo)</option>
            <option value="red">Crítico (Rojo)</option>
          </select>
        </label>
        <label>
          Reclutador
          <select className="input" value={recruiterFilter} onChange={(event) => setRecruiterFilter(event.target.value)}>
            <option value="">Todos</option>
            <option value="__unassigned">Sin asignar</option>
            {recruiters.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name ?? "Reclutador"}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <div className="mono">SINCRONIZANDO PIPELINE...</div>
        </div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : filteredApplications.length === 0 ? (
        <div className="pro-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <h3 className="mono">SIN COINCIDENCIAS.</h3>
          <p style={{ color: 'var(--text-dim)' }}>Reajusta los parámetros de búsqueda o filtros.</p>
        </div>
      ) : (
        <>
          <div className="table">
            <div className="table-row table-head">
              <span>Identidad</span>
              <span>Especialidad</span>
              <span>Fase Actual</span>
              <span>Semáforo</span>
              <span>Responsable</span>
              <span>Actualización</span>
              <span>Acción</span>
            </div>
            {filteredApplications.slice(0, visibleCount).map((app) => {
              const person = app.recruit_candidates?.recruit_persons;
              const name = `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Anónimo";
              const job = app.recruit_job_postings;
              const statusLabel = statusLabelMap[app.status_key] ?? app.status_key;
              return (
                <div className="table-row" key={app.id}>
                  <span className="table-primary">
                    <strong>{name}</strong>
                    <small>{person?.email ?? "—"}</small>
                  </span>
                  <span style={{ fontWeight: 600 }}>{job ? job.title : "—"}</span>
                  <div>
                    <span className="badge">{statusLabel}</span>
                  </div>
                  <span className={`traffic traffic-${app.traffic_light ?? "none"}`}>
                    {app.traffic_light ? trafficLabels[app.traffic_light] : "Gris"}
                  </span>
                  <span style={{ opacity: 0.8 }}>{app.profiles?.full_name ?? "Sin asignar"}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{formatDateTime(app.updated_at)}</span>
                  <Link className="btn-ghost" to={`/crm/applications/${app.id}`} style={{ fontSize: '0.65rem' }}>
                    Gestionar
                  </Link>
                </div>
              );
            })}
          </div>
          {/* Show More */}
          {visibleCount < filteredApplications.length && (
            <div className="pipeline-load-more">
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              >
                Mostrar más
                <span className="pipeline-load-more__count">
                  {visibleCount} de {filteredApplications.length}
                </span>
              </button>
            </div>
          )}
          {visibleCount >= filteredApplications.length && filteredApplications.length > PAGE_SIZE && (
            <p className="pipeline-load-more__end">Mostrando todos los resultados ({filteredApplications.length})</p>
          )}
        </>
      )}
    </section>
  );
}
