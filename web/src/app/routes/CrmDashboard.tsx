import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { useAppToast } from "@/app/layouts/CrmLayout";
import {
  Users, Calendar, AlertTriangle, Activity, Download, Plus,
  Briefcase, MapPin, Clock, UserCircle2, ArrowRight
} from "lucide-react";

interface ApplicationRow {
  id: string;
  status_key: string;
  updated_at: string;
  submitted_at: string;
  traffic_light: "red" | "yellow" | "green" | null;
  assigned_to: string | null;
  recruit_job_postings: { id: string; title: string; branch: string | null; area: string | null } | null;
  recruit_candidates: { recruit_persons: { first_name: string; last_name: string; email: string | null } | null } | null;
  profiles: { id: string; full_name: string | null } | null;
}

interface RecruiterRow { id: string; full_name: string | null }
interface StatusRow { status_key: string; label: string; category: string; requires_reason: boolean }
interface JobRow { id: string; title: string }

// ── Grupos de fase para el filtro del pipeline ─────────────────────────────────
const STATUS_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Nuevos',        keys: ['new'] },
  { label: 'Validación',    keys: ['validation'] },
  { label: 'Entrevista',    keys: ['virtual_scheduled','virtual_done'] },
  { label: 'Documentación', keys: ['documents_pending','documents_complete'] },
  { label: 'Onboarding',    keys: ['onboarding','onboarding_scheduled'] },
  { label: 'Contratado',     keys: ['hired'] },
  { label: 'Descartado',     keys: ['rejected'] },
  { label: 'Descontratado',  keys: ['terminated'] },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#3d5afe','#8b5cf6','#f59e0b','#10b981','#ef4444','#06b6d4','#ec4899','#84cc16'];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function statusColor(category: string, key: string) {
  if (key === 'rejected') return '#ef4444';
  if (['hired','virtual_done'].includes(key)) return '#22c55e';
  if (category === 'interview' || key === 'virtual_scheduled') return '#8b5cf6';
  if (['onboarding','onboarding_scheduled'].includes(key)) return '#f59e0b';
  return 'var(--accent)';
}

