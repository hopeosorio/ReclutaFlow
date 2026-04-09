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
# Aplicar el esquema completo desde cero (fuente autoritativa)
psql $DATABASE_URL -f database/schema_clean_v2.sql

# Cargar datos semilla (estatus, catálogo de documentos, transiciones, aviso de privacidad)
psql $DATABASE_URL -f database/seed_clean.sql
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

Todas son manejadores Deno TypeScript independientes. Utilidades compartidas en `_shared/`.

### Utilidades `_shared/`

| Archivo | Exporta |
|---|---|
| `cors.ts` | `corsHeaders`, `jsonResponse()`, `errorResponse()` |
| `supabase.ts` | `getAdminClient()` (service role), `getUserClient(req)` (con scope de usuario vía JWT) |
| `validation.ts` | `requireFields()`, `isNonEmptyString()`, `asString()` |
| `templating.ts` | `renderTemplate()` — reemplaza placeholders `{variable}` en strings |

### Edge Functions

#### `submit_application` — Pública, sin autenticación

Crea la postulación completa de forma atómica.

**Campos requeridos:** `job_posting_id`, `person.first_name`, `person.last_name`, `consent.accepted = true`

**Flujo:**
1. Valida que la vacante esté activa
2. Inserta en `recruit_persons`
3. Inserta en `recruit_candidates`
4. **Auto-asigna reclutador** vía round-robin: cuenta postulaciones activas (no terminales) por reclutador, elige el de menor carga (desempate aleatorio)
5. Inserta en `recruit_applications` con `status_key = 'new'`
6. Registra `recruit_privacy_consents` (acepta `privacy_notice_id`)
7. Guarda firma: si se provee `signature_base64` → sube directamente a Storage; si `create_signed_upload_urls = true` → devuelve URL firmada para subida
8. Inserta `recruit_screening_answers`
9. Crea registros en `recruit_application_documents` + devuelve URLs firmadas de subida por cada documento

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

---

#### `change_status` — Requiere autenticación

Actualiza el estatus de la postulación a través del pipeline validado.

**Payload:** `{ application_id, status_key, reason?, note?, email_variables? }`

**Flujo:**
1. Valida JWT del usuario
2. Obtiene el `status_key` actual (para detectar la transición)
3. Llama al RPC `recruit_change_status(p_application_id, p_status_key, p_reason, p_note)` — valida transición, obliga reason si se requiere, actualiza postulación, registra historial, opcionalmente inserta nota
4. Inserta en `recruit_event_logs` con `event_key = 'status_changed'` y metadatos de la transición
5. Consulta `recruit_status_transitions` por `template_key`
6. Si existe plantilla → invoca la función `send_email`

**Respuesta:** `{ ok: true, email: { ok, error?, template_key } }`

---

#### `schedule_interview` — Requiere autenticación

Agenda una entrevista y genera un enlace Jitsi Meet.

**Payload:** `{ application_id, scheduled_at, interviewer_id }`

**Flujo:**
1. Valida JWT del usuario (extrae token del header `Authorization`)
2. Obtiene la postulación con datos del candidato y vacante
3. Genera enlace Jitsi Meet: `https://meet.jit.si/entrevista-{shortId}`
4. Intenta integración con Google Calendar (vía paquete npm `googleapis` — solo si están configuradas las credenciales)
5. Inserta en `recruit_interviews` con `interview_type = 'virtual'`
6. Actualiza `recruit_applications.meet_link` y `status_key = 'interview_scheduled'`
7. Inserta en `recruit_calendar_events`

**Respuesta:** `{ success: true, meet_link: "https://meet.jit.si/..." }`

---

#### `send_email` — Requiere autenticación

Renderiza una plantilla de correo y la encola para envío.

**Payload:** `{ application_id, template_key?, template_id?, to_address?, variables? }`

