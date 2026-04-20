# CLAUDE.md

Este archivo orienta a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Descripción del Proyecto

**ReclutaFlow** es un sistema de gestión de reclutamiento y contratación (ATS) de nivel empresarial. Cubre todo el ciclo de vida del candidato: postulación pública → gestión del pipeline de RH → agendado de entrevistas → onboarding.

- **Frontend**: React 19 + TypeScript + Vite (SPA)
- **Backend**: Supabase (PostgreSQL + Edge Functions con Deno)
- **Correo**: Edge Function `send_email` (soporta SMTP, SendGrid o modo log_only), sin daemon externo
- **Tiempo real**: Supabase Realtime subscriptions
- **UI**: Diseño glassmorphism personalizado con Lucide React

---

## Comandos

### Frontend (`web/`)
```bash
cd web
npm run dev          # Servidor de desarrollo Vite con HMR (localhost:5173)
npm run build        # Verificación de tipos (tsc -b) + bundle para producción
npm run lint         # ESLint 9
npm run preview      # Vista previa del build de producción en local
npm run test         # Ejecutar pruebas una vez (Vitest)
npm run test:watch   # Modo observación
```

### Backend
```bash
# Servir edge functions localmente
supabase functions serve

# Desplegar todas las edge functions a Supabase
bash scripts/deploy_functions.sh

# Generar JWT de prueba (PowerShell)
pwsh scripts/get_jwt.ps1
```

### Base de datos
```bash
# Referencia del esquema (solo lectura — la BD viva en Supabase es la fuente de verdad)
# database/schema.sql
```

---

## Arquitectura

### Capas del Sistema

```
Web Pública (React SPA)
  └─→ Supabase Edge Functions (Deno)
        └─→ PostgreSQL 17.6 (Supabase — us-east-1) + Storage Bucket (recruit-docs)
              │
              └─→ pg_net (extensión) → Edge Function send_email
                  (triggers de BD insertan en recruit_message_logs → pg_net dispara HTTP POST)
```

**Sin procesos externos.** El correo funciona íntegramente dentro de Supabase mediante triggers + `pg_net` + edge functions.

### Estructura de Rutas

```
/                        → Landing (pública)
/apply                   → Formulario de postulación en 4 pasos (pública)
/track                   → Rastreador de estatus de postulación para candidatos (pública)
/login                   → Autenticación del personal de RH (pública)
/crm                     → Dashboard del pipeline (RequireAuth)
/crm/interviews          → Calendario de entrevistas + lista (RequireAuth)
/crm/admin               → Configuración del sistema (RequireAuth)
/crm/applications/:id    → Vista detallada del candidato (RequireAuth)
```

Árboles de layout:
- **PublicLayout** — envuelve `/`, `/apply`, `/track`, `/login`
- **CrmLayout** — envuelve `/crm/**`, protegido por `RequireAuth` (los tres roles)

---

## Frontend (`web/src/`)

### Archivos Clave

| Archivo | Propósito |
|---|---|
| `app/App.tsx` | Configuración de rutas con dos árboles de layout |
| `app/AuthProvider.tsx` | Contexto de Auth de Supabase, sesión/perfil/rol. Timeout de sesión 8s, fallback localStorage+memoria |
| `app/layouts/CrmLayout.tsx` | Shell protegido del CRM con sidebar |
| `app/layouts/PublicLayout.tsx` | Shell público |
| `app/routes/Landing.tsx` | Página de inicio |
| `app/routes/Apply.tsx` | Wrapper delgado que renderiza `<ApplyFlow />` |
| `app/routes/Login.tsx` | Login email/contraseña para personal de RH |
| `app/routes/CrmDashboard.tsx` | Vista general del pipeline: KPIs, filtros, exportar CSV, tiempo real |
| `app/routes/CrmApplicationDetail.tsx` | Vista completa del candidato: pestañas Perfil, Entrevistas, Notas, Documentos |
| `app/routes/CrmInterviews.tsx` | FullCalendar (semana/día/mes), arrastrar para reagendar, registro de resultados |
| `app/routes/CrmAdmin.tsx` | Pestañas de configuración: Vacantes, Preguntas, Documentos, Plantillas, Usuarios, Estatus, Métricas |
| `app/routes/TrackApplication.tsx` | Consulta de estatus de postulación por ID para el candidato |
| `components/RequireAuth.tsx` | Guardia de ruta, acepta arreglo `roles` |
| `features/apply/components/SignaturePad.tsx` | Captura de firma digital en canvas (ratón + touch) |
| `features/apply/components/SlotCalendarV2.tsx` | react-calendar + grilla de horarios; valida slots ocupados |
| `components/NotificationBell.tsx` | Notificaciones en tiempo real |
| `components/Toast.tsx` | Mensajes de éxito/error/info efímeros |
| `components/LoadingScreen.tsx` | Indicador de carga animado |
| `lib/hooks/useToast.ts` | Hook de gestión del sistema de notificaciones toast |
| `components/ThemeToggle.tsx` | Modo oscuro/claro (variables CSS) |
| `components/InteractiveStars.tsx` | Estrellas animadas de fondo |
| `lib/supabaseClient.ts` | Inicialización del cliente Supabase JS (fetch personalizado, timeout 15s, almacenamiento híbrido) |
| `lib/resolveFunctionsBaseUrl.ts` | Resuelve la URL base de las edge functions desde env o auto-detecta |
| `lib/types.ts` | `ProfileRole`, `Profile` |
| `lib/format.ts` | `formatDateTime()`, `formatDate()` — locale español, zona horaria Ciudad de México |

### Formulario de Postulación (`features/apply/`)

**`ApplyFlow.tsx`** — Dueño de todo el estado del formulario (React Hook Form) y orquesta los 4 pasos. Maneja el envío final vía `applyService.ts` y la subida de archivos a URLs firmadas.

