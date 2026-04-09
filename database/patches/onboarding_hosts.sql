-- ============================================================
-- PATCH: Anfitriones de Onboarding
-- Corre este script en Supabase SQL Editor una sola vez.
-- ============================================================

-- 0. Quitar template automático de la transición → onboarding_scheduled
--    El correo al candidato lo enviamos explícitamente desde el frontend
--    con onboarding_details, que sí tiene fecha/hora/lugar/vestimenta.
UPDATE recruit_status_transitions
  SET template_key = NULL
  WHERE to_status_key = 'onboarding_scheduled';

-- 1. Nueva tabla de anfitriones
CREATE TABLE IF NOT EXISTS recruit_onboarding_hosts (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email     text NOT NULL,
  phone     text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recruit_onboarding_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_read_hosts"
  ON recruit_onboarding_hosts FOR SELECT
  TO authenticated USING (is_rh());

CREATE POLICY "admin_manage_hosts"
  ON recruit_onboarding_hosts FOR ALL
  TO authenticated USING (is_rh_admin()) WITH CHECK (is_rh_admin());

-- 2. Agregar host_id a recruit_onboarding_plans
ALTER TABLE recruit_onboarding_plans
  ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES recruit_onboarding_hosts(id) ON DELETE SET NULL;

-- 3. Plantilla de correo para el anfitrión
INSERT INTO recruit_message_templates (template_key, subject, body_md, is_active)
VALUES (
  'onboarding_host_notification',
  'Notificación de Onboarding — {name} ingresa el {onboarding_date}',
  E'Hola **{host_name}**,\n\nTe informamos que eres el responsable de recibir a **{name}** quien inicia su proceso de onboarding.\n\n**Detalles del ingreso:**\n- 📅 Fecha: {onboarding_date}\n- 🕐 Hora: {onboarding_time}\n- 📍 Lugar: {location}\n- 👔 Vestimenta: {dress_code}\n- 💼 Vacante: {job_title} — {job_branch}\n\n**Notas adicionales:**\n{notes_text}\n\nSi tienes alguna duda, comunícate con el área de RH.\n\n— Sistema ReclutaFlow',
  true
)
ON CONFLICT (template_key) DO NOTHING;