**Flujo:**
1. Valida acceso a la postulación
2. Carga la plantilla (por `template_key` o `template_id`)
3. Usa `to_address` o hace fallback al correo del candidato
4. Recopila contexto: título de vacante, sucursal, horario de entrevista, nombre del reclutador, meet_link
5. Renderiza la plantilla vía `renderTemplate()` (reemplaza placeholders `{variable}`)
6. Convierte Markdown → HTML
7. Envía vía SMTP (Gmail configurado vía secrets de env)
8. Actualiza `recruit_message_logs.status` a `'sent'` o `'failed'`

---

#### `get_application_preview` — Admin (service role)

Devuelve variables de plantilla pre-renderizadas para un `application_id` dado.

**Variables devueltas:** `name`, `job_title`, `job_branch`, `schedule_date`, `schedule_time`, `location`, `recruiter_name`, `interviewer_name`, `contact_email`, `datetime`, `application_id`

Usado por CrmAdmin para previsualizar plantillas de correo antes de enviar.

---

#### `get_crm_metrics` — Admin (service role)

Devuelve KPIs del sistema para la pestaña Métricas de CrmAdmin.

**Devuelve:**
```json
{
  "summary": { "total_applications": 0, "emails_sent": 0, "emails_failed": 0, "status_breakdown": [] },
  "recent_events": []
}
```

Hace fallback a agregación en memoria si no existe el RPC `get_status_counts`.

---

#### `remind_interviews` — Cron diario

Consulta entrevistas con `result = 'pending'` programadas para mañana y registra eventos `remind_24h_sent` en `recruit_event_logs`. No se llama desde el frontend.

**Cron job activo en BD:** `remind_interviews_daily` — schedule `0 8 * * *` (diario 8am UTC), implementado con `pg_cron` + `pg_net`. Para administrarlo: **Dashboard de Supabase → Integrations → Cron Jobs**.

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

Todas se resuelven automáticamente; también se pueden sobreescribir en el payload:

| Variable | Origen |
|---|---|
| `{name}` / `{candidate_name}` | Nombre completo del candidato |
| `{job_title}` | Título de la vacante |
| `{job_branch}` | Sucursal de la vacante |
| `{schedule_date}` / `{interview_date}` | Fecha de la entrevista (formato es-MX, zona México) |
| `{schedule_time}` / `{interview_time}` | Hora de la entrevista |
| `{datetime}` | Fecha + hora combinadas |
| `{location}` | Ubicación (onboarding si aplica, si no entrevista) |
| `{recruiter_name}` | Nombre del reclutador asignado |
| `{interviewer_name}` | Nombre del entrevistador |
| `{meet_link}` | Enlace Jitsi Meet como markdown `[UNIRSE AHORA](url)` |
| `{onboarding_date}` | Fecha del onboarding |
| `{onboarding_time}` | Hora del onboarding |
| `{dress_code}` | Código de vestimenta del onboarding |
| `{host_name}` | Anfitrión del onboarding (fallback: reclutador) |
| `{coupon_code}` | Código de cupón (vacío por defecto) |
| `{contact_phone}` / `{contact_email}` | Vacíos por defecto, sobreescribibles en payload |
| `{application_id}` | UUID de la postulación |
| `{track_url}` | URL de seguimiento `{FRONTEND_URL}/track?id={application_id}` |

---

## Esquema de Base de Datos

> **La BD viva en Supabase (PostgreSQL 17.6, us-east-1) es la fuente de verdad**, no los archivos SQL del repo. `schema_clean_v2.sql` es la referencia más cercana, pero la BD ha evolucionado con migraciones manuales. Cuando haya discrepancia, la BD gana.

Convención de prefijos: `recruit_*` = módulo de reclutamiento, `core_*` = módulo de empleados (Fase 2).

### Funciones de Ayuda (security definer)

