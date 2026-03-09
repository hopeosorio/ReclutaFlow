import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import InteractiveStars from "@/components/InteractiveStars";
import {
    Check,
    Clock,
    Zap,
    Pencil,
    FileText,
    ExternalLink,
    Send,
    Search,
    UserCheck,
    Video,
    XCircle,
    ArrowRight,
    ShieldCheck
} from "lucide-react";

interface Application {
    id: string;
    status_key: string;
    meet_link: string | null;
    profiles: {
        full_name: string | null;
    } | null;
    recruit_job_postings: {
        title: string;
    } | null;
    recruit_candidates: {
        recruit_persons: {
            first_name: string;
            last_name: string;
        } | null;
    } | null;
}

interface DocumentInfo {
    id: string;
    name: string;
    is_required: boolean;
    stage: string;
    existing: {
        id: string;
        validation_status: string;
        validation_notes: string | null;
        storage_path: string | null;
    } | null;
}

// Map of all possible DB status keys to UI display data
const friendlyStatusMap: Record<string, { label: string; icon: any; color: string; desc: string }> = {
    new: {
        label: "SOLICITUD RECIBIDA",
        icon: Send,
        color: "#3d5afe",
        desc: "Tu solicitud ha entrado a nuestro sistema correctamente. En esta fase inicial, el sistema procesa tu información antes de asignar un reclutador."
    },
    validation: {
        label: "EN VALIDACIÓN",
        icon: Search,
        color: "#f59e0b",
        desc: "Un reclutador profesional ya está revisando tu expediente y documentos para validar tu perfil."
    },
    docs_validation: {
        label: "EN VALIDACIÓN",
        icon: Search,
        color: "#f59e0b",
        desc: "Un reclutador profesional ya está revisando tu expediente y documentos para validar tu perfil."
    },
    virtual_pending: {
        label: "REVISIÓN EJECUTIVA",
        icon: UserCheck,
        color: "#6366f1",
        desc: "Tu perfil ha superado los filtros iniciales y está en revisión para agendar entrevista."
    },
    interview_scheduled: {
        label: "ENTREVISTA PROGRAMADA",
        icon: Video,
        color: "#8b5cf6",
        desc: "¡Felicidades! Tienes una entrevista virtual agendada. Revisa los detalles de conexión en el correo que se ha enviado a tu correo electrónico."
    },
    virtual_scheduled: {
        label: "ENTREVISTA PROGRAMADA",
        icon: Video,
        color: "#8b5cf6",
        desc: "¡Felicidades! Tienes una entrevista virtual agendada. Revisa los detalles de conexión en el correo que se ha enviado a tu correo electrónico."
    },
    virtual_done: {
        label: "ENTREVISTA COMPLETADA",
        icon: Check,
        color: "#10b981",
        desc: "Has completado tu entrevista con éxito. Estamos evaluando los resultados finales."
    },
    final_docs: {
        label: "DOCUMENTACIÓN FINAL",
        icon: FileText,
        color: "#f59e0b",
        desc: "Estamos integrando tu expediente completo para las firmas finales de ingreso."
    },
    onboarding: {
        label: "INGRESO PROGRAMADO",
        icon: Zap,
        color: "#10b981",
        desc: "¡Bienvenido al equipo! Tu fecha de ingreso ha sido fijada. Prepara tu primer día."
    },
    onboarding_scheduled: {
        label: "INGRESO PROGRAMADO",
        icon: Zap,
        color: "#10b981",
        desc: "¡Bienvenido al equipo! Tu fecha de ingreso ha sido fijada. Prepara tu primer día."
    },
    hired: {
        label: "CONTRATADO",
        icon: Zap,
        color: "#1d4ed8",
        desc: "Proceso finalizado exitosamente. ¡Bienvenido oficialmente a la organización!"
    },
    rejected: {
        label: "PROCESO FINALIZADO",
        icon: XCircle,
        color: "#ef4444",
        desc: "Gracias por tu interés en nuestra organización. En esta ocasión no continuaremos con tu proceso."
    },
};

