import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

interface Notification {
    id: string;
    type: "new_application" | "status_changed" | "interview_soon" | "doc_uploaded";
    title: string;
    body: string;
    read: boolean;
    timestamp: Date;
    linkTo?: string;
}

function buildNotification(eventKey: string, metadata: Record<string, unknown>): Omit<Notification, "id" | "read" | "timestamp"> | null {
    switch (eventKey) {
        case "new_application":
            return {
                type: "new_application",
                title: "Nueva solicitud",
                body: `${metadata.candidate_name ?? "Candidato"} aplicó para ${metadata.job_title ?? "una vacante"}`,
                linkTo: metadata.application_id ? `/crm/applications/${metadata.application_id}` : "/crm",
            };
        case "status_changed":
            return {
                type: "status_changed",
                title: "Cambio de estatus",
                body: `De "${metadata.from_status_key ?? "—"}" → "${metadata.to_status_key ?? "—"}"`,
                linkTo: metadata.application_id ? `/crm/applications/${metadata.application_id}` : undefined,
            };
        case "doc_uploaded":
            return {
                type: "doc_uploaded",
                title: "Documento recibido",
                body: `${metadata.doc_type ?? "Documento"} subido por ${metadata.candidate_name ?? "candidato"}`,
                linkTo: metadata.application_id ? `/crm/applications/${metadata.application_id}` : undefined,
            };
        case "interview_soon":
            return {
                type: "interview_soon",
                title: "Entrevista próxima",
                body: `En ${metadata.minutes_until ?? "?"} min con ${metadata.candidate_name ?? "candidato"}`,
                linkTo: metadata.application_id ? `/crm/applications/${metadata.application_id}` : undefined,
            };
        case "email_sent":
            return {
                type: "new_application",
                title: "Correo enviado",
                body: `Correo enviado a ${metadata.to_address ?? "destinatario"}`,
            };
        case "email_failed":
            return {
                type: "new_application",
                title: "Correo fallido",
                body: `No se pudo enviar a ${metadata.to_address ?? "destinatario"}`,
            };
        default:
            return null;
    }
}

let notifIdCounter = 0;

export default function NotificationBell() {
    const { profile } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter((n) => !n.read).length;

    // Carga inicial: últimos 20 eventos de la BD
    useEffect(() => {
        if (!profile) return;

        void Promise.resolve(
            supabase
                .from("recruit_event_logs")
                .select("id, event_key, metadata, application_id, created_at")
                .eq("created_by", profile.id)
                .order("created_at", { ascending: false })
                .limit(20)
        ).then(({ data }) => {
            if (!data) return;
            const loaded: Notification[] = data
                .map((row) => {
                    const meta = { ...(row.metadata ?? {}), application_id: row.application_id };
                    const built = buildNotification(row.event_key, meta);
                    if (!built) return null;
                    return {
                        id: `notif-${++notifIdCounter}`,
                        read: true,
                        timestamp: new Date(row.created_at),
                        ...built,
                    } as Notification;
                })
                .filter(Boolean) as Notification[];
            setNotifications(loaded);
        }).catch(() => { /* notificaciones no disponibles, no es bloqueante */ });
    }, [profile]);

    // Supabase Realtime — nuevos eventos en vivo
    useEffect(() => {
        if (!profile) return;

        const channel = supabase
            .channel("crm-events")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "recruit_event_logs",
                },
                (payload) => {
                    const row = payload.new as {
                        event_key: string;
                        metadata: Record<string, unknown>;
                        application_id?: string;
                    };

                    const meta = { ...(row.metadata ?? {}), application_id: row.application_id };
                    const built = buildNotification(row.event_key, meta);
                    if (!built) return;

                    const notif: Notification = {
                        id: `notif-${++notifIdCounter}`,
                        read: false,
                        timestamp: new Date(),
                        ...built,
                    };

                    setNotifications((prev) => [notif, ...prev].slice(0, 30));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const markAllRead = () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    const clearAll = async () => {
        setNotifications([]);
        setOpen(false);
        if (!profile) return;
        await supabase
            .from("recruit_event_logs")
            .delete()
            .eq("created_by", profile.id);
    };

    const timeAgo = (date: Date) => {
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "ahora";
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    };

    return (
        <div className="notif-wrapper" ref={panelRef}>
            <button
                className="notif-bell"
                type="button"
                onClick={() => {
                    setOpen((prev) => !prev);
                    if (!open && unreadCount > 0) markAllRead();
                }}
                aria-label="Notificaciones"
                title="Notificaciones en tiempo real"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
            </button>

            {open && (
                <div className="notif-panel">
                    <div className="notif-panel__header">
                        <span>Notificaciones</span>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            {notifications.length > 0 && (
                                <button className="notif-action" type="button" onClick={clearAll}>
                                    Limpiar
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="notif-panel__list">
                        {notifications.length === 0 ? (
                            <div className="notif-empty">
                                <p>Sin notificaciones recientes</p>
                                <small>Los eventos aparecen aquí en tiempo real</small>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <a
                                    key={notif.id}
                                    className={`notif-item ${notif.read ? "notif-item--read" : ""}`}
                                    href={notif.linkTo ?? "#"}
                                    onClick={(e) => {
                                        if (!notif.linkTo) e.preventDefault();
                                        setOpen(false);
                                    }}
                                >
                                    <div className={`notif-dot notif-dot--${notif.type}`} />
                                    <div className="notif-item__content">
                                        <strong>{notif.title}</strong>
                                        <span>{notif.body}</span>
                                    </div>
                                    <small className="notif-item__time">{timeAgo(notif.timestamp)}</small>
                                </a>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
