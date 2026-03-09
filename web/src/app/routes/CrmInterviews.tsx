import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import { useAuth } from "@/app/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabaseClient";
import { useAppToast } from "@/app/layouts/CrmLayout";

interface InterviewRow {
  id: string;
  interview_type: "phone" | "in_person";
  scheduled_at: string | null;
  location: string | null;
  result: "pending" | "pass" | "fail" | "no_show" | "reschedule";
  notes: string | null;
  recruit_applications: {
    id: string;
    status_key: string;
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
  { value: "pending", label: "Pendiente" },
  { value: "pass", label: "Aprobado" },
  { value: "fail", label: "No aprobado" },
  { value: "no_show", label: "No asistió" },
  { value: "reschedule", label: "Reagendar" },
] as const;

type DateFilter = "all" | "today" | "week";
type ViewMode = "list" | "calendar";

const MAX_NOTES = 500;

const resultColors: Record<string, string> = {
  pending: "#6366f1",
  pass: "#22c55e",
  fail: "#ef4444",
  no_show: "#f97316",
  reschedule: "#eab308",
};

const ensureSingle = <T,>(val: T | T[]): T | null => {
  if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
  return val;
};

function getUrgencyLevel(scheduledAt: string | null): "urgent" | "soon" | null {
  if (!scheduledAt) return null;
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff < 0) return null;
  if (diff < 2 * 60 * 60 * 1000) return "urgent";
  if (diff < 24 * 60 * 60 * 1000) return "soon";
  return null;
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
  // Selected event in calendar for detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const loadInterviews = async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("recruit_interviews")
      .select(
        "id, interview_type, scheduled_at, location, result, notes, recruit_applications(id, status_key, recruit_job_postings(title, branch), recruit_candidates(recruit_persons(first_name, last_name, email, phone)))",
      )
      .order("scheduled_at", { ascending: true });

    if (profile?.role === "interviewer") {
      query = query.eq("interviewer_id", profile.id);
    }

    const { data, error: loadError } = await query;
    if (loadError) setError(loadError.message);

    const normalized = (data as any[] ?? []).map(iv => {
      const app = ensureSingle(iv.recruit_applications);
      if (app) {
        app.recruit_job_postings = ensureSingle(app.recruit_job_postings);
        app.recruit_candidates = ensureSingle(app.recruit_candidates);
        if (app.recruit_candidates) {
          app.recruit_candidates.recruit_persons = ensureSingle(app.recruit_candidates.recruit_persons);
        }
      }
      return { ...iv, recruit_applications: app };
    });