**`types.ts`** — Interfaz completa `ApplyFormValues` + configuración de `steps` (4 pasos con íconos).

**Componentes de pasos** (`features/apply/components/`):

| Componente | Recopila |
|---|---|
| `Step01Consent.tsx` | Aviso de privacidad (scroll obligatorio para aceptar) + captura de firma digital (`SignaturePad`). Valida: scroll completo, firma capturada, nombre del firmante ≥ 3 palabras |
| `Step02Vacancy.tsx` | Selección de vacante con detalle del perfil (requisitos, escolaridad, habilidades, salario, horario, ubicación, beneficios) |
| `Step03Identity.tsx` | Datos personales (nombre, correo, fecha de nacimiento, domicilio, teléfono, estado civil), preferencias laborales (salario, experiencia, preferencia de turno, rotación, compromisos fijos, disponibilidad fines de semana, INFONAVIT, empleado previo), historial laboral (2 empleos con refs de jefe), referencias personales (2), habilidades (cajero, bebidas, inventario, limpieza, otras), preguntas de filtro dinámicas, ajustes médicos, fecha de inicio, comentarios |
| `Step04Availability.tsx` | Selección de horario para entrevista vía `SlotCalendarV2`. Rango: mañana → +11 días, solo días hábiles, 9am–5pm por hora. Valida: no tiempos pasados, ≥24h de anticipación, no slots ocupados |

> El formulario tiene 4 pasos. Los tipos de documento con `stage='application'` se envían como parte del payload de `submit_application`.

**`services/applyService.ts`** — Mapea `ApplyFormValues` al payload de la API, convierte booleanos de radio (string) a booleanos reales, filtra historial laboral y referencias vacíos, llama a la edge function `submit_application`, y sube archivos a las URLs firmadas devueltas.

### Forma de ApplyFormValues

```typescript
{
  consent: { accepted: boolean }
  job_posting_id: string
  person: { first_name, last_name, email, phone, phone_optional?, birth_date, address_line1, postal_code, colonia, city, state, marital_status }
  application_details: { desired_salary, has_experience, years_experience, schedule_preference, can_rotate_shifts, fixed_commitment_bool, fixed_commitment, weekend_availability, previous_employee, previous_employee_reason?, agrees_with_salary, has_infonavit, salary_agreement, adjustments_required, start_date, health_adjustments, comments }
  work_history: [{ company, position, period_from, period_to, manager, manager_position, phone, reason_for_leaving }]
  personal_references: [{ name, occupation, phone }]
  skills: { cashier?, drinks?, inventory?, cleaning?, others }
  candidate: { education_level, has_education_certificate }
  screening_answers: Record<string, string | string[] | boolean | number>
  signature_base64: string | null
  signer_name: string
  availability: { slot_1: string }
}
```

---

## Backend — Supabase Edge Functions (`supabase/functions/`)

7 funciones activas en Supabase (verificado 2026-04-20). Todas con `verify_jwt: false` — cada función implementa su propia validación de acceso. Manejadores Deno TypeScript independientes. Utilidades compartidas en `_shared/`.

### Utilidades `_shared/`

| Archivo | Exporta |
|---|---|
| `cors.ts` | `corsHeaders`, `jsonResponse()`, `errorResponse()` |
| `supabase.ts` | `getAdminClient()` (service role key), `getUserClient(req)` (scope de usuario vía JWT del header Authorization) |
| `validation.ts` | `requireFields()`, `isNonEmptyString()`, `asString()` |
| `templating.ts` | `renderTemplate()` — reemplaza placeholders `{variable}` en strings |

### Edge Functions

#### `submit_application` — Pública, sin autenticación
> Última versión desplegada: 2026-04-20

Crea la postulación completa de forma atómica usando service role (bypassa RLS).

**Payload requerido:**
```json
{
  "job_posting_id": "uuid",
  "person": { "first_name", "last_name", "email?", "phone?", "address_line1?", ... },
  "consent": { "accepted": true, "privacy_notice_id?": "uuid" },
  "candidate?": { "education_level?", "has_education_certificate?" },
  "signature?": { "signer_name?", "signature_base64?", "signature_json?", "request_signed_upload?" },
  "screening_answers?": [{ "question_id", "answer_text?", "answer_json?" }],
  "documents?": [{ "document_type_id", "file_name?" }],
  "suggested_slots?": { "slot_1?", "slot_2?", "slot_3?" },
  "create_signed_upload_urls?": true
}
```

**Flujo:**
1. Valida vacante activa
2. Inserta `recruit_persons`
3. Inserta `recruit_candidates`
4. **Auto-asigna reclutador** — round-robin entre `rh_recruiter` (excluye `rh_admin`), menor carga de postulaciones no terminales, desempate aleatorio. Fallback: aleatorio. Si no hay reclutador disponible → `assigned_to = null`
5. Inserta `recruit_applications` con `status_key = 'new'`
6. Inserta `recruit_privacy_consents` — si no se provee `privacy_notice_id` usa el aviso activo más reciente
7. Maneja firma:
   - `signature_base64` → sube directo al bucket, inserta `recruit_digital_signatures`
   - `request_signed_upload = true` → devuelve URL firmada para subida posterior
8. Inserta `recruit_screening_answers`
9. Inserta `recruit_application_documents` + genera URLs firmadas si `create_signed_upload_urls = true`

**Respuesta:**
```json
{
  "application_id": "uuid",
  "candidate_id": "uuid",
  "person_id": "uuid",
  "status_key": "new",
  "submitted_at": "ISO datetime",
  "signature_upload": { "path": "...", "signed_url": "...", "token": "..." },
  "document_uploads": [{ "document_type_id": "...", "path": "...", "signed_url": "...", "token": "..." }]
}
```