| Función | Retorna | Descripción |
|---|---|---|
| `set_updated_at()` | trigger | Auto-asigna `updated_at = now()` en UPDATE |
| `is_rh()` | boolean | El usuario tiene algún rol de RH |
| `is_rh_admin()` | boolean | El usuario tiene rol `rh_admin` |
| `is_rh_recruiter()` | boolean | El usuario tiene rol `rh_recruiter` |
| `is_interviewer()` | boolean | El usuario tiene rol `interviewer` |
| `is_interviewer_for_application(app_id)` | boolean | El usuario es entrevistador en esa postulación |
| `can_access_application(app_id)` | boolean | admin O reclutador asignado O entrevistador en ella |
| `can_access_candidate(candidate_id)` | boolean | Puede acceder a alguna postulación de ese candidato |
| `can_access_person(person_id)` | boolean | Puede acceder a algún candidato de esa persona |
| `recruit_change_status(p_application_id, p_status_key, p_reason, p_note)` | void | Cambio de estatus autorizado + inserción de nota opcional |

### Tablas

> Columnas verificadas directamente desde la BD viva en Supabase. El estado real puede diferir de `schema_clean_v2.sql` por migraciones aplicadas manualmente.

#### Perfiles y Roles

**`profiles`** — Personal de RH (vinculado 1:1 con `auth.users`)
```
id uuid PK → auth.users
role text CHECK ('rh_admin','rh_recruiter','interviewer')
full_name text
created_at, updated_at timestamptz
```
Usuarios actuales en BD: 1× rh_admin, 2× rh_recruiter.

#### Vacantes

**`recruit_job_postings`** — Vacantes publicadas
```
id uuid PK
title, branch, area, employment_type, description_short text
status text CHECK ('active','paused','closed') DEFAULT 'active'
created_by uuid → profiles
created_at, updated_at timestamptz
```
RLS: SELECT público para `status = 'active'`; RH acceso completo.

**`recruit_job_profiles`** — Detalle extendido de la vacante (1:1 con vacante)
```
id uuid PK
job_posting_id uuid → recruit_job_postings (UNIQUE, cascade delete)
requirements, min_education, skills, experience text
role_summary, responsibilities, qualifications, benefits text
schedule, salary_range, location_details, growth_plan text
internal_notes text
created_at, updated_at timestamptz
```

#### Catálogo de Estatus

**`recruit_statuses`** — Etapas del pipeline
```
status_key text PK
label text
sort_order int
category text  -- 'pipeline' | 'interview' | 'outcome'
requires_reason boolean DEFAULT false
is_active boolean DEFAULT true
created_at, updated_at timestamptz
```

**Estado real en BD (13 estatus, verificado vía API):**

| status_key | label | sort_order | category | requires_reason |
|---|---|---|---|---|
| `new` | NUEVO POSTULANTE | 10 | pipeline | false |
| `validation` | VALIDACIÓN INICIAL | 20 | pipeline | false |
| `virtual_scheduled` | REUNIÓN VIRTUAL | 25 | **interview** | false |
| `interview_scheduled` | ENTREVISTA AGENDADA | 30 | pipeline | false |
| `virtual_done` | ENTREVISTA APROBADA | 31 | pipeline | false |
| `onboarding` | EN PROCESO DE INGRESO | 40 | outcome | false |
| `documents_pending` | SOLICITUD DE DOCUMENTOS | 40 | pipeline | false |
| `documents_complete` | EXPEDIENTE COMPLETO | 50 | pipeline | false |
| `onboarding_scheduled` | Onboarding programado | 60 | pipeline | false |
| `interview_done_pass` | Entrevista aprobada | 60 | outcome | false |
| `hired` | CONTRATADO | 70 | outcome | false |
| `interview_done_fail` | DESCARTADO TRAS ENTREVISTA | 80 | outcome | **true** |
| `rejected` | CARTERA (RECHAZADO) | 90 | outcome | false |

> `seed_clean.sql` contiene 10 estatus con labels diferentes — la BD real ha evolucionado con migraciones manuales. La BD en vivo es la fuente de verdad.

**`recruit_status_transitions`** — PK: `(from_status_key, to_status_key)`
```
from_status_key text → recruit_statuses
to_status_key text → recruit_statuses
template_key text → recruit_message_templates (nullable, FK on delete set null)
is_active boolean DEFAULT true
created_at timestamptz
```

