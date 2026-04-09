import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import { useAuth } from "@/app/AuthProvider";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabaseClient";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabaseClient";
import { useAppToast } from "@/app/layouts/CrmLayout";
import {
  Calendar, List, AlertTriangle, Clock, Video, MapPin,
  X, ExternalLink, CheckCircle, XCircle, UserCircle2,
  CalendarDays, Hourglass, ThumbsUp, Briefcase
} from "lucide-react";

interface InterviewRow {
  id: string;
  interview_type: "phone" | "in_person" | "virtual";
  scheduled_at: string | null;
  location: string | null;
  result: "pending" | "pass" | "fail" | "no_show" | "reschedule";
  notes: string | null;
  recruit_applications: {
    id: string;
    status_key: string;
    meet_link: string | null;
    recruit_job_postings: { title: string; branch: string | null } | null;
    recruit_candidates: {
      recruit_persons: {
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
      } | null;
    } | null;
  } | null;
}

const resultOptions = [
  { value: "pending", label: "Pendiente"                           },
  { value: "pass",    label: "Aprobado — pasar a la siguiente fase" },
  { value: "fail",    label: "No aprobado — cerrar solicitud"       },
] as const;

type DateFilter = "all" | "today" | "week";
type ViewMode  = "list" | "calendar";
const MAX_NOTES = 500;

const RESULT_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: '#6366f1', label: 'Pendiente'   },
  pass:    { color: '#22c55e', label: 'Aprobado'    },
  fail:    { color: '#ef4444', label: 'No aprobado' },
  no_show: { color: '#f97316', label: 'No asistió'  },
};