> Storage path para documentos: `applications/{application_id}/documents/{document_type_id}/{uuid}-{filename}`
> Storage path para firmas: `applications/{application_id}/signatures/{uuid}.{ext}`

---

#### `change_status` — Requiere JWT válido de RH
> Última versión desplegada: 2026-04-04

**Payload:** `{ application_id, status_key, reason?, note?, email_variables? }`
También acepta `variables` como alias de `email_variables`.

**Flujo:**
1. Valida JWT — rechaza si no hay usuario autenticado
2. Captura `status_key` actual de la postulación (para detectar la transición)
3. Llama RPC `recruit_change_status(p_application_id, p_status_key, p_reason, p_note)` — valida transición permitida, obliga `reason` si el estatus lo requiere, actualiza `recruit_applications`, inserta en `recruit_application_status_history`, inserta nota opcional en `recruit_notes`
4. Inserta en `recruit_event_logs` con `event_key = 'status_changed'`, metadatos: `{from_status_key, to_status_key, reason, note}`
5. Consulta `recruit_status_transitions.template_key` para la transición ocurrida
6. Si hay `template_key` → invoca `send_email` vía `supabase.functions.invoke`

**Respuesta:** `{ ok: true, email: { ok, error?, template_key } | null }`

---

#### `schedule_interview` — Requiere JWT válido de RH
> Última versión desplegada: 2026-04-07

**Payload:** `{ application_id, scheduled_at, interviewer_id? }`
Si se omite `interviewer_id`, usa el usuario autenticado.

**Flujo:**
1. Valida JWT vía `Authorization` header
2. Verifica conflicto: entrevistador ya tiene entrevista `pending` en el mismo slot (ventana de 1h)
3. Verifica duplicado: postulación ya tiene entrevista `pending` activa → error 409
4. Genera link Jitsi Meet: `https://meet.jit.si/entrevista-{primeros10charsDelAppIdSinGuiones}`
5. Actualiza `recruit_applications`: `meet_link`, `status_key = 'virtual_scheduled'`, `status_reason`
6. Inserta `recruit_interviews` con `interview_type = 'virtual'`, `result = 'pending'`
7. Si falla el insert de entrevista → revierte `recruit_applications` a `status_key = 'validation'`

> **Nota:** El `schedule_interview` NO inserta en `recruit_calendar_events` ni llama a Google Calendar en la versión actual desplegada.

**Respuesta:** `{ success: true, meet_link: "https://meet.jit.si/..." }`
**Error 409:** entrevistador ocupado o postulación ya tiene entrevista pendiente

---

#### `send_email` — Pública / Sistema (valida internamente)
> Última versión desplegada: 2026-04-09

Soporta dos modos de entrada: **llamada directa** (frontend/CRM) y **webhook** (AFTER INSERT en `recruit_message_logs`).

**Payload llamada directa:**
```json
{
  "application_id": "uuid",
  "template_key?": "string",
  "template_id?": "uuid",
  "to_address?": "string",
  "to_recruiter?": true,
  "variables?": { "key": "value" }
}
```

**Payload webhook** (auto-detectado si tiene `type` + `record` + `table = 'recruit_message_logs'`):
```json
{ "type": "INSERT", "table": "recruit_message_logs", "record": { "id", "application_id", "template_id", "to_address", "status", "variables" } }
```

**Flujo:**
1. Detecta modo (webhook vs directo). Si webhook y `record.status = 'sent'` → omite para prevenir loop
2. Valida acceso: usuario autenticado con rol válido verifica `can_access_application`; llamadas de sistema omiten verificación
3. Si `to_recruiter = true` → resuelve email del reclutador asignado vía `auth.admin.getUserById`
4. Carga plantilla por `template_key` o `template_id`
5. Resuelve variables de contexto desde BD:
   - `recruit_job_postings` → `job_title`, `job_branch`
   - `profiles` (reclutador asignado) → `recruiter_name`
   - `recruit_interviews` (última) → `schedule_date`, `schedule_time`, `location`, `interviewer_name`
   - `recruit_onboarding_plans` → `onboarding_date`, `onboarding_time`, `location`, `dress_code`, `host_name`, `notes_text`
   - `recruit_applications.meet_link` → `meet_link` como `[UNIRSE AHORA](url)`
6. Fusiona con variables del payload (el payload sobreescribe los valores resueltos)
7. Renderiza asunto y cuerpo vía `renderTemplate()`
8. Pre-procesa Markdown (`**bold**`, `*italic*`, `[text](url)`) → HTML antes de `marked.parse()`
9. Envuelve en HTML "Sistema Elite de Talento"
10. Envía según `EMAIL_SEND_MODE` (`smtp` | `sendgrid` | `log_only`)
11. Webhook → UPDATE en `recruit_message_logs`; Directo → INSERT nuevo log
12. Inserta `recruit_event_logs` con `event_key = 'email_sent'` o `'email_failed'`

**Modos de envío (`EMAIL_SEND_MODE`):**
| Valor | Comportamiento |
|---|---|
| `smtp` | SMTP con TLS via `SmtpClient`. Incluye patch de compatibilidad Deno 2.x |
| `sendgrid` | REST API de SendGrid |
| `log_only` | Marca `sent` sin enviar (desarrollo/pruebas) |

**Respuesta éxito:** `{ ok: true, provider_message_id: "..." }`
**Respuesta error:** HTTP 502 con `{ error: "...", details: "..." }`

---

#### `get_application_preview` — Service role (sin verificación de JWT)
> Última versión desplegada: 2026-04-03

Devuelve variables de plantilla pre-renderizadas para previsualizar correos en CrmAdmin.

**Payload:** `{ application_id: "uuid" }`

**Variables devueltas:**
```json
{
  "variables": {
    "name", "job_title", "job_branch", "schedule_date", "schedule_time",
    "location", "recruiter_name", "interviewer_name", "contact_email",
    "datetime", "application_id"
  }
}
```