**Estado real en BD:** 156 transiciones activas, todas con `template_key = null`. La matriz de transiciones es permisiva — prácticamente cualquier estatus puede transicionar a cualquier otro. Los triggers de BD (`recruit_enforce_status_change`) sí validan que la transición exista en esta tabla antes de permitirla.

#### Personas y Candidatos

**`recruit_persons`** — Datos personales del candidato
```
id uuid PK
first_name, last_name text NOT NULL
phone, email text
address_line1, address_line2, neighborhood, city, state, postal_code text
created_at, updated_at timestamptz
```

**`recruit_candidates`** — Perfil del candidato (1:1 con persona)
```
id uuid PK
person_id uuid UNIQUE → recruit_persons (cascade delete)
education_level text
has_education_certificate boolean
created_at, updated_at timestamptz
```

**`recruit_applications`** — Postulaciones
```
id uuid PK
job_posting_id uuid → recruit_job_postings
candidate_id uuid → recruit_candidates
UNIQUE (job_posting_id, candidate_id)
status_key text → recruit_statuses
status_reason text
traffic_light text CHECK ('red','yellow','green')
assigned_to uuid → profiles
submitted_at, created_at, updated_at timestamptz
suggested_slot_1 timestamptz   -- horario preferido 1
suggested_slot_2 timestamptz   -- horario preferido 2 (columna confirmada en BD real)
suggested_slot_3 timestamptz   -- horario preferido 3 (columna confirmada en BD real)
meet_link text
hired_employee_id uuid → core_employees
```
Índices: `idx_recruit_applications_job`, `idx_recruit_applications_status`

Triggers:
- `trg_recruit_applications_updated_at` — auto updated_at
- `trg_recruit_applications_status_log_insert` / `_update` — registra cambios de estatus en el historial
- `trg_recruit_applications_status_guard` — valida transición permitida + reason requerida antes del cambio
- `trg_recruit_applications_immutable` — no-admin no puede cambiar `job_posting_id`, `candidate_id`, `assigned_to`, `hired_employee_id`, `submitted_at`, `created_at`

RLS: Admin ve todo; reclutador ve solo las asignadas; entrevistador ve las suyas.

**`recruit_application_status_history`** — Historial de cambios de estatus
```
id uuid PK
application_id uuid → recruit_applications (cascade delete)
status_key text → recruit_statuses
reason, notes text
changed_by uuid → profiles
changed_at timestamptz
```

**`recruit_notes`** — Notas internas por postulación
```
id uuid PK
application_id uuid → recruit_applications (cascade delete)
note text NOT NULL
created_by uuid → profiles
created_at timestamptz
```

#### Privacidad y Firmas

**`recruit_privacy_notices`** — Avisos de privacidad con versionado
```
id uuid PK
version text UNIQUE
content_md text
is_active boolean DEFAULT true
created_at timestamptz
```
RLS: SELECT público para `is_active = true`. BD actual: 1 aviso activo (`v1`).

**`recruit_privacy_consents`** — Consentimientos GDPR
```
id uuid PK
application_id uuid → recruit_applications (cascade delete)
privacy_notice_id uuid → recruit_privacy_notices
accepted boolean
accepted_at timestamptz
user_agent text
ip_address inet
```

**`recruit_digital_signatures`** — Firmas digitales
```
id uuid PK
application_id uuid → recruit_applications (cascade delete)
signer_name text
signature_storage_path text  -- ruta en el bucket recruit-docs
signature_json jsonb          -- datos crudos de la firma (alternativo)
signed_at timestamptz
```

#### Screening

**`recruit_screening_questions`** — Preguntas de filtro por vacante
```
id uuid PK
job_posting_id uuid → recruit_job_postings (cascade delete)
question_text text
question_type text CHECK ('text','boolean','single_choice','multi_choice','number')
options jsonb  -- arreglo de opciones para tipos choice
is_required boolean
created_at timestamptz
```
RLS: Lectura pública si la vacante está activa; escritura solo admin.

