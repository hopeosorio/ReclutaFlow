import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabaseClient";
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
    ShieldCheck,
    Upload,
    AlertCircle,
    CheckCircle2
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
    label: string;
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
    virtual_scheduled: {
        label: "ENTREVISTA PROGRAMADA",
        icon: Video,
        color: "#8b5cf6",
        desc: "¡Felicidades! Tienes una entrevista virtual agendada. Revisa los detalles de conexión en el correo que se ha enviado a tu correo electrónico."
    },
    virtual_done: {
        label: "ENTREVISTA VIRTUAL LISTA",
        icon: Check,
        color: "#10b981",
        desc: "Has completado tu entrevista virtual con éxito. El equipo de RH revisará tu perfil para agendar una cita presencial."
    },
    in_person_scheduled: {
        label: "ENTREVISTA PRESENCIAL",
        icon: UserCheck,
        color: "#6366f1",
        desc: "¡Felicidades! Has sido seleccionado para una entrevista presencial en nuestras oficinas. Revisa los detalles de ubicación y horario a continuación."
    },
    in_person_done: {
        label: "ENTREVISTA COMPLETADA",
        icon: CheckCircle2,
        color: "#10b981",
        desc: "Has completado tu entrevista presencial. Estamos evaluando los resultados finales para proceder con tu documentación."
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
    documents_pending: {
        label: "DOCUMENTACIÓN PENDIENTE",
        icon: FileText,
        color: "#f59e0b",
        desc: "Necesitamos que cargues tus documentos oficiales (RFC, CURP, Acta, etc.) para formalizar tu expediente de ingreso en la sección lateral."
    },
    documents_complete: {
        label: "DOCUMENTACIÓN COMPLETA",
        icon: ShieldCheck,
        color: "#10b981",
        desc: "Tus documentos han sido recibidos y están siendo validados por el equipo de RH."
    },
    hired: {
        label: "CONTRATADO",
        icon: Zap,
        color: "#1d4ed8",
        desc: "¡Felicidades! Todo está listo. Bienvenido oficialmente al equipo."
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
    { key: 'interview', label: 'Entrevista', codes: ['virtual_scheduled', 'virtual_done', 'in_person_scheduled', 'in_person_done'] },
    { key: 'documentation', label: 'Documentación', codes: ['documents_pending', 'documents_complete', 'final_docs'] },
    { key: 'onboarding', label: 'Ingreso', codes: ['onboarding', 'onboarding_scheduled', 'hired'] }
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
    const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState<string>("");
    const [previewError, setPreviewError] = useState<string | null>(null);

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
                  ),
                  recruit_interviews(scheduled_at, location, notes, interview_type)
                `)
                .eq("id", loadId)
                .single();

            if (appError || !app) {
                setError("No pudimos encontrar una postulación con ese ID.");
                setLoading(false);
                return;
            }

            setApplication(app as any);

            // Fetch required documents (ONLY ACTIVE ONES)
            const { data: docs, error: docsError } = await supabase
                .from("recruit_document_types")
                .select(`
                    id,
                    name,
                    label,
                    is_required,
                    stage
                `)
                .eq("is_active", true)
                .order("name");

            if (docsError) throw docsError;

            const isAdvancedStage = ['documents_pending', 'documents_complete', 'final_docs', 'onboarding', 'hired'].includes(app.status_key);
            const visibleDocs = docs.filter(d =>
                d.name !== 'solicitud_empleo' && (
                    d.stage === 'application' || (isAdvancedStage && (d.stage === 'onboarding' || d.stage === 'post_interview'))
                )
            );

            // Fetch existing documents for this application
            const { data: existingDocs, error: existingError } = await supabase
                .from("recruit_application_documents")
                .select("id, document_type_id, validation_status, validation_notes, storage_path")
                .eq("application_id", loadId);

            if (existingError) throw existingError;

            const mergedDocs: DocumentInfo[] = visibleDocs.map(d => ({
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

    const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    const MAX_SIZE_MB = 10;

    const handleUpload = async (docTypeId: string, file: File) => {
        if (!application) return;

        // Validate type
        if (!ALLOWED_TYPES.includes(file.type)) {
            setUploadErrors(prev => ({ ...prev, [docTypeId]: "Formato no válido. Usa PDF, JPG o PNG." }));
            return;
        }
        // Validate size
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            setUploadErrors(prev => ({ ...prev, [docTypeId]: `El archivo supera el límite de ${MAX_SIZE_MB} MB.` }));
            return;
        }

        setUploadErrors(prev => { const n = { ...prev }; delete n[docTypeId]; return n; });
        setUploading(docTypeId);
        setUploadSuccess(null);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${docTypeId}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `applications/${application.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("recruit-docs")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Check if a record already exists for this doc type
            const { data: existing } = await supabase
                .from("recruit_application_documents")
                .select("id")
                .eq("application_id", application.id)
                .eq("document_type_id", docTypeId)
                .maybeSingle();

            let dbError;
            if (existing?.id) {
                ({ error: dbError } = await supabase
                    .from("recruit_application_documents")
                    .update({ storage_path: filePath, validation_status: 'under_review' })
                    .eq("id", existing.id));
            } else {
                ({ error: dbError } = await supabase
                    .from("recruit_application_documents")
                    .insert({
                        application_id: application.id,
                        document_type_id: docTypeId,
                        storage_path: filePath,
                        validation_status: 'under_review',
                    }));
            }

            if (dbError) throw dbError;

            setUploadSuccess(docTypeId);
            setTimeout(() => setUploadSuccess(null), 3000);

            // Check BEFORE fetchApplication whether this upload completes all required docs
            const requiredDocs = documents.filter(d => d.is_required);
            const wasComplete = requiredDocs.length > 0 && requiredDocs.every(d => !!d.existing);
            const isNowComplete = requiredDocs.length > 0 && requiredDocs.every(d =>
                d.id === docTypeId ? true : !!d.existing
            );

            await fetchApplication();

            // Notify the recruiter once — only when the last required doc is uploaded
            if (!wasComplete && isNowComplete) {
                try {
                    await fetch(`${supabaseUrl}/functions/v1/send_email`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "apikey": supabaseAnonKey!,
                        },
                        body: JSON.stringify({
                            application_id: application.id,
                            template_key: "all_docs_uploaded",
                            to_recruiter: true,
                            variables: {
                                crm_url: `${window.location.origin}/crm/applications/${application.id}`,
                            },
                        }),
                    });
                } catch (notifyErr) {
                    console.warn("No se pudo notificar al reclutador:", notifyErr);
                }
            }
        } catch (err: any) {
            console.error("Upload error:", err);
            setUploadErrors(prev => ({ ...prev, [docTypeId]: err?.message || "Error al subir el archivo. Intenta de nuevo." }));
        } finally {
            setUploading(null);
        }
    };

    const handleFileDrop = (docTypeId: string, e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(null);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(docTypeId, file);
    };

    const handleDocumentPreview = async (path: string, name: string) => {
        setPreviewError(null);
        try {
            const { data, error } = await supabase.storage
                .from("recruit-docs")
                .createSignedUrl(path, 3600);

            if (error) throw error;
            setPreviewName(name);
            setPreviewUrl(data.signedUrl);
        } catch (_err) {
            setPreviewError("No se pudo cargar la vista previa del documento. Intenta de nuevo.");
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
                <div className="pro-card track-search-card" style={{
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

                    <div className="flex flex-col" style={{ gap: '1.5rem' }}>
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

            {/* --- Document Preview Error Banner --- */}
            {previewError && (
                <div style={{ position: 'fixed', top: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, background: 'rgba(239,68,68,0.95)', color: '#fff', borderRadius: '12px', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxWidth: '90vw' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span className="mono" style={{ fontSize: '0.7rem' }}>{previewError}</span>
                    <button type="button" onClick={() => setPreviewError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 0.25rem', marginLeft: '0.25rem' }}><XCircle size={14} /></button>
                </div>
            )}

            {/* --- Document Preview Modal --- */}
            {previewUrl && (
                <div className="doc-preview-overlay" style={{ zIndex: 99999 }} onClick={() => setPreviewUrl(null)}>
                    <div className="doc-preview-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="doc-preview-header">
                            <strong>{previewName}</strong>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <a className="btn-ghost" href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><ExternalLink size={12} /> Abrir en nueva pestaña</a>
                                <button className="btn-ghost" type="button" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => setPreviewUrl(null)}><XCircle size={12} /> Cerrar</button>
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
                <div className="track-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
                    <div style={{ minWidth: 0 }}>
                        <span className="mono color-accent" style={{ fontSize: '0.6rem', display: 'block', marginBottom: '0.5rem' }}>// EXPEDIENTE DIGITAL</span>
                        <h1 className="outfit-black track-header-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 0.9, color: 'var(--text-main)' }}>
                            HOLA, {firstName}.
                        </h1>
                        <div className="track-header-meta" style={{ display: 'flex', gap: '2rem', marginTop: '1.2rem', alignItems: 'center' }}>
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
                    <button className="btn-ghost track-header-btn" onClick={() => setLoadId("")} style={{ fontSize: '0.6rem', padding: '0.6rem 1.2rem', background: 'var(--bg-card)', color: 'var(--text-main)', flexShrink: 0 }}>
                        <Search size={14} style={{ marginRight: '0.5rem' }} /> CONSULTAR OTRO
                    </button>
                </div>



            </div>

            {/* --- STEPPER (HORIZONTAL) --- */}
            <div className="track-stage-tabs" style={{
                display: 'flex',
                flexWrap: 'wrap',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-dim)',
                borderRadius: '24px',
                marginBottom: '3rem',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                position: 'relative',
                zIndex: 1
            }}>
                {STAGES.map((s, idx) => {
                    const isActive = idx <= currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    const isPast = idx < currentStepIndex;

                    const StageIcons: any = { Validación: ShieldCheck, Entrevista: Video, Documentación: FileText, Ingreso: Zap };
                    const Icon = StageIcons[s.label] || Check;

                    return (
                        <div key={s.key} className="track-stage-tab" style={{
                            flex: 1,
                            minWidth: '160px',
                            padding: '1.5rem 2rem',
                            borderRight: idx === STAGES.length - 1 ? 'none' : '1px solid var(--border-dim)',
                            borderBottom: '1px solid var(--border-dim)',
                            background: isCurrent ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            position: 'relative'
                        }}>
                            {/* Número como watermark de fondo */}
                            <span style={{
                                position: 'absolute',
                                bottom: '-0.15em',
                                right: '0.1em',
                                fontSize: '3.5rem',
                                fontWeight: 900,
                                fontFamily: 'var(--font-display)',
                                lineHeight: 1,
                                color: isCurrent ? 'var(--accent)' : 'var(--text-main)',
                                opacity: isCurrent ? 0.12 : 0.05,
                                pointerEvents: 'none',
                                userSelect: 'none',
                                letterSpacing: '-0.05em',
                            }}>0{idx + 1}</span>

                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isCurrent ? 'var(--accent)' : (isActive ? 'var(--text-main)' : 'var(--bg-accent)'),
                                color: (isActive) ? 'var(--bg-pure)' : 'var(--text-dim)',
                                boxShadow: isCurrent ? '0 0 20px var(--accent-glow)' : 'none',
                                position: 'relative',
                                zIndex: 1,
                            }}>
                                {isPast ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                            </div>
                            <div className="track-tab-label" style={{ position: 'relative', zIndex: 1 }}>
                                <span className="outfit-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: isCurrent ? 'var(--accent)' : 'var(--text-main)' }}>{s.label}</span>
                            </div>
                            {isCurrent && <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '2px', background: 'var(--accent)' }}></div>}
                        </div>
                    );
                })}
            </div>

            {/* --- MAIN GRID --- */}
            {/* When documents are the focus, flip to 5:7; otherwise 8:4 */}
            <div className="track-main-grid" style={{ display: 'grid', gridTemplateColumns: STAGES[currentStepIndex]?.key === 'documentation' ? '5fr 7fr' : '1fr', gap: '2.5rem' }}>

                {/* STATUS CARD */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="track-status-card" style={{
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
                                <div className="track-meet-card" style={{
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
                                        <h3 className="outfit-bold" style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>ENTREVISTA VIRTUAL PROGRAMADA</h3>
                                        <p className="mono color-dim" style={{ fontSize: '0.65rem' }}>PUNTUALIDAD Y CONEXIÓN ESTABLE REQUERIDA.</p>
                                    </div>
                                    <a href={application.meet_link} target="_blank" rel="noreferrer" className="btn-magnetic" style={{ padding: '1.2rem 2.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Video size={18} /> UNIRSE AHORA <ExternalLink size={14} />
                                    </a>
                                </div>
                            )}

                            {application?.status_key === 'in_person_scheduled' && (
                                <div className="track-meet-card" style={{
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
                                    <div style={{ flex: 1 }}>
                                        <h3 className="outfit-bold" style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>ENTREVISTA PRESENCIAL</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                            <div>
                                                <span className="mono color-dim" style={{ fontSize: '0.55rem', fontWeight: 800 }}>FECHA Y HORA</span>
                                                <p style={{ margin: 0, fontWeight: 700 }}>
                                                    {(application as any).recruit_interviews?.find((i: any) => i.interview_type === 'in_person')?.scheduled_at 
                                                        ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date((application as any).recruit_interviews.find((i: any) => i.interview_type === 'in_person').scheduled_at)) 
                                                        : 'POR CONFIRMAR'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="mono color-dim" style={{ fontSize: '0.55rem', fontWeight: 800 }}>UBICACIÓN</span>
                                                <p style={{ margin: 0, fontWeight: 700 }}>
                                                    {(application as any).recruit_interviews?.find((i: any) => i.interview_type === 'in_person')?.location || 'NUESTRAS OFICINAS'}
                                                </p>
                                            </div>
                                        </div>
                                        {(application as any).recruit_interviews?.find((i: any) => i.interview_type === 'in_person')?.notes && (
                                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
                                                <span className="mono color-dim" style={{ fontSize: '0.55rem', fontWeight: 800 }}>NOTAS</span>
                                                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>{(application as any).recruit_interviews.find((i: any) => i.interview_type === 'in_person').notes}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ background: 'var(--accent)', color: 'white', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                                            <UserCheck size={24} />
                                        </div>
                                    </div>
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

                            {application?.status_key === 'documents_pending' && (
                                <div style={{ marginTop: '2.5rem', padding: '2rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                        <Upload size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                        <h3 className="outfit-bold" style={{ fontSize: '1rem', color: '#f59e0b' }}>ACCIÓN REQUERIDA</h3>
                                    </div>
                                    <p className="mono color-dim" style={{ fontSize: '0.7rem', lineHeight: 1.6 }}>
                                        Sube tus documentos en la sección de la derecha.<br />
                                        Cada archivo debe estar en formato <strong>PDF, JPG o PNG</strong>.<br />
                                        Una vez validados por RH, recibirás confirmación por correo.
                                    </p>
                                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <span className="mono" style={{ fontSize: '0.55rem', background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.25)' }}>
                                            {documents.filter(d => d.existing?.validation_status === 'validated').length} validados
                                        </span>
                                        <span className="mono" style={{ fontSize: '0.55rem', background: 'rgba(61,90,254,0.1)', color: '#3d5afe', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(61,90,254,0.25)' }}>
                                            {documents.filter(d => d.existing?.validation_status === 'under_review' || d.existing?.validation_status === 'pending').length} en revisión
                                        </span>
                                        {documents.filter(d => d.existing?.validation_status === 'rejected').length > 0 && (
                                            <span className="mono" style={{ fontSize: '0.55rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.3)' }}>
                                                {documents.filter(d => d.existing?.validation_status === 'rejected').length} rechazados — sube de nuevo
                                            </span>
                                        )}
                                        <span className="mono" style={{ fontSize: '0.55rem', background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)', padding: '3px 10px', borderRadius: '20px', border: '1px solid var(--border-dim)' }}>
                                            {documents.filter(d => !d.existing).length} pendientes
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* DOCUMENTS PANEL — solo visible en etapa de documentación */}
                {STAGES[currentStepIndex]?.key === 'documentation' && <div className="track-docs-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
                        <div>
                            <span className="mono color-accent" style={{ fontSize: '0.65rem' }}>// DOCUMENTACIÓN</span>
                            {['documents_pending'].includes(application?.status_key || '') && (
                                <p className="mono color-dim" style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>
                                    Sube cada archivo en formato PDF, JPG o PNG · máx. 10 MB
                                </p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <span className="mono" style={{ fontSize: '0.6rem', color: '#10b981' }}>{documents.filter(d => d.existing?.validation_status === 'validated').length} validados</span>
                            <span className="mono color-dim" style={{ fontSize: '0.6rem', opacity: 0.5 }}>{documents.filter(d => !!d.existing).length}/{documents.length} subidos</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {documents
                            .filter(d => {
                                if (d.existing) return true;
                                const currentStage = STAGES[currentStepIndex]?.key;
                                if (d.stage === 'application' || d.stage === 'validation') return true;
                                if (d.stage === 'onboarding' && (currentStage === 'documentation' || currentStage === 'onboarding')) return true;
                                return false;
                            })
                            .map(doc => {
                                const isUploaded = !!doc.existing;
                                const status = doc.existing?.validation_status;
                                const canEdit = !isUploaded || status === 'pending' || status === 'rejected';
                                const isDocUploading = uploading === doc.id;
                                const isDragging = dragOver === doc.id;
                                const docError = uploadErrors[doc.id];
                                const docLabel = doc.label || doc.name;

                                // Border color based on status
                                const borderColor = status === 'validated' ? 'rgba(16,185,129,0.4)'
                                    : status === 'rejected' ? 'rgba(239,68,68,0.4)'
                                        : status === 'under_review' ? 'rgba(61,90,254,0.3)'
                                            : isUploaded ? 'var(--border-dim)'
                                                : 'var(--border-dim)';

                                return (
                                    <div key={doc.id} className="track-doc-card" style={{
                                        background: 'var(--bg-card)',
                                        border: `1px solid ${borderColor}`,
                                        borderRadius: '20px',
                                        padding: '1.5rem',
                                        transition: 'all 0.3s ease',
                                        boxShadow: status === 'validated' ? '0 0 0 1px rgba(16,185,129,0.15)' : '0 2px 10px rgba(0,0,0,0.1)',
                                        position: 'relative',
                                        zIndex: 1
                                    }}>
                                        {/* Header row: icon + name + status badge */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '44px',
                                                height: '44px',
                                                flexShrink: 0,
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: status === 'validated' ? 'rgba(16,185,129,0.15)' : status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'var(--bg-soft)',
                                                color: status === 'validated' ? '#10b981' : status === 'rejected' ? '#ef4444' : isUploaded ? 'var(--accent)' : 'var(--text-dim)',
                                                border: '1px solid var(--border-dim)',
                                                cursor: isUploaded ? 'pointer' : 'default'
                                            }}
                                                className="preview-trigger"
                                                onClick={() => isUploaded && doc.existing?.storage_path && handleDocumentPreview(doc.existing.storage_path, docLabel)}
                                            >
                                                <FileText size={20} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 className="outfit-bold" style={{
                                                    fontSize: '0.82rem',
                                                    textTransform: 'uppercase',
                                                    color: 'var(--text-main)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {docLabel}
                                                    {doc.is_required && <span className="mono" style={{ fontSize: '0.5rem', color: '#ef4444', opacity: 0.7 }}>*</span>}
                                                    {isUploaded && <ExternalLink size={10} className="preview-trigger" style={{ opacity: 0.4, flexShrink: 0, cursor: 'pointer' }} onClick={() => doc.existing?.storage_path && handleDocumentPreview(doc.existing.storage_path, docLabel)} />}
                                                </h4>
                                                <div style={{ marginTop: '0.3rem' }}>
                                                    {status === 'validated' ? (
                                                        <span className="mono" style={{ fontSize: '0.55rem', color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <Check size={10} strokeWidth={3} /> VALIDADO
                                                        </span>
                                                    ) : status === 'rejected' ? (
                                                        <span className="mono" style={{ fontSize: '0.55rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <XCircle size={10} /> RECHAZADO — sube de nuevo
                                                        </span>
                                                    ) : status === 'under_review' ? (
                                                        <span className="mono" style={{ fontSize: '0.55rem', color: '#3d5afe', background: 'rgba(61,90,254,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(61,90,254,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <Clock size={10} /> EN REVISIÓN
                                                        </span>
                                                    ) : isUploaded ? (
                                                        <span className="mono color-dim" style={{ fontSize: '0.55rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <Clock size={9} /> RECIBIDO
                                                        </span>
                                                    ) : (
                                                        <span className="mono" style={{ fontSize: '0.55rem', color: '#f59e0b', opacity: 0.8 }}>
                                                            PENDIENTE DE SUBIR
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Quick replace button for already-uploaded docs (not in pending mode) */}
                                            {canEdit && isUploaded && (
                                                <label style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-soft)', border: '1px solid var(--border-dim)', cursor: 'pointer', opacity: 0.7 }}>
                                                    <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" onChange={e => e.target.files?.[0] && handleUpload(doc.id, e.target.files[0])} disabled={!!uploading} />
                                                    <Pencil size={13} style={{ color: 'var(--text-dim)' }} />
                                                </label>
                                            )}
                                        </div>

                                        {/* Validation notes (if rejected) */}
                                        {status === 'rejected' && doc.existing?.validation_notes && (
                                            <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(239,68,68,0.07)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                <p className="mono" style={{ fontSize: '0.6rem', color: '#ef4444' }}>
                                                    MOTIVO: {doc.existing.validation_notes}
                                                </p>
                                            </div>
                                        )}

                                        {/* Upload drop zone — shown when doc is not yet uploaded (or rejected) */}
                                        {canEdit && !isUploaded && (
                                            <div
                                                onDragEnter={e => { e.preventDefault(); setDragOver(doc.id); }}
                                                onDragOver={e => { e.preventDefault(); setDragOver(doc.id); }}
                                                onDragLeave={() => setDragOver(null)}
                                                onDrop={e => handleFileDrop(doc.id, e)}
                                                style={{
                                                    marginTop: '1rem',
                                                    border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-dim)'}`,
                                                    borderRadius: '14px',
                                                    padding: '1.25rem',
                                                    textAlign: 'center',
                                                    background: isDragging ? 'rgba(var(--accent-rgb), 0.06)' : 'var(--bg-soft)',
                                                    transition: 'all 0.2s ease',
                                                    cursor: isDocUploading ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                <label style={{ cursor: isDocUploading ? 'not-allowed' : 'pointer', display: 'block' }}>
                                                    <input
                                                        type="file"
                                                        hidden
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        onChange={e => e.target.files?.[0] && handleUpload(doc.id, e.target.files[0])}
                                                        disabled={!!uploading}
                                                    />
                                                    {isDocUploading ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                                                            <Clock size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                                                            <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>SUBIENDO...</span>
                                                        </div>
                                                    ) : uploadSuccess === doc.id ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                                                            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                                                            <span className="mono" style={{ fontSize: '0.65rem', color: '#10b981' }}>¡ARCHIVO RECIBIDO!</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Upload size={22} style={{ color: isDragging ? 'var(--accent)' : 'var(--text-dim)', marginBottom: '0.5rem' }} />
                                                            <p className="outfit-bold" style={{ fontSize: '0.75rem', color: isDragging ? 'var(--accent)' : 'var(--text-main)', marginBottom: '0.2rem' }}>
                                                                {isDragging ? 'Suelta el archivo aquí' : 'Haz clic o arrastra el archivo aquí'}
                                                            </p>
                                                            <p className="mono color-dim" style={{ fontSize: '0.55rem' }}>PDF · JPG · PNG — máx. 10 MB</p>
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                        )}

                                        {/* Error message */}
                                        {docError && (
                                            <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)' }}>
                                                <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                                                <p className="mono" style={{ fontSize: '0.6rem', color: '#ef4444' }}>{docError}</p>
                                            </div>
                                        )}
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
                </div>}
            </div>

            <div style={{ marginTop: '5rem', textAlign: 'center', opacity: 0.3 }}>
                <p className="mono" style={{ fontSize: '0.6rem', letterSpacing: '0.4rem', color: 'var(--text-dim)' }}>
                    RECLUTAFLOW
                </p>
            </div>

            {loading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483647, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
                    <Clock className="animate-spin" size={36} style={{ color: 'var(--accent)' }} />
                </div>
            )}
        </section>

    );
}