---

#### `get_crm_metrics` — Service role (sin verificación de JWT)
> Última versión desplegada: 2026-04-03

Devuelve KPIs del sistema para la pestaña Métricas de CrmAdmin.

**Flujo:** Consultas en paralelo (`Promise.all`):
- COUNT total de `recruit_applications`
- COUNT de `recruit_message_logs` con `status = 'sent'`
- COUNT de `recruit_message_logs` con `status = 'failed'`
- RPC `get_status_counts` (fallback: agrupa `recruit_applications.status_key` en memoria)
- Últimos 20 eventos de `recruit_event_logs` con joins a `profiles` y `recruit_message_templates`

**Respuesta:**
```json
{
  "summary": { "total_applications": 0, "emails_sent": 0, "emails_failed": 0, "status_breakdown": [] },
  "recent_events": []
}
```

---

#### `remind_interviews` — Cron diario (sin verificación de JWT)
> Última versión desplegada: 2026-04-03

Consulta entrevistas `result = 'pending'` programadas para mañana (00:00–23:59) y registra evento `remind_24h_sent` en `recruit_event_logs` por cada una. Idempotente: omite las que ya tienen el evento registrado.

> **Estado actual:** Solo registra el evento de log. El envío de correo de recordatorio aún no está implementado en el cuerpo de la función.

**Cron activo en BD:** diario a las 8am UTC (`0 8 * * *`) vía `pg_cron`. Administrar en **Dashboard → Integrations → Cron Jobs**.

**Respuesta:** `{ processed: N, sent: N, already_sent: N }`

---

## Motor de Correo — Edge Function `send_email`

### Tres modos de disparo

| Modo | Quién lo llama | Cuándo |
|---|---|---|
| **Llamada directa** | CRM (frontend) | El reclutador envía un correo manualmente desde la vista de la postulación |
| **Automático por `change_status`** | Edge function `change_status` | Al cambiar de estatus, si la transición tiene un `template_key` configurado |
| **Database Webhook** | `process_new_email_log` (Dashboard → Integrations → Webhooks) | AFTER INSERT en `recruit_message_logs` — dispara automáticamente hacia `send_email` |

### Modos de envío (`EMAIL_SEND_MODE`)

| Valor | Comportamiento |
|---|---|
| `log_only` | No envía nada real; marca como `sent` en el log (útil para pruebas/desarrollo) |
| `smtp` | Envía vía SMTP con TLS (Gmail o cualquier servidor). Usa `SmtpClient` de Deno |
| `sendgrid` | Envía vía API REST de SendGrid. Requiere `SENDGRID_API_KEY` y `SENDGRID_FROM` |

### Flujo interno de `send_email`

1. Detecta si la petición es un **webhook** (campo `type` + `record` en payload con tabla `recruit_message_logs`) o una **llamada directa**
2. Extrae `application_id` y `template_key` / `template_id` según el origen
3. Valida acceso: si hay JWT válido verifica rol y `can_access_application`; si es webhook/sistema omite la verificación
4. Carga la plantilla de `recruit_message_templates`
5. Resuelve el email del destinatario (de payload o del candidato de la postulación)
6. Recopila variables de contexto desde la BD:
   - `recruit_job_postings` → `job_title`, `job_branch`
   - `profiles` (reclutador asignado) → `recruiter_name`
   - `recruit_interviews` (última) → `schedule_date`, `schedule_time`, `location`, `interviewer_name`
   - `recruit_onboarding_plans` → `onboarding_date`, `onboarding_time`, `location`, `dress_code`, `host_name`
   - `recruit_applications.meet_link` → `meet_link` (formateado como enlace Markdown)
7. Fusiona variables por defecto con las variables adicionales del payload (`variables` en el body)
8. Renderiza asunto y cuerpo vía `renderTemplate()` (sustituye `{variable}`)
9. Convierte Markdown → HTML con `marked`
10. Envuelve en plantilla HTML con estilos "Sistema Elite de Talento"
11. Envía según `EMAIL_SEND_MODE`
12. Actualiza `recruit_message_logs` (update si era webhook, insert si era llamada directa)
13. Registra evento en `recruit_event_logs` con `event_key = 'email_sent'` o `'email_failed'`

### Variables disponibles en plantillas

Se resuelven automáticamente desde la BD. El payload `variables` las sobreescribe.

| Variable | Resuelto desde |
|---|---|
| `{name}` / `{candidate_name}` | `recruit_persons.first_name + last_name` |
| `{job_title}` | `recruit_job_postings.title` |
| `{job_branch}` | `recruit_job_postings.branch` |
| `{schedule_date}` / `{interview_date}` | `recruit_interviews.scheduled_at` (es-MX, México TZ) |
| `{schedule_time}` / `{interview_time}` | `recruit_interviews.scheduled_at` (hora) |
| `{datetime}` | `schedule_date + schedule_time` combinados |
| `{location}` | `recruit_onboarding_plans.location` si la plantilla usa onboarding, si no `recruit_interviews.location` |
| `{recruiter_name}` | `profiles.full_name` del reclutador asignado |
| `{interviewer_name}` | `profiles.full_name` del entrevistador (última entrevista) |
| `{meet_link}` | `recruit_applications.meet_link` como `[UNIRSE AHORA](url)` |
| `{onboarding_date}` / `{onboarding_time}` | `recruit_onboarding_plans.scheduled_at` |
| `{dress_code}` | `recruit_onboarding_plans.dress_code` |
| `{host_name}` | `recruit_onboarding_plans.host_name` (fallback: `recruiter_name`) |
| `{notes_text}` | `recruit_onboarding_plans.notes` (fallback: `"Sin notas adicionales."`) |
| `{application_id}` | UUID de la postulación |
| `{track_url}` | `{FRONTEND_URL}/track?id={application_id}` |
| `{coupon_code}` / `{contact_phone}` / `{contact_email}` | Vacíos por defecto, sobreescribibles |