**`recruit_screening_answers`** — Respuestas de candidatos
```
id uuid PK
application_id uuid → recruit_applications (cascade delete)
question_id uuid → recruit_screening_questions (cascade delete)
UNIQUE (application_id, question_id)
answer_text text
answer_json jsonb
created_at timestamptz
```

#### Entrevistas

**`recruit_interviews`** — Entrevistas agendadas
```
id uuid PK
application_id uuid → recruit_applications (cascade delete)
interview_type text CHECK ('phone','in_person','virtual')
scheduled_at timestamptz
location text
interviewer_id uuid → profiles
result text CHECK ('pending','pass','fail','no_show','reschedule') DEFAULT 'pending'
notes text
created_at, updated_at timestamptz
```

Triggers: inmutabilidad (no-admin no puede cambiar `application_id`, `interview_type`, `created_at`; entrevistador no puede cambiar `scheduled_at`, `location`, `interviewer_id`).

RLS: Admin ve todo; reclutador ve entrevistas de postulaciones asignadas; entrevistador ve solo las suyas.

**`recruit_calendar_events`** — Eventos de calendario vinculados a entrevistas
```
id uuid PK
interview_id uuid → recruit_interviews (cascade delete)
provider text CHECK ('google_calendar','email_only') DEFAULT 'email_only'
event_id, event_link text
created_at timestamptz
```

#### Documentos

**`recruit_document_types`** — Catálogo de tipos de documento
```
id uuid PK
name text UNIQUE
label text
stage text CHECK ('application','post_interview','onboarding')
is_required boolean DEFAULT false
is_active boolean DEFAULT true
created_at timestamptz
```
RLS: Lectura pública solo para `stage = 'application'`; lectura completa para RH; escritura solo admin.

**Documentos activos en BD (verificado vía API):**

| name | label | stage | is_required |
|---|---|---|---|
| `solicitud_empleo` | SOLICITUD DE EMPLEO | application | **true** |
| `acta_nacimiento` | Acta de Nacimiento (Mayor de 18 años) | onboarding | true |
| `curp` | CURP (Fecha de impresión reciente) | onboarding | true |
| `rfc` | RFC (En caso de contar con él) | onboarding | false |
| `ine` | INE (Identificación Oficial) | onboarding | true |
| `comprobante_domicilio` | Comprobante de domicilio | onboarding | true |
| `constancia_estudios` | Constancia de estudios | onboarding | true |
| `cartas_recomendacion` | 2 Cartas de Recomendación | onboarding | true |
| `examen_medico` | Examen médico | onboarding | true |
| `tipo_sangre` | Comprobante de Tipo de Sangre | onboarding | true |

> `seed_clean.sql` referenciaba `cv_solicitud` — en la BD real es `solicitud_empleo`. Existen 8 tipos inactivos adicionales: `cv`, `nss`, `alta_imss`, `clabe_interbancaria`, `contrato_firmado`, `comprobante_estudios`, `identificacion_oficial`, `comprobante_estudios_onboarding`.

**`recruit_application_documents`** — Documentos subidos por el candidato
```
id uuid PK
application_id uuid → recruit_applications (cascade delete)
document_type_id uuid → recruit_document_types
storage_path text NOT NULL  -- ruta en el bucket recruit-docs
validation_status text CHECK ('pending','under_review','validated','rejected') DEFAULT 'pending'
validation_notes text
uploaded_at timestamptz
validated_at timestamptz
```
Trigger: inmutabilidad en `application_id`, `document_type_id`, `storage_path`, `uploaded_at` para no-admin.

#### Mensajería

**`recruit_message_templates`** — Plantillas de correo electrónico
```
id uuid PK
template_key text UNIQUE
subject text
body_md text  -- Cuerpo en Markdown con placeholders {variable}
is_active boolean DEFAULT true
created_at timestamptz
```
RLS: Lectura para RH; escritura solo admin.