const AVATAR_COLORS = ['#3d5afe','#8b5cf6','#f59e0b','#10b981','#ef4444','#06b6d4','#ec4899'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const ensureSingle = <T,>(val: T | T[]): T | null => Array.isArray(val) ? (val[0] ?? null) : val;

function getUrgency(scheduledAt: string | null): "urgent" | "soon" | null {
  if (!scheduledAt) return null;
  const now = new Date();
  const scheduled = new Date(scheduledAt);
  const diff = scheduled.getTime() - now.getTime();
  if (diff < 0) return null;
  // Solo aplicar si es el mismo día calendario
  const isToday = scheduled.getFullYear() === now.getFullYear()
    && scheduled.getMonth() === now.getMonth()
    && scheduled.getDate() === now.getDate();
  if (!isToday) return null;
  if (diff < 2 * 3600000) return "urgent";
  return "soon";
}

export default function CrmInterviews() {
  const { profile } = useAuth();
  const { toast } = useAppToast();
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { result: InterviewRow["result"]; notes: string }>>({});
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const loadInterviews = async () => {
    setLoading(true); setError(null);
    let query = supabase.from("recruit_interviews")
      .select("id,interview_type,scheduled_at,location,result,notes,recruit_applications(id,status_key,meet_link,recruit_job_postings(title,branch),recruit_candidates(recruit_persons(first_name,last_name,email,phone)))")
      .order("scheduled_at", { ascending: true });
    if (profile?.role === "interviewer") query = query.eq("interviewer_id", profile.id);
    const { data, error: err } = await query;
    if (err) setError(err.message);
    const normalized = (data as any[] ?? []).map(iv => {
      const app = ensureSingle(iv.recruit_applications);
      if (app) {
        app.recruit_job_postings = ensureSingle(app.recruit_job_postings);
        app.recruit_candidates   = ensureSingle(app.recruit_candidates);
        if (app.recruit_candidates) app.recruit_candidates.recruit_persons = ensureSingle(app.recruit_candidates.recruit_persons);
      }
      return { ...iv, recruit_applications: app };
    });
    setInterviews(normalized);
    setLoading(false);
  };

  useEffect(() => { loadInterviews(); }, [profile?.role, profile?.id]);

  // Aplicar ancho del eje de horas cada vez que el calendario es visible
  useEffect(() => {
    if (viewMode !== 'calendar') return;
    const apply = () => {
      // table.fc-col-header  → la tabla del header (fc-col-header ES la tabla, no un contenedor)
      // .fc-timegrid-body table → la tabla del body
      document.querySelectorAll('table.fc-col-header, .fc-timegrid-body table').forEach(table => {
        const col = table.querySelector('colgroup > col:first-child') as HTMLElement | null;
        if (col) { col.style.width = '120px'; col.style.minWidth = '120px'; }
      });
    };
    const timers = [100, 300, 700].map(ms => setTimeout(apply, ms));
    return () => timers.forEach(clearTimeout);
  }, [viewMode]);

  const filteredInterviews = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const filtered = dateFilter === "all" ? [...interviews] : interviews.filter(iv => {
      if (!iv.scheduled_at) return false;
      const d = new Date(iv.scheduled_at);
      if (dateFilter === "today") return d >= todayStart && d < new Date(todayStart.getTime() + 86400000);
      if (dateFilter === "week")  return d >= todayStart && d <= new Date(now.getTime() + 7*86400000);
      return true;
    });
    // Pendientes primero, luego por fecha ascendente
    return filtered.sort((a, b) => {
      const aPending = a.result === 'pending' ? 0 : 1;
      const bPending = b.result === 'pending' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return new Date(a.scheduled_at ?? 0).getTime() - new Date(b.scheduled_at ?? 0).getTime();
    });
  }, [interviews, dateFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(todayStart.getTime() + 86400000);
    const weekEnd    = new Date(now.getTime() + 7*86400000);
    return {
      today:    interviews.filter(iv => iv.scheduled_at && new Date(iv.scheduled_at) >= todayStart && new Date(iv.scheduled_at) < todayEnd).length,
      week:     interviews.filter(iv => iv.scheduled_at && new Date(iv.scheduled_at) >= todayStart && new Date(iv.scheduled_at) <= weekEnd).length,
      pending:  interviews.filter(iv => iv.result === 'pending').length,
      approved: interviews.filter(iv => iv.result === 'pass').length,
    };
  }, [interviews]);

  const DONE_RESULTS = ['pass', 'fail', 'no_show'];

  const calendarEvents = useMemo<EventInput[]>(() =>
    interviews.filter(iv => iv.scheduled_at).map(iv => {
      const p = iv.recruit_applications?.recruit_candidates?.recruit_persons;
      const name = p ? `${p.first_name} ${p.last_name}` : "Candidato";
      const job  = iv.recruit_applications?.recruit_job_postings;
      const cfg  = RESULT_CONFIG[iv.result] ?? RESULT_CONFIG.pending;
      const done = DONE_RESULTS.includes(iv.result);
      return {
        id: iv.id,
        title: `${name}${job ? ` · ${job.title}` : ""}`,
        start: iv.scheduled_at!,
        end: new Date(new Date(iv.scheduled_at!).getTime() + 3600000).toISOString(),
        backgroundColor: cfg.color,
        borderColor: cfg.color,
        editable: !done,
        extendedProps: { interviewId: iv.id, applicationId: iv.recruit_applications?.id ?? null },
      };
    }), [interviews]);

  const handleSave = async (interview: InterviewRow) => {
    const edit = edits[interview.id]; if (!edit) return;
    setSaving(interview.id);
    const { error: updateError } = await supabase.from("recruit_interviews")
      .update({ result: edit.result, notes: edit.notes.trim() || null }).eq("id", interview.id);
    if (updateError) { setSaving(null); toast.error(`Error: ${updateError.message}`); return; }
    const appId = interview.recruit_applications?.id;
    if (appId && (edit.result === "pass" || edit.result === "fail")) {
      await supabase.functions.invoke("change_status", {
        body: { application_id: appId, status_key: edit.result === "pass" ? "documents_pending" : "rejected",
          reason: `Resultado: ${edit.result === "pass" ? "APROBADO" : "NO APROBADO"}`, note: edit.notes.trim() || null }
      });
    }
    setSaving(null);
    toast.success("Resultado firmado con éxito");
    await loadInterviews();
  };

  const handleEventDrop = async (info: any) => {
    const interviewId  = info.event.extendedProps.interviewId as string;
    const applicationId = info.event.extendedProps.applicationId as string | null;

    const { error: err } = await supabase.from("recruit_interviews")
      .update({ scheduled_at: info.event.start.toISOString() }).eq("id", interviewId);
    if (err) { toast.error(`Error al reagendar: ${err.message}`); info.revert(); return; }

    // Notificar al candidato y al reclutador
    if (applicationId) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": supabaseAnonKey! };
        // Candidato: notificación de reagendado
        fetch(`${supabaseUrl}/functions/v1/send_email`, {
          method: "POST", headers,
          body: JSON.stringify({ application_id: applicationId, template_key: "virtual_reschedule_candidate" }),
        });
        // Reclutador: notificación de reagendado
        fetch(`${supabaseUrl}/functions/v1/send_email`, {
          method: "POST", headers,
          body: JSON.stringify({ application_id: applicationId, template_key: "virtual_reschedule_recruiter" }),
        });
      }
    }

    toast.success("Entrevista reagendada — notificaciones enviadas");
    await loadInterviews();
  };

  const handleEventClick = (info: any) => {
    const ivId = info.event.extendedProps.interviewId as string;
    setSelectedId(prev => prev === ivId ? null : ivId);
    // Sincronizar el estado de edición con el registro actual de esa entrevista
    const iv = interviews.find(i => i.id === ivId);
    if (iv) setEdits(prev => ({ ...prev, [ivId]: { result: iv.result, notes: iv.notes ?? "" } }));
    setViewMode("list"); setDateFilter("all");
  };

  const fixAxisCol = () => {
    const apply = () => {
      document.querySelectorAll('table.fc-col-header, .fc-timegrid-body table').forEach(table => {
        const col = table.querySelector('colgroup > col:first-child') as HTMLElement | null;
        if (col) { col.style.width = '120px'; col.style.minWidth = '120px'; }
      });
    };
    [60, 200, 500].forEach(ms => setTimeout(apply, ms));
  };

  const scrollCalendarToNow = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    fixAxisCol();
    const offset = new Date(Date.now() - 30 * 60 * 1000);
    const h = offset.getHours().toString().padStart(2, '0');
    const m = offset.getMinutes().toString().padStart(2, '0');
    api.scrollToTime(`${h}:${m}:00`);
  };


  if (loading) return null;

  const selectedInterview = selectedId ? interviews.find(iv => iv.id === selectedId) ?? null : null;

  return (
    <section className="crm-section">
      {/* Header */}
      <div className="crm-header">
        <div>
          <span className="mono" style={{ fontSize:'0.6rem' }}>// AUDITORÍA DE TALENTO</span>
          <h2>Plan de Entrevistas</h2>
        </div>
        <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
          <div className="interview-date-filter">
            <button type="button" className={`btn-ghost ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>
              <List size={14} style={{ marginRight:'5px' }} /> Lista
            </button>
            <button type="button" className={`btn-ghost ${viewMode === "calendar" ? "active" : ""}`} onClick={() => setViewMode("calendar")}>
              <Calendar size={14} style={{ marginRight:'5px' }} /> Calendario
            </button>
          </div>
          {viewMode === "list" && (
            <div className="interview-date-filter">
              {(["all","today","week"] as DateFilter[]).map(f => (
                <button key={f} type="button" className={`btn-ghost ${dateFilter === f ? "active" : ""}`} onClick={() => setDateFilter(f)}>
                  {f === "all" ? "Todas" : f === "today" ? "Hoy" : "Esta semana"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Strip — solo en lista */}
      {viewMode === "list" && <div className="kpi-strip">
        <div className="kpi-card">
          <span className="kpi-label"><CalendarDays size={12} style={{ marginRight:'4px', opacity:.7 }} /> Hoy</span>
          <strong className="kpi-value">{kpis.today}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label"><Calendar size={12} style={{ marginRight:'4px', opacity:.7 }} /> Esta semana</span>
          <strong className="kpi-value">{kpis.week}</strong>
        </div>
        <div className="kpi-card kpi-card--alert">
          <span className="kpi-label"><Hourglass size={12} style={{ marginRight:'4px' }} /> Pendientes</span>
          <strong className="kpi-value">{kpis.pending}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label"><ThumbsUp size={12} style={{ marginRight:'4px', opacity:.7 }} /> Aprobadas</span>
          <strong className="kpi-value">{kpis.approved}</strong>
        </div>
      </div>}

      {error && <p className="error">{error}</p>}

      {/* Calendar */}
      {viewMode === "calendar" && (
        <div className="interview-calendar-wrap">
          <div className="interview-calendar-hint">
            Arrastra los eventos para reagendar · Haz clic para ver el detalle
          </div>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            allDaySlot={false}
            headerToolbar={{ left:"prev,next today", center:"title", right:"dayGridMonth,timeGridWeek,timeGridDay" }}
            locale="es" firstDay={1}
            slotMinTime="07:00:00" slotMaxTime="22:00:00"
            slotDuration="01:00:00"
            viewDidMount={scrollCalendarToNow}
            datesSet={fixAxisCol}
            slotLabelFormat={{ hour:'2-digit', minute:'2-digit', hour12:true, meridiem:'short' }}
            slotLabelInterval="01:00:00"
            height="auto" contentHeight="auto"
            events={calendarEvents} editable droppable
            eventDrop={handleEventDrop} eventClick={handleEventClick}
            nowIndicator
            eventTimeFormat={{ hour:'2-digit', minute:'2-digit', hour12:true, meridiem:'short' }}
            buttonText={{ today:"Hoy", month:"Mes", week:"Semana", day:"Día" }}
          />
          {selectedInterview && (
            <div className="interview-calendar-detail">
              <InterviewCard
                interview={selectedInterview}
                edit={edits[selectedInterview.id] ?? { result: selectedInterview.result, notes: selectedInterview.notes ?? "" }}
                isSaving={saving === selectedInterview.id}
                onEditChange={edit => setEdits(prev => ({ ...prev, [selectedInterview.id]: edit }))}
                onSave={() => handleSave(selectedInterview)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* List */}
      {viewMode === "list" && (
        filteredInterviews.length === 0 ? (
          <div className="pro-card" style={{ textAlign:'center', padding:'4rem' }}>
            <h3 className="mono">SIN ENTREVISTAS</h3>
            <p style={{ color:'var(--text-dim)', marginTop:'0.5rem' }}>
              {dateFilter !== "all" ? "No hay entrevistas en este período." : "Aún no se han agendado entrevistas."}
            </p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1.25rem', marginTop:'0.5rem' }}>
            {filteredInterviews.map(iv => (
              <InterviewCard
                key={iv.id}
                interview={iv}
                edit={edits[iv.id] ?? { result: iv.result, notes: iv.notes ?? "" }}
                isSaving={saving === iv.id}
                highlighted={iv.id === selectedId}
                onEditChange={edit => setEdits(prev => ({ ...prev, [iv.id]: edit }))}
                onSave={() => handleSave(iv)}
              />
            ))}
          </div>
        )
      )}
    </section>
  );
}

// ─── InterviewCard ─────────────────────────────────────────────────────────────
interface InterviewCardProps {
  interview: InterviewRow;
  edit: { result: InterviewRow["result"]; notes: string };
  isSaving: boolean;
  highlighted?: boolean;
  onEditChange: (edit: { result: InterviewRow["result"]; notes: string }) => void;
  onSave: () => void;
  onClose?: () => void;
}

function InterviewCard({ interview, edit, isSaving, highlighted, onEditChange, onSave, onClose }: InterviewCardProps) {
  const candidate = interview.recruit_applications?.recruit_candidates?.recruit_persons;
  const job       = interview.recruit_applications?.recruit_job_postings;
  const urgency   = getUrgency(interview.scheduled_at);
  const name      = candidate ? `${candidate.first_name} ${candidate.last_name}` : "Candidato";
  const initials  = name.split(' ').filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase();
  const isDone    = ['pass','fail','no_show'].includes(interview.result);
  const meetLink  = interview.recruit_applications?.meet_link;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${highlighted ? 'var(--accent)' : (!isDone && urgency === 'urgent') ? '#ef4444' : (!isDone && urgency === 'soon') ? '#f59e0b' : 'var(--border-light)'}`,
      borderRadius: '18px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'box-shadow 0.18s',
      boxShadow: highlighted ? '0 0 0 3px rgba(61,90,254,0.15)' : undefined,
    }}>

      {/* Urgency bar */}
      {urgency && !isDone && (
        <div style={{ padding:'0.45rem 1.25rem', background: urgency === 'urgent' ? '#ef4444' : '#f59e0b', display:'flex', alignItems:'center', gap:'0.4rem' }}>
          <AlertTriangle size={11} style={{ color:'white' }} />
          <span style={{ fontSize:'0.58rem', fontWeight:800, color:'white', letterSpacing:'0.06em' }}>
            {urgency === 'urgent' ? 'URGENTE — MENOS DE 2H' : 'ENTREVISTA HOY'}
          </span>
        </div>
      )}

      <div style={{ padding:'1.4rem', flex:1, display:'flex', flexDirection:'column', gap:'1rem' }}>

        {/* Top: avatar + candidate + close */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:'0.85rem' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:avatarColor(name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'0.82rem', fontWeight:800, color:'white' }}>
            {initials || <UserCircle2 size={20} />}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:'0.9rem', lineHeight:1.2 }}>{name}</div>
            <div style={{ fontSize:'0.63rem', opacity:0.5, marginTop:'0.1rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{candidate?.email ?? '—'}</div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-dim)', padding:'0.1rem', flexShrink:0 }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Job */}
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.75rem', background:'var(--glass)', borderRadius:'10px' }}>
          <Briefcase size={12} style={{ opacity:0.5, flexShrink:0 }} />
          <span style={{ fontSize:'0.7rem', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {job ? `${job.title}${job.branch ? ` · ${job.branch}` : ''}` : 'Vacante general'}
          </span>
        </div>

        {/* Date / location / type */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.7rem' }}>
            <Clock size={13} style={{ color:'var(--accent)', flexShrink:0 }} />
            <span style={{ fontWeight:700 }}>{interview.scheduled_at ? formatDateTime(interview.scheduled_at) : '—'}</span>
          </div>
          {interview.location && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.65rem', opacity:0.55 }}>
              <MapPin size={12} style={{ flexShrink:0 }} />
              <span>{interview.location}</span>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.63rem', opacity:0.55 }}>
            <Video size={12} style={{ flexShrink:0 }} />
            <span>{interview.interview_type === 'phone' ? 'Filtro telefónico' : 'Reunión virtual / Meet'}</span>
          </div>
        </div>

        {/* Result badge (read-only when done) */}
        {isDone ? (
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.9rem', borderRadius:'999px', background:`${RESULT_CONFIG[interview.result].color}18`, border:`1px solid ${RESULT_CONFIG[interview.result].color}40`, width:'fit-content' }}>
            {interview.result === 'pass'
              ? <CheckCircle size={13} style={{ color:RESULT_CONFIG.pass.color }} />
              : <XCircle size={13} style={{ color:RESULT_CONFIG[interview.result].color }} />}
            <span style={{ fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.06em', color:RESULT_CONFIG[interview.result].color }}>
              {RESULT_CONFIG[interview.result].label.toUpperCase()}
            </span>
          </div>
        ) : (
          /* Edit form */
          <div style={{ borderTop:'1px solid var(--border-light)', paddingTop:'1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <label style={{ fontSize:'0.6rem', fontWeight:800, color:'var(--text-dim)' }}>
              DICTAMEN
              <select className="input" style={{ marginTop:'0.35rem' }} value={edit.result}
                onChange={e => onEditChange({ ...edit, result: e.target.value as InterviewRow["result"] })}>
                {resultOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize:'0.6rem', fontWeight:800, color:'var(--text-dim)' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>OBSERVACIONES</span>
                <span style={{ fontWeight:400, opacity: edit.notes.length > MAX_NOTES*0.8 ? 1 : 0.4, color: edit.notes.length >= MAX_NOTES ? '#ef4444' : 'inherit' }}>
                  {edit.notes.length}/{MAX_NOTES}
                </span>
              </div>
              <textarea className="input" style={{ marginTop:'0.35rem', minHeight:'70px', resize:'vertical' }}
                placeholder="Feedback para el equipo de RH..." maxLength={MAX_NOTES}
                value={edit.notes} onChange={e => onEditChange({ ...edit, notes: e.target.value })} />
            </label>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ padding:'0.9rem 1.4rem', borderTop:'1px solid var(--border-light)', display:'flex', gap:'0.6rem', background:'var(--bg-soft)' }}>
        {!isDone && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.3rem' }}>
            <button className="btn-primary" style={{ width:'100%', fontSize:'0.63rem', padding:'0.7rem' }}
              type="button" disabled={isSaving || edit.result === 'pending'} onClick={onSave}>
              {isSaving ? 'Guardando...' : 'Firmar resultado'}
            </button>
            {edit.result === 'pending' && (
              <span style={{ fontSize:'0.55rem', color:'var(--text-dim)', textAlign:'center', opacity:0.7 }}>
                Selecciona un dictamen para continuar
              </span>
            )}
          </div>
        )}
        {meetLink && !isDone && (
          <a href={meetLink} target="_blank" rel="noreferrer" className="btn-ghost"
            style={{ fontSize:'0.63rem', padding:'0.7rem 0.9rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <Video size={13} /> Meet
          </a>
        )}
        {interview.recruit_applications?.id && (
          <Link className="btn-ghost" to={`/crm/applications/${interview.recruit_applications.id}`}
            style={{ fontSize:'0.63rem', padding:'0.7rem 0.9rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <ExternalLink size={13} /> Expediente
          </Link>
        )}
      </div>
    </div>
  );
}