---

## Esquema de Base de Datos

> **La BD viva en Supabase (PostgreSQL 17.6, us-east-1) es la fuente de verdad.** El archivo `database/schema.sql` es la referencia extraída directamente de la BD el 2026-04-20. Cuando haya discrepancia, la BD gana.

Convención de prefijos: `recruit_*` = módulo de reclutamiento, `core_*` = módulo de empleados (Fase 2).

### Funciones de Autorización (security definer)

| Función | Retorna | Descripción |
|---|---|---|
| `set_updated_at()` | trigger | Auto-asigna `updated_at = now()` en UPDATE |
| `is_rh()` | boolean | Usuario tiene algún rol de RH |
| `is_rh_admin()` | boolean | Usuario tiene rol `rh_admin` |
| `is_rh_recruiter()` | boolean | Usuario tiene rol `rh_recruiter` |
| `is_interviewer()` | boolean | Usuario tiene rol `interviewer` |
| `is_interviewer_for_application(app_id)` | boolean | Usuario es entrevistador en esa postulación |
| `can_access_application(app_id)` | boolean | admin O reclutador asignado O entrevistador |
| `can_access_candidate(candidate_id)` | boolean | Puede acceder a alguna postulación del candidato |
| `can_access_person(person_id)` | boolean | Puede acceder a algún candidato de esa persona |
| `recruit_change_status(p_application_id, p_status_key, p_reason, p_note)` | void | Cambio autorizado + nota opcional |
| `get_user_email(p_user_id)` | text | Email de un usuario desde `auth.users` |
| `application_id_from_path(p)` | uuid | Extrae application_id del path de Storage |
| `get_occupied_slots()` | table | Slots ocupados para el calendario del candidato |
| `get_best_recruiter_for_slots(p_slot1, p_slot2, p_slot3)` | uuid | Reclutador más disponible para los slots propuestos |
| `get_available_recruiter_for_slot(p_slot)` | uuid | Alias de `get_best_recruiter_for_slots` para un slot |

### Tablas

#### `profiles` — Personal de RH (2 rows)
```
id uuid PK → auth.users (cascade delete)
role text NOT NULL CHECK ('rh_admin','rh_recruiter','interviewer')
full_name text
created_at, updated_at timestamptz NOT NULL DEFAULT now()
```

#### `core_employees` — Empleados contratados, Fase 2 (0 rows)
```
id uuid PK DEFAULT gen_random_uuid()
first_name, last_name text
phone_mobile, email_work, position, branch text
hire_date date
status text NOT NULL DEFAULT 'active' CHECK ('active','inactive')
created_at, updated_at timestamptz NOT NULL
```

#### `recruit_job_postings` — Vacantes (1 row)
```
id uuid PK
title text NOT NULL
branch, area, employment_type, description_short text
status text NOT NULL DEFAULT 'active' CHECK ('active','paused','closed')
created_by uuid → profiles
created_at, updated_at timestamptz NOT NULL
```
RLS: SELECT público para `status = 'active'`; RH acceso completo.

#### `recruit_job_profiles` — Detalle extendido de vacante (1:1)
```
id uuid PK
job_posting_id uuid NOT NULL UNIQUE → recruit_job_postings (cascade delete)
requirements, min_education, skills, experience text
role_summary, responsibilities, qualifications, benefits text
schedule, salary_range, location_details, growth_plan, internal_notes text
created_at, updated_at timestamptz NOT NULL
```

#### `recruit_statuses` — Catálogo de etapas del pipeline (10 activos)

| status_key | label | sort_order | category |
|---|---|---|---|
| `new` | NUEVO POSTULANTE | 1 | pipeline |
| `validation` | VALIDACIÓN INICIAL | 2 | pipeline |
| `virtual_scheduled` | REUNIÓN VIRTUAL | 3 | interview |
| `virtual_done` | ENTREVISTA APROBADA | 4 | pipeline |
| `documents_pending` | SOLICITUD DE DOCUMENTOS | 5 | pipeline |
| `documents_complete` | EXPEDIENTE COMPLETO | 6 | pipeline |
| `onboarding` | EN PROCESO DE INGRESO | 7 | outcome |
| `onboarding_scheduled` | ONBOARDING PROGRAMADO | 8 | pipeline |
| `hired` | CONTRATADO | 9 | outcome |
| `rejected` | CARTERA (RECHAZADO) | 10 | outcome |

```
status_key text PK
label text NOT NULL
sort_order int NOT NULL DEFAULT 0
category text  -- 'pipeline' | 'interview' | 'outcome'
requires_reason boolean NOT NULL DEFAULT false
is_active boolean NOT NULL DEFAULT true
created_at, updated_at timestamptz NOT NULL
```

#### `recruit_status_transitions` — PK: `(from_status_key, to_status_key)`
```
from_status_key text NOT NULL → recruit_statuses
to_status_key text NOT NULL → recruit_statuses
template_key text → recruit_message_templates (on delete set null)
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL
```
La matriz es permisiva (cubre prácticamente todas las combinaciones). El trigger `trg_recruit_applications_status_guard` valida cada transición antes de ejecutarla.

#### `recruit_persons` — Datos personales (137 rows)
```
id uuid PK
first_name, last_name text NOT NULL
phone, email text
address_line1, address_line2, neighborhood, city, state, postal_code text
created_at, updated_at timestamptz NOT NULL
```

#### `recruit_candidates` — Perfil del candidato (64 rows, 1:1 con persona)
```
id uuid PK
person_id uuid NOT NULL UNIQUE → recruit_persons (cascade delete)
education_level text
has_education_certificate boolean
created_at, updated_at timestamptz NOT NULL
```