**Plantillas activas en BD (11, verificado vía API):**

| template_key | Asunto |
|---|---|
| `documents_request` | Acción requerida: Carga de Documentación de Ingreso |
| `fail_after_interview_with_coupon` | Gracias por asistir |
| `interview_invitation` | ¡Felicidades! Invitación a Entrevista |
| `interview_passed_docs` | ¡Felicidades! Próximos pasos para tu contratación |
| `new_assignment_recruiter` | Nueva postulación asignada |
| `onboarding_details` | ¡Bienvenido al Equipo! - Siguientes Pasos para {job_title} |
| `reject_after_call` | Actualización sobre tu postulación para {job_title} |
| `rejected` | Actualización de tu proceso - ReclutaFlow |
| `schedule_interview` | Citación: Entrevista Virtual para {job_title} |
| `welcome_candidate` | Confirmamos tu postulación para {job_title} |
| `welcome_onboarding` | ¡Bienvenido al Equipo! Inicio de Onboarding |

**`recruit_message_logs`** — Cola de correos electrónicos
```
id uuid PK
application_id uuid → recruit_applications (cascade delete)
template_id uuid → recruit_message_templates
channel text CHECK ('email','calendar','other') DEFAULT 'email'
to_address text
status text CHECK ('queued','sent','failed') DEFAULT 'queued'
provider_message_id text
error text
sent_at timestamptz
created_at timestamptz
```
**Webhook `process_new_email_log`** (AFTER INSERT): configurado como **Supabase Database Webhook** (administrable en Dashboard → Integrations → Webhooks). Bajo el hood se implementa como un trigger PostgreSQL que llama a `supabase_functions.http_request()` → `pg_net` → edge function `send_email`. **El envío es 100% asíncrono dentro de Supabase — no existe ningún proceso externo.**

**`recruit_template_variables`** — Catálogo de variables disponibles para plantillas
```
variable_key text PK
label, description, example_value text
is_active boolean DEFAULT true
sort_order int
created_at timestamptz
```

**Variables reales en BD (14, verificado vía API):**
`name`, `job_title`, `job_branch`, `schedule_date`, `schedule_time`, `location`, `recruiter_name`, `interviewer_name`, `coupon_code`, `onboarding_date`, `onboarding_time`, `dress_code`, `contact_phone`, `contact_email`

**`recruit_event_logs`** — Auditoría completa de eventos del sistema
```
id uuid PK
event_key text  -- p. ej. 'status_changed'
entity_type text  -- p. ej. 'application'
entity_id uuid
application_id uuid → recruit_applications (on delete set null)
template_id uuid → recruit_message_templates
metadata jsonb DEFAULT '{}'
created_by uuid → profiles
created_at timestamptz
```

#### Otros

**`recruit_rehire_flags`** — Semáforo de elegibilidad de recontratación por persona
```
id uuid PK
person_id uuid → recruit_persons (cascade delete)
color text CHECK ('red','yellow','green')
reason text NOT NULL
set_by uuid → profiles
set_at timestamptz
```

**`recruit_onboarding_plans`** — Planes de onboarding por postulación (tabla vacía actualmente, confirmada en BD)
```
id uuid PK
application_id uuid → recruit_applications (UNIQUE — 1:1 con postulación)
scheduled_at timestamptz
location text
dress_code text
host_name text
notes text
created_by uuid → profiles
created_at, updated_at timestamptz
```
Usada por `send_email` para resolver variables `{onboarding_date}`, `{onboarding_time}`, `{dress_code}`, `{host_name}`.

**`core_employees`** — Empleados contratados (Fase 2, tabla vacía actualmente)
```
id uuid PK
first_name, last_name text
phone_mobile, email_work text
position, branch text
hire_date date
status text CHECK ('active','inactive') DEFAULT 'active'
created_at, updated_at timestamptz
```
Referenciada por `recruit_applications.hired_employee_id`.

