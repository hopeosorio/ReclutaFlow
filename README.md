# ReclutaFlow

Sistema de gestión de reclutamiento y contratación (ATS) de nivel empresarial. Cubre el ciclo completo del candidato: postulación pública, gestión del pipeline de RH, agendado de entrevistas y onboarding.

---

## Tecnologías

- **Frontend**: React 19 + TypeScript + Vite (SPA)
- **Backend**: Supabase (PostgreSQL + Edge Functions con Deno)
- **Correo**: Edge Function `send_email` via SMTP o SendGrid
- **Tiempo real**: Supabase Realtime
- **UI**: Glassmorphism personalizado con Lucide React

---

## Estructura del Proyecto

```
web/                        Frontend React (Vite)
supabase/functions/         Edge Functions (Deno)
database/                   Esquema SQL y seeds
scripts/                    Utilidades de despliegue
```

---

## Comandos

### Frontend

```bash
cd web
npm run dev          # Servidor de desarrollo (localhost:5173)
npm run build        # Build de producción
npm run lint         # ESLint
npm run test         # Pruebas con Vitest
npm run test:watch   # Pruebas en modo observación
```

### Edge Functions

```bash
supabase functions serve                  # Servir localmente
bash scripts/deploy_functions.sh          # Desplegar a Supabase
```

### Base de datos

```bash
psql $DATABASE_URL -f database/schema_clean_v2.sql   # Aplicar esquema
psql $DATABASE_URL -f database/seed_clean.sql         # Cargar datos semilla
```

---

## Rutas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | Público | Landing page |
| `/apply` | Público | Formulario de postulación (4 pasos) |
| `/track` | Público | Rastreador de estatus para candidatos |
| `/login` | Público | Autenticación del personal de RH |
| `/crm` | RH | Dashboard del pipeline |
| `/crm/interviews` | RH | Calendario y lista de entrevistas |
| `/crm/admin` | Admin | Configuración del sistema |
| `/crm/applications/:id` | RH | Detalle del candidato |

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
VITE_FUNCTIONS_BASE_URL=
VITE_STORAGE_BUCKET=recruit-docs
```

### `supabase/.env`

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EMAIL_SEND_MODE=smtp
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

```
new -> validation -> virtual_scheduled -> virtual_done
     -> documents_pending -> documents_complete
     -> onboarding_scheduled -> hired

new -> validation -> interview_scheduled
     -> interview_done_pass -> documents_pending -> hired
     -> interview_done_fail -> rejected
```

---

## Motor de Correo

El envío de correos ocurre completamente dentro de Supabase sin procesos externos:

```
Trigger BD -> recruit_message_logs -> pg_net -> Edge Function send_email -> SMTP / SendGrid
```

Modos disponibles via `EMAIL_SEND_MODE`: `smtp`, `sendgrid`, `log_only`.

---

## Base de Datos

La base de datos viva en Supabase (PostgreSQL 17.6, us-east-1) es la fuente de verdad. El archivo `database/schema_clean_v2.sql` es la referencia más cercana al esquema actual.

Convención de prefijos: `recruit_*` para el módulo de reclutamiento, `core_*` para el módulo de empleados (Fase 2).