#### `recruit_applications` — Postulaciones (9 rows)
```
id uuid PK
job_posting_id uuid NOT NULL → recruit_job_postings
candidate_id uuid NOT NULL → recruit_candidates
UNIQUE (job_posting_id, candidate_id)
status_key text NOT NULL → recruit_statuses
status_reason text
traffic_light text CHECK ('red','yellow','green')
assigned_to uuid → profiles
submitted_at, created_at, updated_at timestamptz NOT NULL
hired_employee_id uuid → core_employees
suggested_slot_1, suggested_slot_2, suggested_slot_3 timestamptz
meet_link text
```

Triggers:
- `trg_recruit_applications_updated_at` — auto updated_at
- `trg_recruit_applications_status_guard` — valida transición + reason requerida (BEFORE)
- `trg_recruit_applications_status_log_insert/update` — registra en historial (AFTER)
- `trg_recruit_applications_immutable` — protege campos clave para no-admin
- `trigger_auto_assign_recruiter` — round-robin al insertar (BEFORE)
- `trigger_notify_recruiter` — encola correo al reclutador asignado (AFTER)

#### `recruit_application_status_history` — Historial de cambios de estatus
```
id uuid PK
application_id uuid NOT NULL → recruit_applications (cascade delete)
status_key text NOT NULL → recruit_statuses
reason, notes text
changed_by uuid → profiles
changed_at timestamptz NOT NULL DEFAULT now()
```

#### `recruit_notes`
```
id uuid PK
application_id uuid NOT NULL → recruit_applications (cascade delete)
note text NOT NULL
created_by uuid → profiles
created_at timestamptz NOT NULL
```

#### `recruit_privacy_notices`
```
id uuid PK
version text NOT NULL UNIQUE
content_md text NOT NULL
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL
```
BD actual: 1 aviso activo (`v1`).

#### `recruit_privacy_consents`
```
id uuid PK
application_id uuid NOT NULL → recruit_applications (cascade delete)
privacy_notice_id uuid NOT NULL → recruit_privacy_notices
accepted boolean NOT NULL
accepted_at timestamptz NOT NULL DEFAULT now()
user_agent text
ip_address inet
```

#### `recruit_digital_signatures`
```
id uuid PK
application_id uuid NOT NULL → recruit_applications (cascade delete)
signer_name text NOT NULL
signature_storage_path text  -- ruta en bucket recruit-docs
signature_json jsonb
signed_at timestamptz NOT NULL DEFAULT now()
```

#### `recruit_screening_questions`
```
id uuid PK
job_posting_id uuid NOT NULL → recruit_job_postings (cascade delete)
question_text text NOT NULL
question_type text NOT NULL CHECK ('text','boolean','single_choice','multi_choice','number')
options jsonb
is_required boolean NOT NULL DEFAULT false
created_at timestamptz NOT NULL
```

#### `recruit_screening_answers`
```
id uuid PK
application_id uuid NOT NULL → recruit_applications (cascade delete)
question_id uuid NOT NULL → recruit_screening_questions (cascade delete)
UNIQUE (application_id, question_id)
answer_text text
answer_json jsonb
created_at timestamptz NOT NULL
```

#### `recruit_interviews` — (1 row)
```
id uuid PK
application_id uuid NOT NULL → recruit_applications (cascade delete)
interview_type text NOT NULL CHECK ('phone','in_person','virtual')
scheduled_at timestamptz
location text
interviewer_id uuid → profiles
result text NOT NULL DEFAULT 'pending' CHECK ('pending','pass','fail','no_show','reschedule')
notes text
created_at, updated_at timestamptz NOT NULL
```

#### `recruit_calendar_events`
```
id uuid PK
interview_id uuid NOT NULL → recruit_interviews (cascade delete)
provider text NOT NULL DEFAULT 'email_only' CHECK ('google_calendar','email_only')
event_id, event_link text
created_at timestamptz NOT NULL
```

#### `recruit_document_types` — Catálogo de documentos

**Activos:**

| name | label | stage | is_required |
|---|---|---|---|
| `solicitud_empleo` | SOLICITUD DE EMPLEO | application | true |
| `acta_nacimiento` | Acta de Nacimiento (Mayor de 18 años) | onboarding | true |
| `cartas_recomendacion` | 2 Cartas de Recomendación | onboarding | true |
| `comprobante_domicilio` | Comprobante de domicilio | onboarding | true |
| `constancia_estudios` | Constancia de estudios | onboarding | true |
| `curp` | CURP (Fecha de impresión reciente) | onboarding | true |
| `examen_medico` | Examen médico | onboarding | true |
| `ine` | INE (Identificación Oficial) | onboarding | true |
| `rfc` | RFC (En caso de contar con él) | onboarding | false |
| `tipo_sangre` | Comprobante de Tipo de Sangre | onboarding | true |

```
id uuid PK
name text NOT NULL UNIQUE
label text
stage text NOT NULL CHECK ('application','post_interview','onboarding')
is_required boolean NOT NULL DEFAULT false
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL
```

#### `recruit_application_documents`
```
id uuid PK
application_id uuid NOT NULL → recruit_applications (cascade delete)
document_type_id uuid NOT NULL → recruit_document_types
storage_path text NOT NULL
validation_status text NOT NULL DEFAULT 'pending' CHECK ('pending','under_review','validated','rejected')
validation_notes text
uploaded_at timestamptz NOT NULL DEFAULT now()
validated_at timestamptz
```

#### `recruit_message_templates` — Plantillas de correo (12 activas)