const STAGES = [
    { key: 'validation', label: 'Validación', codes: ['new', 'validation', 'docs_validation', 'virtual_pending'] },
    { key: 'interview', label: 'Entrevista', codes: ['interview_scheduled', 'virtual_scheduled', 'virtual_done'] },
    { key: 'onboarding', label: 'Ingreso', codes: ['onboarding', 'final_docs', 'onboarding_scheduled', 'hired'] }
];

export default function TrackApplication() {
    const [searchParams] = useSearchParams();
    const [appId, setAppId] = useState(searchParams.get("id") || "");
    const [loadId, setLoadId] = useState(searchParams.get("id") || "");
    const [application, setApplication] = useState<Application | null>(null);
    const [documents, setDocuments] = useState<DocumentInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState<string>("");

    const fetchApplication = async () => {
        if (!loadId) return;
        setLoading(true);
        setError(null);
        try {
            const { data: app, error: appError } = await supabase
                .from("recruit_applications")
                .select(`
                  id, 
                  status_key, 
                  meet_link,
                  profiles:assigned_to(full_name),
                  recruit_job_postings(title),
                  recruit_candidates(
                    recruit_persons(first_name, last_name)
                  )
                `)
                .eq("id", loadId)
                .single();

            if (appError || !app) {
                setError("No pudimos encontrar una postulación con ese ID.");
                setLoading(false);
                return;
            }

            setApplication(app as any);

            // Fetch required documents
            const { data: docs, error: docsError } = await supabase
                .from("recruit_document_types")
                .select(`
                    id, 
                    name, 
                    is_required, 
                    stage
                `)
                .order("name");

            if (docsError) throw docsError;

            // Fetch existing documents for this application
            const { data: existingDocs, error: existingError } = await supabase
                .from("recruit_application_documents")
                .select("id, document_type_id, validation_status, validation_notes, storage_path")
                .eq("application_id", loadId);

            if (existingError) throw existingError;

            const mergedDocs: DocumentInfo[] = docs.map(d => ({
                ...d,
                existing: existingDocs?.find(ed => ed.document_type_id === d.id) || null
            }));

            setDocuments(mergedDocs);

        } catch (err: any) {
            console.error("Error fetching app:", err);
            setError("Error al cargar la información. Intenta de nuevo más tarde.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (loadId) fetchApplication();
    }, [loadId]);

    const handleUpload = async (docTypeId: string, file: File) => {
        if (!application) return;
        setUploading(docTypeId);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${application.id}/${docTypeId}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `documents/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("candidates_docs")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Upsert document record
            const { error: dbError } = await supabase
                .from("recruit_application_documents")
                .upsert({
                    application_id: application.id,
                    document_type_id: docTypeId,
                    storage_path: filePath,
                    validation_status: 'under_review',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'application_id,document_type_id' });

            if (dbError) throw dbError;

            await fetchApplication();
        } catch (err: any) {
            console.error("Upload error:", err);
            alert("Error al subir archivo");
        } finally {
            setUploading(null);
        }
    };

    const handleDocumentPreview = async (path: string, name: string) => {
        try {
            const { data, error } = await supabase.storage
                .from("candidates_docs")
                .createSignedUrl(path, 3600);

            if (error) throw error;
            setPreviewName(name);
            setPreviewUrl(data.signedUrl);
        } catch (err) {
            console.error("Preview error:", err);
            alert("No se pudo generar el enlace de previsualización.");
        }
    };

    const getStageIndex = (status: string) => {
        if (status === 'rejected') return -1;
        return STAGES.findIndex(s => s.codes.includes(status));
    };

    if (!loadId) {
        return (
            <section className="container-full" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', paddingTop: '8rem' }}>
                <InteractiveStars />
                <div className="pro-card" style={{
                    maxWidth: '600px',
                    width: '100%',
                    textAlign: 'center',
                    padding: '4rem 3rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-dim)',
                    position: 'relative',
                    zIndex: 10,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.1)'
                }}>
                    <span className="mono mb-2 color-accent">// SEGUIMIENTO ELITE</span>
                    <h1 className="outfit-black mb-6" style={{ fontSize: '3rem', lineHeight: 1.1, color: 'var(--text-main)' }}>RASTREA TU PROGRESO.</h1>
                    <p className="mono color-dim mb-10" style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
                        INGRESA EL IDENTIFICADOR DE TU POSTULACIÓN QUE RECIBISTE POR CORREO ELECTRÓNICO.
                    </p>

                    <div className="flex flex-col" style={{ gap: '2.5rem' }}>
                        <input
                            className="glass-input compact"
                            placeholder="EJ: 22975822-A1A5..."
                            value={appId}
                            onChange={e => setAppId(e.target.value.toUpperCase())}
                            style={{ textAlign: 'center', fontSize: '1.4rem', borderBottom: '2px solid var(--accent)', marginBottom: '0.5rem', background: 'var(--bg-soft)', color: 'var(--text-main)' }}
                        />
                        <button className="btn-magnetic" style={{ width: '100%', padding: '1.2rem' }} onClick={() => setLoadId(appId.trim())}>
                            CONSULTAR EXPEDIENTE <ArrowRight size={16} className="ml-2" />
                        </button>
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                        <Link to="/" className="mono color-dim hover-accent transition-all" style={{ fontSize: '0.7rem' }}>
                            ← VOLVER A LA PÁGINA PRINCIPAL
                        </Link>
                    </div>
                </div>
            </section>
        );
    }

    if (error) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
            <InteractiveStars />
            <XCircle size={64} style={{ color: 'var(--accent)', marginBottom: '1.5rem', position: 'relative', zIndex: 10 }} />
            <h2 className="outfit-black" style={{ fontSize: '2rem', marginBottom: '1rem', position: 'relative', zIndex: 10, color: 'var(--text-main)' }}>ID NO ENCONTRADO</h2>
            <p className="mono color-dim" style={{ marginBottom: '2rem', position: 'relative', zIndex: 10 }}>{error}</p>
            <button className="btn-ghost" onClick={() => setLoadId("")} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', position: 'relative', zIndex: 10 }}>VOLVER A INTENTAR</button>
        </div>
    );

    const currentData = friendlyStatusMap[application?.status_key || 'new'] || friendlyStatusMap['new'];
    const StatusIcon = currentData.icon;
    const currentStepIndex = getStageIndex(application?.status_key || 'new');

    const firstName = (application?.recruit_candidates?.recruit_persons?.first_name || "Candidato").toUpperCase();
    const jobTitle = (application?.recruit_job_postings?.title || "Vacante").toUpperCase();
    const recruiterName = application?.profiles?.full_name;

    return (
        <section className="container-full" style={{ paddingTop: '80px', paddingBottom: '6rem', minHeight: '100vh', position: 'relative' }}>
            <InteractiveStars />

            {/* --- Document Preview Modal --- */}
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

            <div className="animate-in fade-in duration-1000" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', position: 'relative', zIndex: 10 }}>

                {/* --- HEADER --- */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
                    <div>
                        <span className="mono color-accent" style={{ fontSize: '0.6rem', display: 'block', marginBottom: '0.5rem' }}>// EXPEDIENTE DIGITAL</span>
                        <h1 className="outfit-black" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 0.9, color: 'var(--text-main)' }}>
                            HOLA, {firstName}.
                        </h1>
                        <div style={{ display: 'flex', gap: '2rem', marginTop: '1.2rem', alignItems: 'center' }}>
                            <p className="mono color-dim" style={{ fontSize: '0.7rem' }}>
                                VACANTE: <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>{jobTitle}</span>
                            </p>
                            {recruiterName && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(var(--accent-rgb), 0.1)', padding: '4px 12px', borderRadius: '8px', border: '1px solid var(--accent)' }}>
                                    <UserCheck size={12} className="color-accent" />
                                    <span className="mono color-accent" style={{ fontSize: '0.6rem', fontWeight: 700 }}>RECLUTADOR: {recruiterName.toUpperCase()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <button className="btn-ghost" onClick={() => setLoadId("")} style={{ fontSize: '0.6rem', padding: '0.6rem 1.2rem', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                        <Search size={14} style={{ marginRight: '0.5rem' }} /> CONSULTAR OTRO
                    </button>
                </div>

                {loading && (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <Clock className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
                    </div>
                )}

            </div>

            {/* --- STEPPER (HORIZONTAL) --- */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-dim)',
                borderRadius: '24px',
                marginBottom: '3rem',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}>
                {STAGES.map((s, idx) => {
                    const isActive = idx <= currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    const isPast = idx < currentStepIndex;

                    const StageIcons: any = { Validación: ShieldCheck, Entrevista: Video, Ingreso: Zap };
                    const Icon = StageIcons[s.label] || Check;

                    return (
                        <div key={s.key} style={{
                            flex: 1,
                            minWidth: '200px',
                            padding: '1.5rem 2rem',
                            borderRight: idx === STAGES.length - 1 ? 'none' : '1px solid var(--border-dim)',
                            borderBottom: '1px solid var(--border-dim)',
                            background: isCurrent ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            position: 'relative'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isCurrent ? 'var(--accent)' : (isActive ? 'var(--text-main)' : 'var(--bg-accent)'),
                                color: (isActive) ? 'var(--bg-pure)' : 'var(--text-dim)',
                                boxShadow: isCurrent ? '0 0 20px var(--accent-glow)' : 'none'
                            }}>
                                {isPast ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                            </div>
                            <div>
                                <span className="mono" style={{ fontSize: '0.5rem', display: 'block', opacity: 0.5 }}>0{idx + 1}</span>
                                <span className="outfit-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: isCurrent ? 'var(--accent)' : 'var(--text-main)' }}>{s.label}</span>
                            </div>
                            {isCurrent && <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '2px', background: 'var(--accent)' }}></div>}
                        </div>
                    );
                })}
            </div>

            {/* --- MAIN GRID 8:4 --- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2.5rem' }}>

                {/* STATUS CARD (8/12) */}
                <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: '32px',
                        padding: '4rem',
                        minHeight: '400px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                    }}>
                        {/* Background Icon Watermark */}
                        <StatusIcon size={240} style={{ position: 'absolute', right: '-40px', bottom: '-40px', opacity: 0.05 }} />

                        <div style={{ position: 'relative', zIndex: 10 }}>
                            <span className="mono color-dim" style={{ fontSize: '0.66rem', display: 'block', marginBottom: '1.5rem' }}>// STATUS_REPORT_LOCKED</span>
                            <h2 className="outfit-black" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', color: currentData.color, lineHeight: 1, marginBottom: '2rem' }}>
                                {currentData.label}
                            </h2>
                            <p className="color-dim" style={{ fontSize: '1.25rem', lineHeight: 1.6, maxWidth: '85%', color: 'var(--text-main)', opacity: 0.8 }}>
                                {currentData.desc}
                            </p>

                            {application?.status_key.includes('virtual') && application.meet_link && (
                                <div style={{
                                    marginTop: '3rem',
                                    padding: '2.5rem',
                                    borderRadius: '24px',
                                    background: 'rgba(var(--accent-rgb), 0.1)',
                                    border: '1px solid var(--accent)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '2rem',
                                    boxShadow: '0 4px 15px rgba(var(--accent-rgb), 0.15)'
                                }}>
                                    <div>
                                        <h3 className="outfit-bold" style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>ENTREVISTA EN CURSO / PROGRAMADA</h3>
                                        <p className="mono color-dim" style={{ fontSize: '0.65rem' }}>PUNTUALIDAD Y CONEXIÓN ESTABLE REQUERIDA.</p>
                                    </div>
                                    <a href={application.meet_link} target="_blank" rel="noreferrer" className="btn-magnetic" style={{ padding: '1.2rem 2.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Video size={18} /> UNIRSE AHORA <ExternalLink size={14} />
                                    </a>
                                </div>
                            )}

                            {application?.status_key === 'docs_validation' && (
                                <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '1.2rem', padding: '1.5rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                    <Clock size={24} style={{ color: '#f59e0b' }} />
                                    <p className="mono" style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                                        RESULTADO ESTIMADO EN <span style={{ textDecoration: 'underline' }}>24 A 48 HORAS</span> HÁBILES.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* DOCUMENTS SIDEBAR (4/12) */}
                <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
                        <span className="mono color-accent" style={{ fontSize: '0.65rem' }}>// DOCUMENTACIÓN</span>
                        <span className="mono color-dim" style={{ fontSize: '0.6rem', opacity: 0.5 }}>{documents.filter(d => !!d.existing).length} ARCHIVOS</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {documents.filter(d => !!d.existing).map(doc => {
                            const isUploaded = !!doc.existing;
                            const status = doc.existing?.validation_status;
                            const canEdit = status === 'pending' || status === 'rejected';

                            return (
                                <div key={doc.id} style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-dim)',
                                    borderRadius: '20px',
                                    padding: '1.5rem',
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div
                                            style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', cursor: isUploaded ? 'pointer' : 'default', flex: 1 }}
                                            onClick={() => isUploaded && handleDocumentPreview(doc.existing!.storage_path!, doc.name)}
                                            className="hover-accent"
                                        >
                                            <div style={{
                                                width: '44px',
                                                height: '44px',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: 'var(--bg-soft)',
                                                color: isUploaded ? 'var(--accent)' : 'var(--text-dim)',
                                                border: '1px solid var(--border-dim)'
                                            }}>
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <h4 className="outfit-bold" style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {doc.name}
                                                    {isUploaded && <ExternalLink size={10} style={{ opacity: 0.5 }} />}
                                                </h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    {status === 'validated' ? (
                                                        <span className="mono" style={{ fontSize: '0.55rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>✓ OK</span>
                                                    ) : status === 'rejected' ? (
                                                        <span className="mono" style={{ fontSize: '0.55rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>✗ RECHAZADO</span>
                                                    ) : status === 'under_review' ? (
                                                        <span className="mono" style={{ fontSize: '0.55rem', color: '#3d5afe', background: 'rgba(61, 90, 254, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid #3d5afe' }}>👁 EN REVISIÓN</span>
                                                    ) : isUploaded ? (
                                                        <span className="mono color-dim" style={{ fontSize: '0.55rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-dim)' }}>⏳ RECIBIDO</span>
                                                    ) : (
                                                        <span className="mono" style={{ fontSize: '0.55rem', opacity: 0.4, color: 'var(--text-dim)' }}>PENDIENTE</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {canEdit && (
                                            <label className="btn-ghost icon-only" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-soft)', border: '1px solid var(--border-dim)', cursor: 'pointer' }}>
                                                <input
                                                    type="file"
                                                    hidden
                                                    onChange={e => e.target.files?.[0] && handleUpload(doc.id, e.target.files[0])}
                                                    disabled={!!uploading}
                                                />
                                                {uploading === doc.id ? <Clock size={16} className="animate-spin" /> : <Pencil size={18} style={{ color: 'var(--text-main)' }} />}
                                            </label>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {documents.length === 0 && (
                            <div style={{ padding: '3rem', background: 'var(--bg-card)', border: '1px dashed var(--border-dim)', borderRadius: '24px', textAlign: 'center', opacity: 0.6 }}>
                                <Zap size={24} style={{ marginBottom: '1rem', color: 'var(--accent)' }} />
                                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>FASE SIN REQUISITOS ADICIONALES</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '5rem', textAlign: 'center', opacity: 0.3 }}>
                <p className="mono" style={{ fontSize: '0.6rem', letterSpacing: '0.4rem', color: 'var(--text-dim)' }}>
                    ELITE CORE v5.0 // SESSION_SECURE_{new Date().getFullYear()}
                </p>
            </div>
        </section >
    );
}
