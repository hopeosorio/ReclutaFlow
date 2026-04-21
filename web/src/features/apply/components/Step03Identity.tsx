import { useEffect } from "react";
import type { UseFormRegister, FieldErrors, UseFormSetValue } from "react-hook-form";
import type { ApplyFormValues, ScreeningQuestion } from "../types";

const SectionTitle = ({ mono, title, num }: { mono: string, title: string, num?: string }) => (
  <div className="section-header mb-6 mt-8 flex align-end justify-between border-b border-dim pb-2">
    <div className="flex flex-col">
      <span className="mono color-dim" style={{ fontSize: '0.6rem' }}>// {mono}</span>
      <h2 className="outfit-bold" style={{ fontSize: '1.4rem' }}>{num ? `${num}. ` : ""}{title}</h2>
    </div>
  </div>
);

interface Step03IdentityProps {
  register: UseFormRegister<ApplyFormValues>;
  watch: any;
  setValue: UseFormSetValue<ApplyFormValues>;
  errors: FieldErrors<ApplyFormValues>;
  questions: ScreeningQuestion[];
}

export default function Step03Identity({ register, watch, setValue, errors, questions }: Step03IdentityProps) {

  // Observadores para visibilidad condicional y limpieza
  const appWatch = watch("application_details");
  const skillsWatch = watch("skills");

  const fixedCommitment = appWatch.fixed_commitment_bool;
  const previousEmployee = appWatch.previous_employee;
  const adjustmentsRequired = appWatch.adjustments_required;
  const hasExperience = appWatch.has_experience;
  
  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-foco cuando se activa un campo condicional
  useEffect(() => {
    if (hasExperience === "true") document.getElementById("years_exp_input")?.focus();
  }, [hasExperience]);

  useEffect(() => {
    if (fixedCommitment === "true") document.getElementById("fixed_comm_input")?.focus();
  }, [fixedCommitment]);

  useEffect(() => {
    if (previousEmployee === "true") document.getElementById("prev_reason_input")?.focus();
  }, [previousEmployee]);

  useEffect(() => {
    if (adjustmentsRequired === "true") document.getElementById("health_adj_input")?.focus();
  }, [adjustmentsRequired]);

  // Auto-limpieza de campos condicionales
  useEffect(() => {
    if (hasExperience === "false") setValue("application_details.years_experience", 0);
  }, [hasExperience, setValue]);

  useEffect(() => {
    if (fixedCommitment === "false") setValue("application_details.fixed_commitment", "");
  }, [fixedCommitment, setValue]);

  useEffect(() => {
    if (previousEmployee === "false") setValue("application_details.previous_employee_reason", "");
  }, [previousEmployee, setValue]);

  useEffect(() => {
    if (adjustmentsRequired === "false") setValue("application_details.health_adjustments", "");
  }, [adjustmentsRequired, setValue]);

  return (
    <div className="pro-card compact-card" style={{ maxWidth: '1250px', margin: '0 auto' }}>

      {/* 1. DATOS PERSONALES */}
      <SectionTitle mono="CIUDADANO" title="DATOS PERSONALES" />

      <div className="form-grid-3 mb-6">
        <div className="input-group">
          <label className="mono">NOMBRE DEL CANDIDATO:</label>
          <input className="glass-input compact" placeholder="AUTORRELLENADO" {...register("signer_name")} readOnly />
        </div>
        <div className="input-group">
          <label className="mono">CORREO ELECTRÓNICO: <span className="color-accent">*</span></label>
          <input
            type="email"
            className="glass-input compact"
            placeholder="ejemplo@correo.com"
            onInput={(e: any) => e.target.value = e.target.value.toUpperCase()}
            {...register("person.email", {
              required: true,
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Email inválido"
              }
            })}
          />
          {errors.person?.email && <span className="field-err">{errors.person.email.message || "REQUERIDO"}</span>}
        </div>
        <div className="input-group">
          <label className="mono">FECHA DE NACIMIENTO: (DD/MM/AA) <span className="color-accent">*</span></label>
          <input className="glass-input compact" type="date" max={todayStr} {...register("person.birth_date", { required: "REQUERIDO", max: { value: todayStr, message: "NO PUEDE SER FUTURA" } })} />
          {errors.person?.birth_date && <span className="field-err">{(errors.person.birth_date.message as string) || "REQUERIDO"}</span>}
        </div>
      </div>

      <div className="form-grid-3 mb-6">
        <div className="input-group span-2">
          <label className="mono">CALLE / NÚMERO: <span className="color-accent">*</span></label>
          <input
            className="glass-input compact"
            onInput={(e: any) => e.target.value = e.target.value.toUpperCase()}
            {...register("person.address_line1", { required: true })}
          />
          {errors.person?.address_line1 && <span className="field-err">REQUERIDO</span>}
        </div>
        <div className="input-group">
          <label className="mono">C.P. (5 DÍGITOS): <span className="color-accent">*</span></label>
          <input
            type="number"
            className="glass-input compact"
            maxLength={5}
            {...register("person.postal_code", { required: true, pattern: /^[0-9]{5}$/ })}
            onInput={(e: any) => e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 5)}
          />
          {errors.person?.postal_code && <span className="field-err">C.P. INVÁLIDO</span>}
        </div>
      </div>

      <div className="form-grid-3 mb-6">
        <div className="input-group">
          <label className="mono">COLONIA / MUNICIPIO: <span className="color-accent">*</span></label>
          <input
            className="glass-input compact"
            onInput={(e: any) => e.target.value = e.target.value.toUpperCase()}
            {...register("person.colonia", { required: true })}
          />
          {errors.person?.colonia && <span className="field-err">REQUERIDO</span>}
        </div>
        <div className="input-group">
          <label className="mono">ESTADO: <span className="color-accent">*</span></label>
          <input
            className="glass-input compact"
            onInput={(e: any) => e.target.value = e.target.value.toUpperCase()}
            {...register("person.state", { required: true })}
          />
          {errors.person?.state && <span className="field-err">REQUERIDO</span>}
        </div>
        <div className="input-group">
          <label className="mono">TELÉFONO (10 DÍGITOS): <span className="color-accent">*</span></label>
          <input
            type="tel"
            className="glass-input compact"
            maxLength={10}
            onInput={(e: any) => e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)}
            {...register("person.phone", { required: true, pattern: /^[0-9]{10}$/ })}
          />
          {errors.person?.phone && <span className="field-err">REQUERIDO</span>}
        </div>
      </div>

      <div className="form-grid-3 mb-10">
        <div className="input-group">
          <label className="mono">TEL. OPCIONAL:</label>
          <input
            type="tel"
            className="glass-input compact"
            onInput={(e: any) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
            {...register("person.phone_optional")}
          />
        </div>
        <div className="input-group">
          <label className="mono">NIVEL MÁXIMO DE ESTUDIOS: <span className="color-accent">*</span></label>
          <select className="glass-input compact" {...register("candidate.education_level", { required: true })} style={{ background: 'transparent' }}>
            <option value="" disabled>SELECCIONA...</option>
            <option value="secundaria">SECUNDARIA</option>
            <option value="preparatoria">PREPARATORIA</option>
            <option value="licenciatura">LICENCIATURA</option>
            <option value="maestria">MAESTRÍA</option>
          </select>
          {errors.candidate?.education_level && <span className="field-err">REQUERIDO</span>}
        </div>
        <div className="input-group">
          <label className="mono">ESTADO CIVIL: <span className="color-accent">*</span></label>
          <select className="glass-input compact" {...register("person.marital_status", { required: true })} style={{ background: 'transparent' }}>
            <option value="" disabled>SELECCIONA...</option>
            <option value="soltero">SOLTERO/A</option>
            <option value="casado">CASADO/A</option>
            <option value="union_libre">UNIÓN LIBRE</option>
            <option value="divorciado">DIVORCIADO/A</option>
            <option value="viudo">VIUDO/A</option>
            <option value="prefiero_no_decir">PREFIERO NO DECIR</option>
          </select>
          {errors.person?.marital_status && <span className="field-err">REQUERIDO</span>}
          <p className="mono color-dim mt-1" style={{ fontSize: '0.5rem', lineHeight: '1.2' }}>
            ESTA INFORMACIÓN NO SE USA PARA DECIDIR LA CONTRATACIÓN; ES SOLO ADMINISTRATIVA Y, EN SU CASO, PARA EXPEDIENTE.
          </p>
        </div>
      </div>

      {/* 2. DATOS DEL EMPLEO & DISPONIBILIDAD */}
      <SectionTitle mono="ASPIRACIÓN" title="DATOS DEL EMPLEO" />
      <div className="form-grid-3 mb-10">
        <div className="input-group">
          <label className="mono">¿CUENTA CON EXPERIENCIA PARA LA VACANTE? <span className="color-accent">*</span></label>
          <div className="radio-group-row">
            <label className="radio-btn compact"><input type="radio" value="true" {...register("application_details.has_experience" as any, { required: true })} /> <span>SÍ</span></label>
            <label className="radio-btn compact"><input type="radio" value="false" {...register("application_details.has_experience" as any, { required: true })} /> <span>NO</span></label>
          </div>
          {errors.application_details?.has_experience && <span className="field-err">SELECCIÓN OBLIGATORIA</span>}
        </div>
        <div className="input-group">
          <label className="mono">AÑOS DE EXPERIENCIA: {hasExperience === "true" && <span className="color-accent">*</span>}</label>
          <input
            id="years_exp_input"
            className="glass-input compact"
            type="number"
            placeholder={hasExperience === "true" ? "0" : ""}
            onInput={(e: any) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}
            disabled={hasExperience !== "true"}
            style={{ opacity: hasExperience === "true" ? 1 : 0.3 }}
            {...register("application_details.years_experience", {
              valueAsNumber: true,
              required: hasExperience === "true"
            })}
          />
          {errors.application_details?.years_experience && <span className="field-err">REQUERIDO</span>}
        </div>
      </div>

      <SectionTitle mono="LOGÍSTICA" title="DISPONIBILIDAD DE HORARIO" />
      <div className="input-group mb-8">
        <label className="mono">PREFERENCIA DE TURNO: <span className="color-accent">*</span></label>
        <select className="glass-input compact" {...register("application_details.schedule_preference", { required: true })} style={{ background: 'transparent' }}>
          <option value="" disabled>SELECCIONA UNA OPCIÓN...</option>
          <option value="morning">MATUTINO (AM)</option>
          <option value="afternoon">VESPERTINO (PM)</option>
          <option value="both">AMBOS (SIN PREFERENCIA)</option>
          <option value="rotative">PUEDO ROLAR TURNOS</option>
        </select>
        {errors.application_details?.schedule_preference && <span className="field-err">SELECCIÓN REQUERIDA</span>}
      </div>

      <div className="form-grid-2 mb-8">
        <div className="input-group">
          <label className="mono">¿COMPROMISO FIJO DE HORARIO (ESCUELA/OTRO EMPLEO)? <span className="color-accent">*</span></label>
          <div className="radio-group-row">
            <label className="radio-btn compact"><input type="radio" value="true" {...register("application_details.fixed_commitment_bool" as any, { required: true })} /> <span>SÍ</span></label>
            <label className="radio-btn compact"><input type="radio" value="false" {...register("application_details.fixed_commitment_bool" as any, { required: true })} /> <span>NO</span></label>
          </div>
          {errors.application_details?.fixed_commitment_bool && <span className="field-err">SELECCIÓN REQUERIDA</span>}
          <input
            id="fixed_comm_input"
            className="glass-input compact"
            placeholder={fixedCommitment === "true" ? "¿CUÁL?" : ""}
            disabled={fixedCommitment !== "true"}
            style={{ opacity: fixedCommitment === "true" ? 1 : 0.3 }}
            {...register("application_details.fixed_commitment", { required: fixedCommitment === "true" })}
          />
          {errors.application_details?.fixed_commitment && <span className="field-err">REQUERIDO</span>}
        </div>
        <div className="input-group">
          <label className="mono">¿DISPONIBILIDAD DE TRABAJAR FINES DE SEMANA? <span className="color-accent">*</span></label>
          <div className="radio-group-row">
            <label className="radio-btn compact"><input type="radio" value="true" {...register("application_details.weekend_availability" as any, { required: true })} /> <span>SÍ</span></label>
            <label className="radio-btn compact"><input type="radio" value="false" {...register("application_details.weekend_availability" as any, { required: true })} /> <span>NO</span></label>
          </div>
          {errors.application_details?.weekend_availability && <span className="field-err">SELECCIÓN REQUERIDA</span>}
        </div>
      </div>


      {/* 3. HISTORIAL LABORAL */}
      <SectionTitle mono="TRAYECTORIA" title="REFERENCIA LABORAL (OPCIONAL, PERO RECOMENDADO)" />
      <p className="mono color-dim mb-6" style={{ fontSize: '0.6rem', lineHeight: '1.4', maxWidth: '800px' }}>
        AUTORIZO A MEWI A VERIFICAR REFERENCIAS LABORALES Y PERSONALES RELACIONADAS CON ESTE PROCESO DE RECLUTAMIENTO Y SELECCIÓN.
        ENTIENDO QUE DICHA VERIFICACIÓN SE REALIZARÁ ÚNICAMENTE CON FINES DE EVALUACIÓN DE CANDIDATURA.
      </p>

      {[0, 1].map((idx) => (
        <div key={idx} className="work-entry mb-10" style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-dim)' }}>
          <h4 className="mono color-accent mb-6" style={{ fontSize: '0.7rem' }}>// {idx === 0 ? "ÚLTIMO EMPLEO" : "PENÚLTIMO EMPLEO"}</h4>

          <div className="form-grid-3 mb-6">
            <div className="input-group span-2">
              <label className="mono">EMPRESA:</label>
              <input className="glass-input compact" {...register(`work_history.${idx}.company` as any)} />
            </div>
            <div className="input-group">
              <label className="mono">PUESTO:</label>
              <input className="glass-input compact" {...register(`work_history.${idx}.position` as any)} />
            </div>
          </div>

          <div className="form-grid-3 mb-6" style={{ alignItems: 'end' }}>
            <div className="input-group">
              <label className="mono">PERIODO LABORADO (DEL):</label>
              <input className="glass-input compact" type="date" {...register(`work_history.${idx}.period_from` as any)} />
            </div>
            <div className="input-group">
              <label className="mono">PERIODO LABORADO (AL):</label>
              <input className="glass-input compact" type="date" {...register(`work_history.${idx}.period_to` as any)} />
            </div>
            <div className="input-group">
              <label className="mono">MOTIVO DE SEPARACIÓN:</label>
              <input className="glass-input compact" {...register(`work_history.${idx}.reason_for_leaving` as any)} />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="input-group">
              <label className="mono">JEFE INMEDIATO:</label>
              <input className="glass-input compact" {...register(`work_history.${idx}.manager` as any)} />
            </div>
            <div className="input-group">
              <label className="mono">PUESTO DEL JEFE:</label>
              <input className="glass-input compact" {...register(`work_history.${idx}.manager_position` as any)} />
            </div>
            <div className="input-group">
              <label className="mono">TELÉFONO:</label>
              <input
                type="tel"
                className="glass-input compact"
                maxLength={10}
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                {...register(`work_history.${idx}.phone` as any, { pattern: /^[0-9]+$/ })}
              />
              {(errors.work_history as any)?.[idx]?.phone && <span className="field-err">SÓLO NÚMEROS</span>}
            </div>
          </div>
        </div>
      ))}

      {/* 4. REFERENCIAS PERSONALES */}
      <SectionTitle mono="VÍNCULOS" title="REFERENCIAS PERSONALES (OPCIONAL)" />
      <div className="mb-10">
        {[0, 1].map((idx) => (
          <div key={idx} className="form-grid-3 mb-4" style={{ background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
            <div className="input-group">
              <label className="mono" style={{ fontSize: '0.6rem' }}>{idx + 1}.- NOMBRE:</label>
              <input className="glass-input compact" {...register(`personal_references.${idx}.name` as any)} />
            </div>
            <div className="input-group">
              <label className="mono" style={{ fontSize: '0.6rem' }}>OCUPACIÓN:</label>
              <input className="glass-input compact" {...register(`personal_references.${idx}.occupation` as any)} />
            </div>
            <div className="input-group">
              <label className="mono" style={{ fontSize: '0.6rem' }}>TELÉFONO:</label>
              <input
                type="tel"
                className="glass-input compact"
                maxLength={10}
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, ''); }}
                {...register(`personal_references.${idx}.phone` as any, { pattern: /^[0-9]+$/ })}
              />
              {(errors.personal_references as any)?.[idx]?.phone && <span className="field-err">SÓLO NÚMEROS</span>}
            </div>
          </div>
        ))}
      </div>


      {/* 5. DATOS GENERALES */}
      <SectionTitle mono="ESTATUS" title="DATOS GENERALES" />
      <div className="form-grid-2 mb-6">
        <div className="input-group">
          <label className="mono">1.- ¿ESTÁ DE ACUERDO CON EL SUELDO OFRECIDO? <span className="color-accent">*</span></label>
          <select className="glass-input compact" {...register("application_details.agrees_with_salary", { required: true })}>
            <option value="" disabled>SELECCIONA...</option>
            <option value="yes">SÍ</option>
            <option value="no">NO</option>
            <option value="negotiable">NEGOCIABLE</option>
          </select>
          {errors.application_details?.agrees_with_salary && <span className="field-err">SELECCIÓN REQUERIDA</span>}
        </div>
        <div className="input-group">
          <label className="mono">3.- ¿CUENTA CON CRÉDITO INFONAVIT? <span className="color-accent">*</span></label>
          <div className="radio-group-row">
            <label className="radio-btn compact"><input type="radio" value="true" {...register("application_details.has_infonavit" as any, { required: true })} /> <span>SÍ</span></label>
            <label className="radio-btn compact"><input type="radio" value="false" {...register("application_details.has_infonavit" as any, { required: true })} /> <span>NO</span></label>
          </div>
          {errors.application_details?.has_infonavit && <span className="field-err">SELECCIÓN REQUERIDA</span>}
        </div>
      </div>

      <div className="input-group mb-10">
        <label className="mono">2.- ¿HA TRABAJADO ANTERIORMENTE CON NOSOTROS? <span className="color-accent">*</span></label>
        <div className="radio-group-row">
          <label className="radio-btn compact"><input type="radio" value="true" {...register("application_details.previous_employee" as any, { required: true })} /> <span>SÍ</span></label>
          <label className="radio-btn compact"><input type="radio" value="false" {...register("application_details.previous_employee" as any, { required: true })} /> <span>NO</span></label>
        </div>
        {errors.application_details?.previous_employee && <span className="field-err">SELECCIÓN REQUERIDA</span>}
        <input
          id="prev_reason_input"
          className="glass-input compact"
          placeholder={previousEmployee === "true" ? "MOTIVO DE RETIRO" : ""}
          disabled={previousEmployee !== "true"}
          style={{ opacity: previousEmployee === "true" ? 1 : 0.3 }}
          {...register("application_details.previous_employee_reason", { required: previousEmployee === "true" })}
        />
        {errors.application_details?.previous_employee_reason && <span className="field-err">REQUERIDO</span>}
      </div>

      {/* 6. CONOCIMIENTOS GENERALES */}
      <SectionTitle mono="TALENTO" title="CONOCIMIENTOS GENERALES" />
      {(() => {
        const hasCheckbox = !!(skillsWatch?.cashier || skillsWatch?.drinks || skillsWatch?.inventory || skillsWatch?.cleaning);
        const hasOthers = !!(skillsWatch?.others?.trim());
        const isSkillsValid = hasCheckbox || hasOthers;
        const skillsError = !!(errors.skills as any);
        return (
          <>
            <div className="choice-grid mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <label className="choice-item compact-choice">
                <input type="checkbox" {...register("skills.cashier")} /> <span>MANEJO DE CAJA / PDV</span>
              </label>
              <label className="choice-item compact-choice">
                <input type="checkbox" {...register("skills.drinks")} /> <span>PREPARACIÓN DE BEBIDAS</span>
              </label>
              <label className="choice-item compact-choice">
                <input type="checkbox" {...register("skills.inventory")} /> <span>INVENTARIOS / RECEPCIÓN</span>
              </label>
              <label className="choice-item compact-choice">
                <input type="checkbox" {...register("skills.cleaning")} /> <span>LIMPIEZA / SANITIZACIÓN</span>
              </label>
            </div>
            <div className="input-group mb-2">
              <label className="mono">
                OTRAS HABILIDADES:{!hasCheckbox && <span className="color-accent"> *</span>}
              </label>
              <input
                className="glass-input compact"
                placeholder={!hasCheckbox ? "Requerido si no seleccionas ninguna opción arriba" : ""}
                {...register("skills.others")}
              />
            </div>
            {skillsError && !isSkillsValid ? (
              <p className="field-err mb-8" style={{ marginTop: '4px' }}>
                Selecciona al menos una habilidad o describe tus otras habilidades.
              </p>
            ) : (
              <div className="mb-8" />
            )}
          </>
        );
      })()}

      {/* 7. SALUD Y SEGURIDAD */}
      <SectionTitle mono="SALUD" title="SALUD Y SEGURIDAD (OPCIONAL)" />
      <div className="input-group mb-10">
        <label className="mono">4.- ¿REQUIERES ALGÚN AJUSTE RAZONABLE O CONDICIÓN ESPECIAL PARA DESEMPEÑAR EL PUESTO DE FORMA SEGURA? <span className="color-accent">*</span></label>
        <p className="mono color-dim mb-4" style={{ fontSize: '0.5rem', lineHeight: '1.2' }}>// (EJEM: EMBARAZO, DISCAPACIDAD, LESIÓN, ETC.)</p>
        <div className="radio-group-row">
          <label className="radio-btn compact"><input type="radio" value="true" {...register("application_details.adjustments_required" as any, { required: true })} /> <span>SÍ</span></label>
          <label className="radio-btn compact"><input type="radio" value="false" {...register("application_details.adjustments_required" as any, { required: true })} /> <span>NO</span></label>
        </div>
        {errors.application_details?.adjustments_required && <span className="field-err">SELECCIÓN REQUERIDA</span>}
        <input
          id="health_adj_input"
          className="glass-input compact"
          placeholder={adjustmentsRequired === "true" ? "DESCRIBA EL AJUSTE SUGERIDO" : ""}
          disabled={adjustmentsRequired !== "true"}
          style={{ opacity: adjustmentsRequired === "true" ? 1 : 0.3 }}
          {...register("application_details.health_adjustments", { required: adjustmentsRequired === "true" })}
        />
        {errors.application_details?.health_adjustments && <span className="field-err">REQUERIDO</span>}
      </div>

      <div className="input-group mb-10">
        <label className="mono">FECHA EN QUE SE PUEDE PRESENTAR A TRABAJAR: <span className="color-accent">*</span></label>
        <input className="glass-input compact" type="date" min={todayStr} {...register("application_details.start_date", { required: "FECHA REQUERIDA", min: { value: todayStr, message: "DEBE SER HOY O POSTERIOR" } })} />
        {errors.application_details?.start_date && <span className="field-err">{(errors.application_details.start_date.message as string) || "FECHA REQUERIDA"}</span>}
      </div>

      <div className="input-group mb-12">
        <label className="mono">COMENTARIOS:</label>
        <textarea className="glass-input compact" style={{ height: '80px', resize: 'none' }} {...register("application_details.comments")} />
      </div>


      {/* 5. CUESTIONARIO DINÁMICO (POST-SOLICITUD) */}
      {questions.length > 0 && (
        <>
          <SectionTitle mono="CUESTIONARIO" title="PREGUNTAS ESPECÍFICAS DE LA VACANTE" />
          <div className="screening-list grid gap-6">
            {questions.map((q) => (
              <div key={q.id} className="input-group mb-6">
                <label className="mono mb-2" style={{ fontSize: '0.65rem' }}>// {q.question_text} {q.is_required && "*"}</label>
                {q.question_type === "text" && (
                  <input
                    className="glass-input compact"
                    onInput={(e: any) => e.target.value = e.target.value.toUpperCase()}
                    {...register(`screening_answers.${q.id}` as any, { required: q.is_required })}
                  />
                )}

                {q.question_type === "boolean" && (
                  <div className="radio-group-row">
                    <label className="radio-btn compact"><input type="radio" value="true" {...register(`screening_answers.${q.id}` as any, { required: q.is_required })} /> <span>SI</span></label>
                    <label className="radio-btn compact"><input type="radio" value="false" {...register(`screening_answers.${q.id}` as any, { required: q.is_required })} /> <span>NO</span></label>
                  </div>
                )}

                {q.question_type === "single_choice" && (
                  <div className="choice-grid compact-choices">
                    {q.options?.map(opt => (
                      <label key={opt} className="choice-item compact-choice">
                        <input type="radio" value={opt} {...register(`screening_answers.${q.id}` as any, { required: q.is_required })} />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {(errors.screening_answers as any)?.[q.id] && <span className="field-err">RESPUESTA REQUERIDA</span>}
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        .form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
        .span-2 { grid-column: span 2; }
        .color-accent { color: var(--accent); }
        .border-dim { border-color: var(--border-dim); }
        
        .glass-input {
          text-transform: uppercase;
        }

        .radio-btn.compact {
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.8rem !important;
          padding: 0.5rem 1.5rem !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 12px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          background: rgba(255,255,255,0.03) !important;
          width: fit-content !important;
          min-width: 110px !important;
          height: auto !important;
          margin: 0 !important;
        }
        
        .radio-btn.compact:has(input:checked) {
          border-color: var(--accent) !important;
          background: rgba(61,90,254,0.1) !important;
        }
        
        .radio-btn.compact input { 
          margin: 0 !important; 
          width: 16px !important;
          height: 16px !important;
        }
        
        .radio-btn.compact span { 
          font-weight: 800 !important; 
          font-size: 0.8rem !important; 
          text-transform: uppercase !important;
          margin: 0 !important;
          line-height: 1 !important;
        }
        
        /* Contenedor de los radios */
        .radio-group-row {
          display: flex !important;
          flex-direction: row !important;
          gap: 1rem !important;
          margin-top: 0.5rem !important;
        }

        /* Estilo para los selectores y fechas dropdown */
        select.glass-input,
        input[type="date"].glass-input {
          max-width: 400px !important;
          width: 100% !important;
          cursor: pointer !important;
        }

        select.glass-input option {
          background-color: var(--bg-pure, #111) !important;
          color: var(--text-main, #fff) !important;
        }

        /* Eliminar el cuadro de enfoque (outline) azul del navegador */
        .radio-btn.compact input:focus,
        .checkbox-item input:focus,
        .glass-input:focus {
          outline: none !important;
          box-shadow: none !important;
        }

        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        
        .scale-up {
          animation: scaleIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
