# ReclutaFlow

Sistema de gestión de reclutamiento y contratación (ATS) de nivel empresarial. Cubre el ciclo completo del candidato: postulación pública, gestión del pipeline de RH, agendado de entrevistas y onboarding.

---

## Tecnologías

- **Frontend**: React 19 + TypeScript + Vite (SPA)
- **Backend**: Supabase (PostgreSQL 17.6 + Edge Functions con Deno)
- **Correo**: Edge Function `send_email` (SMTP, SendGrid o log_only — sin daemon externo)
- **Tiempo real**: Supabase Realtime subscriptions
- **UI**: Glassmorphism personalizado con Lucide React

---

## Estructura del Proyecto

```
web/                        Frontend React (Vite)
supabase/functions/         Edge Functions (Deno)
database/                   Esquema SQL de referencia
```

---

## Comandos

### Frontend

```bash
cd web
npm run dev          # Servidor de desarrollo con HMR (localhost:5173)
npm run build        # Verificación de tipos + bundle de producción
npm run lint         # ESLint 9
npm run preview      # Vista previa del build local
npm run test         # Pruebas una vez (Vitest)
npm run test:watch   # Pruebas en modo observación
```

### Edge Functions

```bash
supabase functions serve   # Servir localmente

# Desplegar a Supabase (PROJECT_REF=lwjyxfflpxptdmgupgmj)
supabase functions deploy submit_application      --project-ref $PROJECT_REF --no-verify-jwt
supabase functions deploy change_status           --project-ref $PROJECT_REF --no-verify-jwt
supabase functions deploy send_email              --project-ref $PROJECT_REF --no-verify-jwt
supabase functions deploy schedule_interview      --project-ref $PROJECT_REF --no-verify-jwt
supabase functions deploy get_application_preview --project-ref $PROJECT_REF --no-verify-jwt
supabase functions deploy get_crm_metrics         --project-ref $PROJECT_REF --no-verify-jwt
supabase functions deploy remind_interviews       --project-ref $PROJECT_REF --no-verify-jwt
```

### Base de datos

```bash
# Solo referencia — la BD viva en Supabase es la fuente de verdad
# database/schema.sql
```

---

## Rutas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | Público | Landing page |
| `/apply` | Público | Formulario de postulación en 4 pasos |
| `/track` | Público | Rastreador de estatus para candidatos |
| `/login` | Público | Autenticación del personal de RH |
| `/crm` | RH | Dashboard del pipeline |
| `/crm/interviews` | RH | Calendario y lista de entrevistas |
| `/crm/admin` | Admin | Configuración del sistema |
| `/crm/applications/:id` | RH | Vista detallada del candidato |

---

## Roles

| Rol | Acceso |
|---|---|
| `rh_admin` | Acceso completo al sistema |
| `rh_recruiter` | Pipeline y candidatos asignados |
| `interviewer` | Solo entrevistas asignadas |

---

## Variables de Entorno

### `web/.env`

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FUNCTIONS_BASE_URL=   # Dejar vacío para auto-resolver
VITE_STORAGE_BUCKET=recruit-docs
```

### `supabase/.env`

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EMAIL_SEND_MODE=smtp          # smtp | sendgrid | log_only
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_SECURE=true
DEFAULT_TIMEZONE=America/Mexico_City
FRONTEND_URL=
```

---

## Pipeline de Candidatos

10 estatus activos. Flujo de negocio intencionado:

```
new → validation → virtual_scheduled → virtual_done
                                            ↓
                                    documents_pending
                                            ↓
                                    documents_complete
                                            ↓
                               onboarding_scheduled / onboarding
                                            ↓
                                          hired

Cualquier estatus → rejected
```

---

## Motor de Correo

Envío completamente dentro de Supabase, sin procesos externos:

```
Trigger BD → recruit_message_logs → pg_net → Edge Function send_email → SMTP / SendGrid
```

Modos disponibles vía `EMAIL_SEND_MODE`: `smtp`, `sendgrid`, `log_only`.

---

## Base de Datos

La BD viva en Supabase (PostgreSQL 17.6, us-east-1) es la fuente de verdad. `database/schema.sql` es referencia extraída el 2026-04-20 — no ejecutar en producción sin revisar.

Convención de prefijos: `recruit_*` = módulo de reclutamiento, `core_*` = módulo de empleados (Fase 2).