### Funciones RPC Públicas

| Función | Propósito |
|---|---|
| `get_occupied_slots()` | Devuelve slots de entrevista ocupados (usado por `SlotCalendarV2`). Confirmado en BD. |
| `recruit_change_status(p_application_id, p_status_key, p_reason, p_note)` | Cambio autorizado de estatus + inserción de nota opcional |

### Archivos SQL Adicionales

| Archivo | Propósito |
|---|---|
| `database/schema_clean_v2.sql` | Referencia más cercana al esquema real — DDL + triggers + RLS. La BD viva puede diferir |
| `database/seed_clean.sql` | Semilla: estatus, catálogo de documentos, transiciones (usar después del esquema) |
| `database/patches/auto_assign_recruiter.sql` | Trigger de auto-asignación (puede solaparse con la lógica de la edge function) |
| `database/patches/auto_create_profile.sql` | Crea fila en `profiles` al insertar en `auth.users` |
| `database/patches/public_submission_policies.sql` | RLS adicional para la postulación pública |
| `database/patches/public_get_occupied_slots.sql` | RPC/vista para slots de entrevista ocupados |
| `database/patches/storage_policies.sql` | Políticas RLS del bucket de storage |
| `database/tests/rls_smoke.sql` | Verificaciones manuales de RLS |

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
- **Estatus reales vs seed**: La BD tiene 13 estatus activos incluyendo `virtual_scheduled`, `virtual_done` y `onboarding`, que no están en `seed_clean.sql`. Siempre consultar la BD para el catálogo actual.
- **Documento de aplicación activo**: El único tipo de documento `stage='application'` activo en BD es `solicitud_empleo` (no `cv_solicitud` como aparece en `seed_clean.sql`).

---

## Ciclo de Vida de la Postulación

El pipeline real en BD es permisivo — las 156 transiciones cubren prácticamente todas las combinaciones posibles entre los 13 estatus. El flujo de negocio intencionado (según el código y las plantillas) es:

```
new (candidato envía solicitud)
  ↓ reclutador revisa
validation
  ↓ se agenda reunión virtual o entrevista presencial
virtual_scheduled  (REUNIÓN VIRTUAL — videollamada)
  ↓ resultado positivo
virtual_done  →  documents_pending
                   ↓ documentos validados
                   documents_complete
                     ↓
                     onboarding / onboarding_scheduled
                       ↓
                       hired ✅

interview_scheduled  (ENTREVISTA PRESENCIAL)
  ↓
interview_done_pass → documents_pending → documents_complete → hired ✅
interview_done_fail → rejected
```

> Los `template_key` en `recruit_status_transitions` están todos en null en la BD actual. Los correos se disparan manualmente desde el CRM o invocando la edge function `send_email` directamente — no de forma automática al cambiar de estatus.

### Sistema de Semáforo (traffic_light)

Asignado manualmente por los reclutadores en cada postulación:
- **green** — en buen camino
- **yellow** — requiere atención
- **red** — crítico / acción urgente requerida

### Auto-Asignación

Existen **dos** mecanismos de auto-asignación que pueden solaparse:

1. **Edge function `submit_application`**: Consulta todos los perfiles `rh_recruiter`, cuenta postulaciones activas no terminales, asigna al de menor carga (desempate aleatorio). Se ejecuta atómicamente con el INSERT usando service role.

2. **Trigger de BD `fn_auto_assign_recruiter`** (BEFORE INSERT en `recruit_applications`): Asigna el reclutador disponible (acepta tanto `rh_recruiter` como `rh_admin`) y adicionalmente **auto-avanza el estatus de `new` a `validation`** en el mismo INSERT. Puede solaparse con la lógica de la edge function.

3. **Trigger de BD `auto_assign_recruiter`** (BEFORE INSERT en `recruit_applications`): Variante anterior, solo asigna `rh_recruiter`. Puede coexistir con `fn_auto_assign_recruiter` — **revisar si ambos están activos** para evitar conflictos.

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