function daysSince(iso: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function CrmDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useAppToast();
  const PAGE_SIZE = 18;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("Nuevos");
  const [jobFilter, setJobFilter] = useState("");
  const [recruiterFilter, setRecruiterFilter] = useState("");
  const [search, setSearch] = useState("");
  const [recruiters, setRecruiters] = useState<RecruiterRow[]>([]);

  const statusLabelMap = useMemo(() =>
    statuses.reduce<Record<string, string>>((acc, s) => { acc[s.status_key] = s.label; return acc; }, {}), [statuses]);
  const statusCategoryMap = useMemo(() =>
    statuses.reduce<Record<string, string>>((acc, s) => { acc[s.status_key] = s.category; return acc; }, {}), [statuses]);

  // CSV Export
  const exportCSV = (rows: ApplicationRow[]) => {
    const headers = ["Nombre","Email","Vacante","Sucursal","Estatus","Responsable","Días en proceso","Actualizado"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g,'""')}"`;
    const lines = rows.map(a => {
      const p = a.recruit_candidates?.recruit_persons;
      const name = `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim();
      return [esc(name||'Anónimo'),esc(p?.email),esc(a.recruit_job_postings?.title),
        esc(a.recruit_job_postings?.branch),esc(statusLabelMap[a.status_key]??a.status_key),
        esc(a.profiles?.full_name??'Sin asignar'),esc(daysSince(a.submitted_at)),
        esc(a.updated_at?new Date(a.updated_at).toLocaleDateString('es-MX',{timeZone:'America/Mexico_City'}):'')
      ].join(',');
    });
    const blob = new Blob(["\uFEFF",[headers.join(','),...lines].join('\r\n')],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pipeline_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!profile) return;
      setLoading(true); setError(null);
      let q = supabase.from("recruit_applications")
        .select("id,status_key,updated_at,submitted_at,traffic_light,assigned_to,recruit_job_postings(id,title,branch,area),recruit_candidates(recruit_persons(first_name,last_name,email)),profiles:assigned_to(full_name)")
        .order("updated_at",{ascending:false});
      if (profile.role !== "rh_admin") q = q.eq("assigned_to", profile.id);

      const [appsRes, statusRes, jobRes, recruiterRes] = await Promise.all([
        q,
        supabase.from("recruit_statuses").select("status_key,label,category,requires_reason").eq("is_active",true).order("sort_order"),
        supabase.from("recruit_job_postings").select("id,title").order("title"),
        supabase.from("profiles").select("id,full_name").in("role",["rh_admin","rh_recruiter"]).order("full_name"),
      ]);
      if (!active) return;
      if (appsRes.error) setError(appsRes.error.message);
      setApplications((appsRes.data as unknown as ApplicationRow[]) ?? []);
      setStatuses((statusRes.data as StatusRow[]) ?? []);
      setJobs((jobRes.data as JobRow[]) ?? []);
      setRecruiters((recruiterRes.data as RecruiterRow[]) ?? []);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [profile]);

  // Realtime
  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel('pipeline-changes')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'recruit_applications'}, async (payload) => {
        const { data: newApp, error } = await supabase
          .from("recruit_applications")
          .select("id,status_key,updated_at,submitted_at,traffic_light,assigned_to,recruit_job_postings(id,title,branch,area),recruit_candidates(recruit_persons(first_name,last_name,email)),profiles:assigned_to(full_name)")
          .eq("id", payload.new.id).single();
        if (error) {
          console.error('[Realtime] Error al cargar nueva solicitud:', error.message);
          return;
        }
        if (newApp) {
          const p = (newApp as any).recruit_candidates?.recruit_persons;
          toast.info(`NUEVA SOLICITUD: ${p?.first_name ?? 'Alguien'} ${p?.last_name ?? ''} → ${(newApp as any).recruit_job_postings?.title ?? 'vacante'}`);
          if (profile.role === "rh_admin" || newApp.assigned_to === profile.id)
            setApplications(prev => [newApp as unknown as ApplicationRow, ...prev]);
        }
      }).subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Error al suscribirse al canal pipeline-changes');
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [profile, toast]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const groupKeys = statusFilter
      ? STATUS_GROUPS.find(g => g.label === statusFilter)?.keys ?? []
      : [];
    return applications.filter(app => {
      if (statusFilter && !groupKeys.includes(app.status_key)) return false;
      if (jobFilter && app.recruit_job_postings?.id !== jobFilter) return false;
      if (recruiterFilter) {
        if (recruiterFilter === "__unassigned" && app.assigned_to) return false;
        if (recruiterFilter !== "__unassigned" && app.assigned_to !== recruiterFilter) return false;
      }
      if (term) {
        const p = app.recruit_candidates?.recruit_persons;
        const fullName = `${p?.first_name??''} ${p?.last_name??''}`.toLowerCase();
        if (!fullName.includes(term) && !(p?.email?.toLowerCase()??'').includes(term)) return false;
      }
      return true;
    });
  }, [applications, statusFilter, jobFilter, recruiterFilter, search]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [statusFilter, jobFilter, recruiterFilter, search]);

  const kpis = useMemo(() => {
    const terminalStatuses = ['hired', 'rejected', 'terminated'];
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0,0,0,0);
    const active = applications.filter(a => !terminalStatuses.includes(a.status_key)).length;
    const thisWeek = applications.filter(a => new Date(a.submitted_at) >= weekStart).length;
    const critical = applications.filter(a => a.traffic_light === "red").length;
    const withDays = applications.filter(a => a.submitted_at && a.updated_at);
    const avgDays = withDays.length > 0
      ? Math.round(withDays.reduce((s,a) => s + (new Date(a.updated_at).getTime()-new Date(a.submitted_at).getTime())/86400000, 0)/withDays.length)
      : 0;
    return { active, thisWeek, critical, avgDays };
  }, [applications]);

  const trafficDot: Record<string, string> = { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' };

  return (
    <section className="crm-section">
      {/* Header */}
      <div className="crm-header">
        <div>
          <span className="mono" style={{ fontSize: '0.6rem' }}>// RECLUTAMIENTO ACTIVO</span>
          <h2>Pipeline de Talento</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-ghost" type="button" onClick={() => exportCSV(filtered)}>
            <Download size={14} style={{ marginRight: '6px' }} /> Exportar CSV
          </button>
          {profile?.role === "rh_admin" && (
            <button className="btn-primary" type="button" onClick={() => navigate("/crm/admin")}>
              <Plus size={14} style={{ marginRight: '6px' }} /> Nueva Vacante
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <span className="kpi-label"><Users size={12} style={{ marginRight:'4px',opacity:.7 }} /> Solicitudes Activas</span>
          <strong className="kpi-value">{loading ? "—" : kpis.active}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label"><Calendar size={12} style={{ marginRight:'4px',opacity:.7 }} /> Esta Semana</span>
          <strong className="kpi-value">{loading ? "—" : kpis.thisWeek}</strong>
        </div>
        <div className="kpi-card kpi-card--alert">
          <span className="kpi-label"><AlertTriangle size={12} style={{ marginRight:'4px' }} /> Críticas</span>
          <strong className="kpi-value">{loading ? "—" : kpis.critical}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label"><Activity size={12} style={{ marginRight:'4px',opacity:.7 }} /> Días Promedio</span>
          <strong className="kpi-value">{loading ? "—" : `${kpis.avgDays}d`}</strong>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <label>Búsqueda
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Candidato o correo..." />
        </label>
        <label>Vacante
          <select className="input" value={jobFilter} onChange={e => setJobFilter(e.target.value)}>
            <option value="">Todas</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </label>
        <label>Fase
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Cualquiera</option>
            {STATUS_GROUPS.map(g => <option key={g.label} value={g.label}>{g.label}</option>)}
          </select>
        </label>
        <label>Reclutador
          <select className="input" value={recruiterFilter} onChange={e => setRecruiterFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="__unassigned">Sin asignar</option>
            {recruiters.map(r => <option key={r.id} value={r.id}>{r.full_name ?? "Reclutador"}</option>)}
          </select>
        </label>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding:'4rem', textAlign:'center' }}>
          <div className="mono">SINCRONIZANDO PIPELINE...</div>
        </div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="pro-card" style={{ textAlign:'center', padding:'4rem' }}>
          <h3 className="mono">SIN COINCIDENCIAS.</h3>
          <p style={{ color:'var(--text-dim)' }}>Reajusta los parámetros de búsqueda o filtros.</p>
        </div>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1.25rem', marginTop:'0.5rem' }}>
            {filtered.slice(0, visibleCount).map(app => {
              const person = app.recruit_candidates?.recruit_persons;
              const name = `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || 'Anónimo';
              const initials = name.split(' ').filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase();
              const job = app.recruit_job_postings;
              const statusLabel = statusLabelMap[app.status_key] ?? app.status_key;
              const category = statusCategoryMap[app.status_key] ?? 'pipeline';
              const color = statusColor(category, app.status_key);
              const days = daysSince(app.submitted_at);
              const tc = app.traffic_light ? trafficDot[app.traffic_light] : null;

              return (
                <Link
                  key={app.id}
                  to={`/crm/applications/${app.id}`}
                  className="pipeline-card"
                  style={{ textDecoration:'none', color:'inherit' }}
                >
                  {/* Traffic light stripe */}
                  {tc && <div style={{ height:'3px', background:tc, borderRadius:'12px 12px 0 0', margin:'-1.5rem -1.5rem 1.25rem' }} />}

                  {/* Top row: avatar + name + days */}
                  <div style={{ display:'flex', alignItems:'flex-start', gap:'0.85rem', marginBottom:'1rem' }}>
                    <div style={{ width:'42px', height:'42px', borderRadius:'50%', background:avatarColor(name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'0.8rem', fontWeight:800, color:'white', letterSpacing:'0.05em' }}>
                      {initials || <UserCircle2 size={20} />}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:'0.88rem', lineHeight:1.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</div>
                      <div style={{ fontSize:'0.65rem', opacity:0.5, marginTop:'0.15rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{person?.email ?? '—'}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.25rem', flexShrink:0, fontSize:'0.6rem', opacity:0.5, paddingTop:'0.1rem' }}>
                      <Clock size={10} />
                      <span>{days}d</span>
                    </div>
                  </div>

                  {/* Job info */}
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', marginBottom:'1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.72rem', fontWeight:600 }}>
                      <Briefcase size={12} style={{ opacity:0.5, flexShrink:0 }} />
                      <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{job?.title ?? '—'}</span>
                    </div>
                    {job?.branch && (
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.65rem', opacity:0.5 }}>
                        <MapPin size={11} style={{ flexShrink:0 }} />
                        <span>{job.branch}</span>
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem', fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.06em', padding:'0.3rem 0.75rem', borderRadius:'999px', background:`${color}18`, color, border:`1px solid ${color}40`, maxWidth:'100%', overflow:'hidden' }}>
                      <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:color, flexShrink:0 }} />
                      <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{statusLabel}</span>
                    </span>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.62rem', opacity:0.45 }}>
                      <UserCircle2 size={12} />
                      <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'90px' }}>
                        {app.profiles?.full_name ?? 'Sin asignar'}
                      </span>
                    </div>
                  </div>

                  {/* Footer: gestionar */}
                  <div style={{ marginTop:'1.1rem', paddingTop:'0.9rem', borderTop:'1px solid var(--border-light)', display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
                    <span style={{ fontSize:'0.62rem', fontWeight:800, color:'var(--accent)', display:'flex', alignItems:'center', gap:'0.3rem', letterSpacing:'0.05em' }}>
                      GESTIONAR <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {visibleCount < filtered.length && (
            <div className="pipeline-load-more">
              <button className="btn-ghost" type="button" onClick={() => setVisibleCount(p => p + PAGE_SIZE)}>
                Mostrar más
                <span className="pipeline-load-more__count">{visibleCount} de {filtered.length}</span>
              </button>
            </div>
          )}
          {visibleCount >= filtered.length && filtered.length > PAGE_SIZE && (
            <p className="pipeline-load-more__end">Mostrando todos los resultados ({filtered.length})</p>
          )}
        </>
      )}
    </section>
  );
}
