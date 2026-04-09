import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { ApplyFormValues, JobPosting, JobProfile } from "../types";

const SectionTitle = ({ mono, title }: { mono: string, title: string }) => (
  <div className="section-title-wrapper mb-8">
    <span className="mono color-accent">// {mono}</span>
    <h2 className="outfit-bold">{title}</h2>
  </div>
);

interface Step02VacancyProps {
  register: UseFormRegister<ApplyFormValues>;
  setValue: UseFormSetValue<ApplyFormValues>;
  selectedJobId: string;
  jobPostings: JobPosting[];
  selectedJobProfile: JobProfile | null;
}

export default function Step02Vacancy({ register, setValue, selectedJobId, jobPostings, selectedJobProfile }: Step02VacancyProps) {
  return (
    <div className="vacancy-flow-wrapper step-enter">
      <SectionTitle mono="DISPONIBLES" title="SELECCIONA TU VACANTE" />

      {!selectedJobId ? (
        <div className="job-bento-grid">
          {jobPostings.map((job) => (
            <label key={job.id} className="job-card-item" data-selected={selectedJobId === job.id}>
              <input type="radio" value={job.id} {...register("job_posting_id", { required: true })} className="hidden" />
              <div className="job-card-header flex-between mb-4">
                <div className="job-tag mono">{job.employment_type || "FULL-TIME"}</div>
              </div>
              <h3 className="outfit-bold" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{job.title}</h3>
              <div className="job-card-meta mono">
                <div className="meta-row">
                  <span className="color-dim">ÁREA //</span> <span>{job.area}</span>
                </div>
                <div className="meta-row">
                  <span className="color-dim">SUCURSAL //</span> <span>{job.branch || "MATRIZ"}</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="selected-job-detail pro-card compact-card step-enter">
          <div className="detail-header flex-between mb-8">
            <div>
              <span className="mono color-accent" style={{ fontSize: '0.6rem' }}>VACANTE SELECCIONADA</span>
              <h3 className="outfit-bold" style={{ fontSize: '1.8rem' }}>{jobPostings.find(j => j.id === selectedJobId)?.title}</h3>
            </div>
            <button type="button" className="btn-ghost" onClick={() => setValue("job_posting_id", "")} style={{ padding: '0.5rem 1rem', fontSize: '0.7rem' }}>
              CAMBIAR SELECCIÓN
            </button>
          </div>

          {selectedJobProfile && (
            <div className="detail-grid">
              <div className="detail-main">
                {selectedJobProfile.role_summary && (
                  <div className="detail-section mb-6">
                    <h4 className="mono color-dim mb-2">// RESUMEN DEL ROL</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.role_summary}</p>
                  </div>
                )}
                {selectedJobProfile.requirements && (
                  <div className="detail-section mb-6">
                    <h4 className="mono color-dim mb-2">// REQUISITOS</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.requirements}</p>
                  </div>
                )}
                {selectedJobProfile.min_education && (
                  <div className="detail-section mb-6">
                    <h4 className="mono color-dim mb-2">// ESCOLARIDAD MÍNIMA</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.min_education}</p>
                  </div>
                )}
                {selectedJobProfile.responsibilities && (
                  <div className="detail-section mb-6">
                    <h4 className="mono color-dim mb-2">// RESPONSABILIDADES</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.responsibilities}</p>
                  </div>
                )}
                {selectedJobProfile.qualifications && (
                  <div className="detail-section mb-6">
                    <h4 className="mono color-dim mb-2">// COMPETENCIAS / CALIFICACIONES</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.qualifications}</p>
                  </div>
                )}
                {selectedJobProfile.benefits && (
                  <div className="detail-section mb-6">
                    <h4 className="mono color-dim mb-2">// BENEFICIOS</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.benefits}</p>
                  </div>
                )}
                {selectedJobProfile.growth_plan && (
                  <div className="detail-section mb-6">
                    <h4 className="mono color-dim mb-2">// PLAN DE CRECIMIENTO</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', opacity: 0.8 }}>{selectedJobProfile.growth_plan}</p>
                  </div>
                )}
              </div>
              <div className="detail-side">
                {selectedJobProfile.skills && (
                  <div className="detail-section mb-6">
                    <h4 className="mono color-dim mb-2">// HABILIDADES CLAVE</h4>
                    <p style={{ fontSize: '0.85rem', lineHeight: '1.5', opacity: 0.8 }}>{selectedJobProfile.skills}</p>
                  </div>
                )}
                {selectedJobProfile.experience && (
                  <div className="detail-section mb-6">
                    <h4 className="mono color-dim mb-2">// EXPERIENCIA DESEADA</h4>
                    <p style={{ fontSize: '0.85rem', lineHeight: '1.5', opacity: 0.8 }}>{selectedJobProfile.experience}</p>
                  </div>
                )}

                <div className="detail-section mb-6">
                  <h4 className="mono color-dim mb-4">// ESPECIFICACIONES CLAVE</h4>
                  {selectedJobProfile.salary_range && (
                    <div className="meta-info-card mb-4" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
                      <span className="mono color-dim block mb-1" style={{ fontSize: '0.55rem' }}>RANGO SALARIAL</span>
                      <span className="outfit-bold color-accent" style={{ fontSize: '1.3rem' }}>{selectedJobProfile.salary_range}</span>
                    </div>
                  )}
                  {selectedJobProfile.schedule && (
                    <div className="meta-info-card mb-4" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
                      <span className="mono color-dim block mb-1" style={{ fontSize: '0.55rem' }}>HORARIO</span>
                      <span className="outfit-bold" style={{ fontSize: '1.1rem' }}>{selectedJobProfile.schedule}</span>
                    </div>
                  )}
                  {selectedJobProfile.location_details && (
                    <div className="meta-info-card mb-4" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
                      <span className="mono color-dim block mb-1" style={{ fontSize: '0.55rem' }}>UBICACIÓN</span>
                      <span className="outfit-bold" style={{ fontSize: '1rem', opacity: 0.9 }}>{selectedJobProfile.location_details}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