| template_key | Propósito |
|---|---|
| `welcome_candidate` | Confirmación de postulación al candidato |
| `schedule_interview` | Citación a reunión virtual |
| `virtual_reschedule_candidate` | Notifica reagendado al candidato |
| `virtual_reschedule_recruiter` | Notifica reagendado al reclutador |
| `documents_request` | Solicitud de documentos de ingreso |
| `document_rejected` | Notifica documento rechazado al candidato |
| `all_docs_uploaded` | Notifica al reclutador que el expediente está completo |
| `onboarding_details` | Detalles de onboarding al candidato |
| `onboarding_host_notification` | Notifica al anfitrión de onboarding |
| `welcome_onboarding` | Bienvenida al equipo al contratar |
| `rejected` | Notificación de rechazo al candidato |
| `new_assignment_recruiter` | Nueva postulación asignada al reclutador |

```
id uuid PK
template_key text NOT NULL UNIQUE
subject text NOT NULL
body_md text NOT NULL  -- Markdown con placeholders {variable}
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL
```

#### `recruit_message_logs` — Cola de correos
```
id uuid PK
application_id uuid NOT NULL → recruit_applications (cascade delete)
template_id uuid → recruit_message_templates
channel text NOT NULL DEFAULT 'email' CHECK ('email','calendar','other')
to_address text
status text NOT NULL DEFAULT 'queued' CHECK ('queued','sent','failed')
provider_message_id, error text
sent_at timestamptz
created_at timestamptz NOT NULL
```
**Webhook `process_new_email_log`** (AFTER INSERT en `recruit_message_logs`): trigger PostgreSQL → `pg_net` → edge function `send_email`. Envío 100% asíncrono dentro de Supabase.

#### `recruit_template_variables` — Variables disponibles para plantillas (24 activas)

Variables clave: `name`, `candidate_name`, `job_title`, `job_branch`, `schedule_date`, `schedule_time`, `interview_date`, `interview_time`, `meet_link`, `location`, `recruiter_name`, `interviewer_name`, `onboarding_date`, `onboarding_time`, `dress_code`, `host_name`, `notes_text`, `coupon_code`, `contact_phone`, `contact_email`, `application_id`, `track_url`, `crm_url`, `doc_name`, `rejection_reason`

```
variable_key text PK
label, description, example_value text
is_active boolean NOT NULL DEFAULT true
sort_order int NOT NULL DEFAULT 0
created_at timestamptz NOT NULL
```

#### `recruit_event_logs` — Auditoría de eventos
```
id uuid PK
event_key text NOT NULL   -- p. ej. 'status_changed', 'email_sent'
entity_type text NOT NULL -- p. ej. 'application'
entity_id uuid
application_id uuid → recruit_applications (on delete set null)
template_id uuid → recruit_message_templates
metadata jsonb NOT NULL DEFAULT '{}'
created_by uuid → profiles
created_at timestamptz NOT NULL
```

#### `recruit_rehire_flags` — Semáforo de reingreso
```
id uuid PK
person_id uuid NOT NULL → recruit_persons (cascade delete)
color text NOT NULL CHECK ('red','yellow','green')
reason text NOT NULL
set_by uuid → profiles
set_at timestamptz NOT NULL DEFAULT now()
```

#### `recruit_onboarding_hosts` — Anfitriones de onboarding (1 row)
```
id uuid PK
full_name text NOT NULL
email text NOT NULL
phone text
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL
```

#### `recruit_onboarding_plans` — Planes de onboarding (0 rows)
```
id uuid PK
application_id uuid NOT NULL UNIQUE → recruit_applications (cascade delete)
scheduled_at timestamptz
location, dress_code, host_name, notes text
host_id uuid → recruit_onboarding_hosts (on delete set null)
created_by uuid → profiles
created_at, updated_at timestamptz NOT NULL
```
Usada por `send_email` para resolver `{onboarding_date}`, `{onboarding_time}`, `{dress_code}`, `{host_name}`.

### Archivo de Referencia

| Archivo | Propósito |
|---|---|
| `database/schema.sql` | DDL completo extraído de la BD viva (2026-04-20). Incluye tablas, triggers, RLS, funciones, storage. **Solo referencia — no ejecutar en producción sin revisar.** |

---

## Variables de Entorno

### `web/.env`
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FUNCTIONS_BASE_URL=   # Dejar vacío para auto-resolver
VITE_STORAGE_BUCKET=recruit-docs
```

### `.env` raíz (solo para referencia local / legacy)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```


