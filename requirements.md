# requirements.md — Sistema de Reclutamiento y Contratación (Supabase)
**Versión:** 1.0 (limpio / desde cero)  
**Fecha:** 2026-03-04 04:35 UTC

> Este proyecto se desarrollará **desde cero** sobre Supabase (Postgres + Storage + RLS + Edge Functions).  

---

## 1) Objetivo
Construir un software para:
- Captura de candidatos (tipo Google Forms, por pasos)
- Seguimiento por RH (CRM con estatus, notas, entrevistas)
- Gestión de documentos (carga + validación)
- Automatización de correos (rechazo, agenda, cupón, onboarding)
- Onboarding (fecha/hora, vestimenta, lugar, responsable)

---

## 2) Roles
- **Candidato (público):** llena solicitud, acepta aviso de privacidad, firma, sube archivos (si aplica).
- **RH Reclutador:** pipeline, llamada, notas, estatus, entrevistas, documentos.
- **RH Admin:** vacantes, perfiles, preguntas rápidas, plantillas, catálogos, permisos.
- **Entrevistador (opcional):** captura resultado de entrevista.

---

## 3) Workflow (end-to-end)
1. **Aviso de privacidad** (mostrar + aceptación obligatoria).
2. **Vacante + perfil de puesto** (simple).
3. **Solicitud digital**:
   - Datos personales (nombre, domicilio, contacto)
   - Escolaridad + certificado (S/N)
   - Preguntas rápidas configurables por vacante
   - **Firma digital** (canvas) o carga de solicitud firmada
4. **Pre-entrevista telefónica (RH)**:
   - Si rechaza: estatus “Rechazado” + correo de agradecimiento.
   - Si pasa: estatus “Entrevista presencial” + correo para agendar.
5. **Entrevista presencial**:
   - Si no aprueba: correo de agradecimiento + cupón Mewi.
   - Si aprueba: solicitar/validar documentos.
6. **Onboarding**:
   - Enviar fecha/hora, vestimenta, lugar y quién recibe.

---

## 4) Requerimientos funcionales (FR)
### 4.1 Portal candidato (form tipo Google Forms)
- **FR-001** Mostrar aviso de privacidad activo y requerir aceptación.
- **FR-002** Mostrar vacantes activas y su perfil.
- **FR-003** Capturar solicitud digital con campos mínimos:
  - Nombre, domicilio, teléfono, correo
  - Escolaridad
  - Certificado de educación (S/N)
- **FR-004** Capturar preguntas rápidas por vacante (configurables).
- **FR-005** Capturar firma digital (canvas) y nombre del firmante.
- **FR-006** Permitir adjuntar archivos (opcional por vacante/etapa).
- **FR-007** Confirmar envío y generar folio de postulación.

### 4.2 CRM RH (seguimiento)
- **FR-010** Vista CRM (tabla/kanban) con filtros por vacante, estatus, fecha, asignado, semáforo.
- **FR-011** Ficha del candidato con: datos, historial de estatus, notas, entrevistas, documentos, bitácora de correos.
- **FR-012** Cambiar estatus con motivo obligatorio en rechazos.
- **FR-013** Registrar pre-entrevista telefónica (resultado + notas).
- **FR-014** Registrar entrevista presencial (agenda, lugar, entrevistador, resultado).

### 4.3 Automatización de mensajes
- **FR-020** Plantillas editables por RH Admin.
- **FR-021** Enviar correo automático por transición de estatus (configurable).
- **FR-022** Bitácora de envíos (éxito/fallo + error).

### 4.4 Documentos
- **FR-030** Checklist de documentos por etapa (solicitud / post-entrevista / onboarding).
- **FR-031** Subir/descargar documentos.
- **FR-032** Validar documentos: pendiente/validado/rechazado + nota RH.

### 4.5 Semáforo reingreso (ticket)
- **FR-040** Marcar persona con semáforo: rojo/amarillo/verde + motivo + historial.
- **FR-041** Mostrar el semáforo en el CRM y ficha.

### 4.6 Contratación / Personal (fase 2)
- **FR-050** Cuando un candidato queda “Contratado”, crear vínculo a un registro de empleado.
- **FR-051** Enviar detalles de onboarding (fecha/hora, vestimenta, lugar, responsable).

---

## 5) Requerimientos no funcionales (NFR)
- **NFR-001 Seguridad y privacidad:** RLS en tablas; buckets privados para documentos.
- **NFR-002 Auditoría:** historial de estatus, notas, validaciones, correos.
- **NFR-003 Usabilidad:** formulario por pasos, mobile-first.
- **NFR-004 Rendimiento:** paginación y filtros; índices por vacante/estatus/fecha.
- **NFR-005 Trazabilidad:** cada cambio debe registrar usuario y timestamp (cuando aplique).

---

## 6) Estructura de estatus (configurable por catálogo)
Estatus base (MVP) recomendados:
- `new` (Solicitud recibida)
- `to_call` (Por llamar)
- `rejected_after_call`
- `in_person_interview` (Pasa a entrevista presencial)
- `interview_scheduled`
- `interview_done_pass`
- `interview_done_fail`
- `documents_pending`
- `documents_complete`
- `onboarding_scheduled`
- `hired`

---

## 7) Plataforma objetivo: Supabase
### 7.1 Postgres + RLS
- Base de datos Postgres en Supabase con Row Level Security habilitada por tabla expuesta.

### 7.2 Storage (documentos y firma)
- Documentos y firma se guardan en buckets privados.
- En Postgres solo se guarda `storage_path` + metadatos.

### 7.3 Edge Functions (backend ligero)
Funciones recomendadas:
- `submit_application` (público): crea persona + candidato + postulación + consentimiento + firma + respuestas.
- `change_status` (RH): actualiza estatus y dispara correo (plantilla) + log.
- `send_email` (interno): integra proveedor (Resend, SES, etc.) y registra `recruit_message_logs`.

---

## 8) Seeds iniciales (MVP)
- 1 Aviso de privacidad activo.
- Catálogo de estatus base.
- Plantillas base de correo:
  - `reject_after_call`
  - `schedule_interview`
  - `fail_after_interview_with_coupon`
  - `onboarding_details`
- Tipos de documentos base por etapa.

> Ver `seed.sql`.

---

## 9) Referencia histórica (Access) — NO productivo
La BD Access histórica se utilizó únicamente para:
- Validar lista típica de campos del expediente y documentos frecuentes.
- No perder requerimientos “operativos” comunes (identificación, comprobantes, etc.).

No se ejecutará migración ni compatibilidad retroactiva.