    setInterviews(normalized);
    setLoading(false);
  };

  useEffect(() => {
    loadInterviews();
  }, [profile?.role, profile?.id]);

  const filteredInterviews = useMemo(() => {
    if (dateFilter === "all") return interviews;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    return interviews.filter((iv) => {
      if (!iv.scheduled_at) return false;
      const d = new Date(iv.scheduled_at);
      if (dateFilter === "today") return d >= todayStart && d < new Date(todayStart.getTime() + 86400000);
      if (dateFilter === "week") return d >= todayStart && d <= new Date(now.getTime() + 7 * 86400000);
      return true;
    });
  }, [interviews, dateFilter]);

  // FullCalendar events
  const calendarEvents = useMemo<EventInput[]>(() =>
    interviews
      .filter((iv) => iv.scheduled_at)
      .map((iv) => {
        const person = iv.recruit_applications?.recruit_candidates?.recruit_persons;
        const name = person ? `${person.first_name} ${person.last_name}` : "Candidato";
        const job = iv.recruit_applications?.recruit_job_postings;
        return {
          id: iv.id,
          title: `${name}${job ? ` · ${job.title}` : ""}`,
          start: iv.scheduled_at!,
          end: new Date(new Date(iv.scheduled_at!).getTime() + 60 * 60 * 1000).toISOString(),
          backgroundColor: resultColors[iv.result] ?? "#6366f1",
          borderColor: resultColors[iv.result] ?? "#6366f1",
          extendedProps: { interviewId: iv.id },
        };
      }),
    [interviews]);

  const handleSave = async (interview: InterviewRow) => {
    const edit = edits[interview.id];
    if (!edit) return;
    setSaving(interview.id);

    const { error: updateError } = await supabase
      .from("recruit_interviews")
      .update({ result: edit.result, notes: edit.notes.trim() || null })
      .eq("id", interview.id);

    setSaving(null);
    if (updateError) { toast.error(`Error al guardar: ${updateError.message}`); return; }
    toast.success("Resultado firmado correctamente");
    await loadInterviews();
  };

  // Drag & drop — reschedule interview
  const handleEventDrop = async (dropInfo: any) => {
    const interviewId = dropInfo.event.extendedProps.interviewId as string;
    const newStart = dropInfo.event.start;
    if (!newStart) return;

    const { error: updateError } = await supabase
      .from("recruit_interviews")
      .update({ scheduled_at: newStart.toISOString() })
      .eq("id", interviewId);

    if (updateError) {
      toast.error(`Error al reagendar: ${updateError.message}`);
      dropInfo.revert();
      return;
    }
    toast.success("Entrevista reagendada");
    await loadInterviews();
  };

  // Click on calendar event → select for detail
  const handleEventClick = (clickInfo: any) => {
    const interviewId = clickInfo.event.extendedProps.interviewId as string;
    setSelectedId((prev) => (prev === interviewId ? null : interviewId));
    setViewMode("list");     // switch to list so the detail card is visible
    setDateFilter("all");
  };

  // Memoized initial scroll time to current hour
  const initialScrollTime = useMemo(() => {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  // Sync scroll to current time when viewMode changes to calendar OR loading finishes
  useEffect(() => {
    if (!loading && viewMode === "calendar" && calendarRef.current) {
      const api = calendarRef.current.getApi();
      if (api) {
        // Force scroll with short delay to ensure calendar has finished layout
        setTimeout(() => {
          api.scrollToTime(initialScrollTime);
        }, 300);
      }
    }
  }, [viewMode, loading, initialScrollTime]);

  if (loading) return <LoadingScreen label="Cargando entrevistas" />;

  const selectedInterview = selectedId ? interviews.find((iv) => iv.id === selectedId) ?? null : null;

  return (
    <section className="crm-section">
      <div className="crm-header">
        <div>
          <p className="eyebrow">// AUDITORÍA DE TALENTO</p>
          <h2 style={{ fontSize: '3rem', letterSpacing: '-0.05em' }}>Plan de Entrevistas</h2>
          <p>Registra dictámenes técnicos y observaciones en tiempo real.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View mode toggle */}
          <div className="interview-date-filter">
            <button type="button" className={`btn-ghost ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>
              ☰ Lista
            </button>
            <button type="button" className={`btn-ghost ${viewMode === "calendar" ? "active" : ""}`} onClick={() => setViewMode("calendar")}>
              📅 Calendario
            </button>
          </div>
          {/* Date filter — only in list mode */}
          {viewMode === "list" && (
            <div className="interview-date-filter">
              {(["all", "today", "week"] as DateFilter[]).map((f) => (
                <button key={f} type="button" className={`btn-ghost ${dateFilter === f ? "active" : ""}`} onClick={() => setDateFilter(f)}>
                  {f === "all" ? "Todas" : f === "today" ? "Hoy" : "Esta semana"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {/* ─── CALENDAR VIEW ─── */}
      {viewMode === "calendar" && (
        <div className="interview-calendar-wrap">
          <div className="interview-calendar-hint">
            💡 Arrastra los eventos para reagendar · Haz clic en un evento para ver su detalle
          </div>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            allDaySlot={false}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            locale="es"
            firstDay={1}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            scrollTime={initialScrollTime}
            slotDuration="01:00:00"
            slotLabelInterval="01:00"
            slotLabelFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              meridiem: 'short'
            }}
            height="auto"
            contentHeight="auto"
            events={calendarEvents}
            editable={true}
            droppable={true}
            eventDrop={handleEventDrop}
            eventClick={handleEventClick}
            nowIndicator={true}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              meridiem: 'short'
            }}
            buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día" }}
          />
          {selectedInterview && (
            <div className="interview-calendar-detail">
              <InterviewCard
                interview={selectedInterview}
                edit={edits[selectedInterview.id] ?? { result: selectedInterview.result, notes: selectedInterview.notes ?? "" }}
                isSaving={saving === selectedInterview.id}
                onEditChange={(edit) => setEdits((prev) => ({ ...prev, [selectedInterview.id]: edit }))}
                onSave={() => handleSave(selectedInterview)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* ─── LIST VIEW ─── */}
      {viewMode === "list" && (
        filteredInterviews.length === 0 ? (
          <div className="empty-state">
            <h3>No hay entrevistas {dateFilter !== "all" ? "en este período" : "asignadas"}</h3>
            <p>Cuando se agenden, aparecerán aquí.</p>
          </div>
        ) : (
          <div className="detail-grid">
            {filteredInterviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                interview={interview}
                edit={edits[interview.id] ?? { result: interview.result, notes: interview.notes ?? "" }}
                isSaving={saving === interview.id}
                highlighted={interview.id === selectedId}
                onEditChange={(edit) => setEdits((prev) => ({ ...prev, [interview.id]: edit }))}
                onSave={() => handleSave(interview)}
              />
            ))}
          </div>
        )
      )}
    </section>
  );
}

// ─── Reusable InterviewCard ───────────────────────────────────────
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
  const job = interview.recruit_applications?.recruit_job_postings;
  const urgency = getUrgencyLevel(interview.scheduled_at);
  const notesLength = edit.notes.length;

  return (
    <div className={`card interview-card ${urgency ? `interview-card--${urgency}` : ""} ${highlighted ? "interview-card--highlighted" : ""}`}>
      {onClose && (
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '1.2rem' }}>✕</button>
      )}
      {urgency && (
        <div className={`interview-urgency-badge interview-urgency-badge--${urgency}`}>
          {urgency === "urgent" ? "⚡ URGENTE — menos de 2h" : "🕐 HOY"}
        </div>
      )}
      <div style={{ marginBottom: '1.5rem' }}>
        <p className="eyebrow" style={{ fontSize: '0.5rem' }}>CANDIDATO ASIGNADO</p>
        <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
          {candidate ? `${candidate.first_name} ${candidate.last_name}` : "Candidato sin nombre"}
        </strong>
        <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>{candidate?.email ?? "Sin correo registrado"}</p>
        <div style={{ marginTop: '0.8rem', padding: '0.4rem 0.8rem', background: 'var(--bg-accent)', borderRadius: '8px', display: 'inline-block' }}>
          <small style={{ fontWeight: 800, fontSize: '0.65rem', color: 'var(--accent)' }}>
            {job ? `${job.title}${job.branch ? ` · ${job.branch}` : ""}` : "Vacante General"}
          </small>
        </div>
      </div>
      <div className="interview-meta">
        <span>{interview.interview_type === "phone" ? "Filtro Telefónico" : "Presencial / Meet"}</span>
        <span>{formatDateTime(interview.scheduled_at)}</span>
        <span>{interview.location ?? "Remoto"}</span>
      </div>
      <div className="form-stack" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-dim)', paddingTop: '1.5rem' }}>
        <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-dim)' }}>
          DICTAMEN FINAL
          <select
            className="input"
            style={{ marginTop: '0.4rem' }}
            value={edit.result}
            onChange={(e) => onEditChange({ ...edit, result: e.target.value as InterviewRow["result"] })}
          >
            {resultOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-dim)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>OBSERVACIONES TÉCNICAS</span>
            <span style={{ fontWeight: 400, opacity: notesLength > MAX_NOTES * 0.8 ? 1 : 0.4, color: notesLength >= MAX_NOTES ? '#ef4444' : 'inherit' }}>
              {notesLength}/{MAX_NOTES}
            </span>
          </div>
          <textarea
            className="input"
            style={{ marginTop: '0.4rem', minHeight: '80px' }}
            placeholder="Escribe el feedback para el equipo de RH..."
            maxLength={MAX_NOTES}
            value={edit.notes}
            onChange={(e) => onEditChange({ ...edit, notes: e.target.value })}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn-primary" style={{ flex: 1, fontSize: '0.65rem' }} type="button" disabled={isSaving} onClick={onSave}>
            {isSaving ? "Guardando..." : "Firmar Resultado"}
          </button>
          {interview.recruit_applications?.id ? (
            <Link className="btn-ghost" style={{ fontSize: '0.65rem' }} to={`/crm/applications/${interview.recruit_applications.id}`}>
              Expediente
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