### `supabase/.env` — Secrets de Edge Functions (fuente real de configuración de correo)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EMAIL_SEND_MODE=smtp          # 'smtp' | 'sendgrid' | 'log_only'
# --- Modo SMTP ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=                    # Contraseña de aplicación de Gmail
SMTP_FROM=                    # "Nombre <correo@dominio.com>"
SMTP_SECURE=true
# --- Modo SendGrid ---
SENDGRID_API_KEY=
SENDGRID_FROM=                # "Nombre <correo@dominio.com>"
# --- General ---
DEFAULT_TIMEZONE=America/Mexico_City
FRONTEND_URL=                 # Usado para construir {track_url} en los correos
```

---

## Convenciones Clave

- **Alias de ruta**: `@/` resuelve a `web/src/` (configurado en `tsconfig.app.json` y `vite.config.ts`)
- **Roles**: `rh_admin` > `rh_recruiter` > `interviewer`. El guardia de ruta en `RequireAuth.tsx` acepta un arreglo `roles`.
- **Bucket de storage**: `recruit-docs` contiene firmas, CVs y documentos de onboarding. URLs firmadas devueltas por `submit_application`.
- **Zona horaria**: Todos los timestamps se almacenan como `timestamptz`. La visualización usa `America/Mexico_City`.
- **Cambios de estatus**: Definidos en `recruit_status_transitions`. Siempre cambiar estatus vía la edge function `change_status` (nunca actualización directa a BD) para que el historial de auditoría y los disparadores de correo funcionen correctamente.
- **TypeScript**: Modo estricto. Tipos de entidades DB en `web/src/lib/types.ts` y `web/src/features/apply/types.ts`.
- **Variables de plantilla de correo**: Usar sintaxis `{nombre_variable}`. Ver tabla completa en la sección "Motor de Correo". Las variables se resuelven automáticamente desde la BD; se pueden sobreescribir en el payload de `send_email`.
- **Motor de correo**: Todo el envío de correos ocurre dentro de la edge function `send_email`. No existe ningún daemon externo. El modo activo se controla con el secret `EMAIL_SEND_MODE` (`smtp` | `sendgrid` | `log_only`).
- **RPC `recruit_change_status`**: Llamado por la edge function `change_status`. Valida autorización, aplica reglas de transición (vía trigger de BD), actualiza `status_key + status_reason`, registra historial e inserta nota opcionalmente.
- **Tipo de entrevista**: `recruit_interviews.interview_type` acepta `'phone'`, `'in_person'` y `'virtual'` (confirmado en BD viva). La edge function `schedule_interview` siempre inserta `'virtual'`.
- **`suggested_slot_1/2/3`**: Los tres campos existen en la BD real. Solo `slot_1` es capturado en `ApplyFormValues.availability`.
- **Transiciones sin plantillas**: En la BD actual **ninguna transición tiene `template_key` configurado**. Los correos se envían manualmente desde el CRM o invocando directamente la edge function `send_email`.
- **Estatus activos**: 10 en total. Ver tabla en sección Esquema de BD. No existen `interview_scheduled`, `interview_done_pass`, `interview_done_fail`.
- **Documento de aplicación activo**: Único `stage='application'` activo es `solicitud_empleo`.

---

## Ciclo de Vida de la Postulación

El pipeline tiene 10 estatus activos. La matriz de transiciones es permisiva. El flujo de negocio intencionado es:

```
new  →  validation  →  virtual_scheduled  →  virtual_done
                                                  ↓
                                          documents_pending
                                                  ↓
                                          documents_complete
                                                  ↓
                                     onboarding_scheduled / onboarding
                                                  ↓
                                               hired

Cualquier estatus  →  rejected
```

> Los `template_key` en `recruit_status_transitions` pueden configurarse para envío automático de correo al cambiar estatus. Si están en null, los correos se envían manualmente desde el CRM.

### Sistema de Semáforo (traffic_light)

Asignado manualmente por los reclutadores en cada postulación:
- **green** — en buen camino
- **yellow** — requiere atención
- **red** — crítico / acción urgente requerida

### Auto-Asignación

Existen **dos** mecanismos que actúan en la misma postulación:

1. **Edge function `submit_application`**: Cuenta postulaciones activas no terminales por reclutador, asigna al de menor carga (desempate aleatorio). Se ejecuta con service role antes del INSERT.

2. **Trigger de BD `trigger_auto_assign_recruiter`** (BEFORE INSERT en `recruit_applications`): Solo asigna si `assigned_to IS NULL`. Round-robin entre `rh_recruiter` excluyendo estatus `rejected` y `hired`.

---

## Dependencias del Frontend

| Paquete | Versión | Propósito |
|---|---|---|
| `react` / `react-dom` | ^19.2.0 | Framework UI |
| `react-router-dom` | ^7.13.1 | Enrutamiento del lado del cliente |
| `react-hook-form` | ^7.71.2 | Gestión del estado del formulario |
| `@hookform/resolvers` | ^5.2.2 | Integración de Zod con RHF |
| `zod` | ^4.3.6 | Validación de esquemas |
| `@supabase/supabase-js` | ^2.98.0 | Cliente de Supabase |
| `@fullcalendar/react` | ^6.1.20 | Calendario de entrevistas (+ daygrid, timegrid, interaction) |
| `react-calendar` | ^6.0.0 | Selector de slots en el flujo de postulación |
| `lucide-react` | ^0.577.0 | Íconos |
| `date-fns` | ^4.1.0 | Utilidades de fechas |
| `html2canvas` + `jspdf` | latest | Generación de PDF en el flujo de postulación |
| `react-quill-new` | ^3.8.3 | Editor de texto enriquecido (plantillas de correo en CrmAdmin) |

---

## Pruebas

Los archivos de prueba reflejan la estructura del código fuente:
- `web/src/app/AuthProvider.test.tsx`
- `web/src/components/RequireAuth.test.tsx`
- `web/src/app/routes/CrmDashboard.test.tsx`
- `web/src/app/routes/CrmApplicationDetail.test.tsx`
- `web/src/app/routes/CrmInterviews.test.tsx`
- `web/src/app/routes/Login.test.tsx`
- `web/src/features/apply/ApplyFlow.test.tsx`
- `web/src/lib/resolveFunctionsBaseUrl.test.ts`
- `supabase/functions/_shared/templating.test.ts`
- `supabase/functions/_shared/validation.test.ts`

Mock: `web/src/test/supabaseMock.ts` — cliente Supabase simulado.
Setup: `web/src/test/setup.ts`.
Runner: Vitest con entorno jsdom, globals habilitados.

Ejecutar antes de cualquier cambio: `cd web && npm run test`

---

## Estándares de Calidad

Prioridad de decisiones: **Correctitud → Lógica de negocio → Seguridad → UX → Mantenibilidad → Escalabilidad → Rendimiento → Elegancia arquitectónica**

- Leer y entender el código existente antes de modificarlo — otros flujos pueden depender de él
- Todo cambio de estatus relevante DEBE pasar por la edge function `change_status`, nunca una actualización directa a la BD
- Los flujos de UX deben manejar: cargando, vacío, éxito, error, validación y estados deshabilitados
- Las pruebas protegen el comportamiento; ejecutar `vitest run` antes de dar una tarea por terminada
- No eludir RLS usando el cliente de service role desde el código del frontend
- Los consentimientos de privacidad y las firmas digitales siempre deben registrarse en cada envío de postulación
- Los cambios de estatus de validación de documentos deben preservar el historial de auditoría (usar timestamp `validated_at`)
