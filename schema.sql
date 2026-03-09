-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.core_employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  phone_mobile text,
  email_work text,
  position text,
  branch text,
  hire_date date,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT core_employees_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['rh_admin'::text, 'rh_recruiter'::text, 'interviewer'::text])),
  full_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.recruit_application_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  document_type_id uuid NOT NULL,
  storage_path text NOT NULL,
  validation_status text NOT NULL DEFAULT 'pending'::text CHECK (validation_status = ANY (ARRAY['pending'::text, 'under_review'::text, 'validated'::text, 'rejected'::text])),
  validation_notes text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  validated_at timestamp with time zone,
  CONSTRAINT recruit_application_documents_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_application_documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id),
  CONSTRAINT recruit_application_documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.recruit_document_types(id)
);
CREATE TABLE public.recruit_application_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  status_key text NOT NULL,
  reason text,
  notes text,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_application_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_application_status_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id),
  CONSTRAINT recruit_application_status_history_status_key_fkey FOREIGN KEY (status_key) REFERENCES public.recruit_statuses(status_key),
  CONSTRAINT recruit_application_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.recruit_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  status_key text NOT NULL,
  status_reason text,
  traffic_light text CHECK (traffic_light = ANY (ARRAY['red'::text, 'yellow'::text, 'green'::text])),
  assigned_to uuid,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  hired_employee_id uuid,
  suggested_slot_1 timestamp with time zone,
  suggested_slot_2 timestamp with time zone,
  suggested_slot_3 timestamp with time zone,
  meet_link text,
  CONSTRAINT recruit_applications_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_applications_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.recruit_job_postings(id),
  CONSTRAINT recruit_applications_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.recruit_candidates(id),
  CONSTRAINT recruit_applications_status_key_fkey FOREIGN KEY (status_key) REFERENCES public.recruit_statuses(status_key),
  CONSTRAINT recruit_applications_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id),
  CONSTRAINT recruit_applications_hired_employee_id_fkey FOREIGN KEY (hired_employee_id) REFERENCES public.core_employees(id)
);
CREATE TABLE public.recruit_calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'email_only'::text CHECK (provider = ANY (ARRAY['google_calendar'::text, 'email_only'::text])),
  event_id text,
  event_link text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_calendar_events_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_calendar_events_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.recruit_interviews(id)
);
CREATE TABLE public.recruit_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE,
  education_level text,
  has_education_certificate boolean,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_candidates_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_candidates_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.recruit_persons(id)
);
CREATE TABLE public.recruit_digital_signatures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  signer_name text NOT NULL,
  signature_storage_path text,
  signature_json jsonb,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_digital_signatures_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_digital_signatures_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id)
);
CREATE TABLE public.recruit_document_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  stage text NOT NULL CHECK (stage = ANY (ARRAY['application'::text, 'post_interview'::text, 'onboarding'::text])),
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_document_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.recruit_event_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  application_id uuid,
  template_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_event_logs_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_event_logs_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id),
  CONSTRAINT recruit_event_logs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.recruit_message_templates(id),
  CONSTRAINT recruit_event_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.recruit_interviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  interview_type text NOT NULL CHECK (interview_type = ANY (ARRAY['phone'::text, 'in_person'::text, 'virtual'::text])),
  scheduled_at timestamp with time zone,
  location text,
  interviewer_id uuid,
  result text NOT NULL DEFAULT 'pending'::text CHECK (result = ANY (ARRAY['pending'::text, 'pass'::text, 'fail'::text, 'no_show'::text, 'reschedule'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_interviews_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_interviews_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id),
  CONSTRAINT recruit_interviews_interviewer_id_fkey FOREIGN KEY (interviewer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.recruit_job_postings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  branch text,
  area text,
  employment_type text,
  description_short text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'closed'::text])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_job_postings_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_job_postings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.recruit_job_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL UNIQUE,
  requirements text,
  min_education text,
  skills text,
  experience text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  role_summary text,
  responsibilities text,
  qualifications text,
  benefits text,
  schedule text,
  salary_range text,
  location_details text,
  growth_plan text,
  internal_notes text,
  CONSTRAINT recruit_job_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_job_profiles_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.recruit_job_postings(id)
);
CREATE TABLE public.recruit_message_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  template_id uuid,
  channel text NOT NULL DEFAULT 'email'::text CHECK (channel = ANY (ARRAY['email'::text, 'calendar'::text, 'other'::text])),
  to_address text,
  status text NOT NULL DEFAULT 'queued'::text CHECK (status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text])),
  provider_message_id text,
  error text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_message_logs_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_message_logs_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id),
  CONSTRAINT recruit_message_logs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.recruit_message_templates(id)
);
CREATE TABLE public.recruit_message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  subject text NOT NULL,
  body_md text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_message_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.recruit_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  note text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_notes_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_notes_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id),
  CONSTRAINT recruit_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.recruit_onboarding_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE,
  scheduled_at timestamp with time zone,
  location text,
  dress_code text,
  host_name text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_onboarding_plans_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_onboarding_plans_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id),
  CONSTRAINT recruit_onboarding_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.recruit_persons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_persons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.recruit_privacy_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  privacy_notice_id uuid NOT NULL,
  accepted boolean NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  user_agent text,
  ip_address inet,
  CONSTRAINT recruit_privacy_consents_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_privacy_consents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id),
  CONSTRAINT recruit_privacy_consents_privacy_notice_id_fkey FOREIGN KEY (privacy_notice_id) REFERENCES public.recruit_privacy_notices(id)
);
CREATE TABLE public.recruit_privacy_notices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  content_md text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_privacy_notices_pkey PRIMARY KEY (id)
);
CREATE TABLE public.recruit_rehire_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  color text NOT NULL CHECK (color = ANY (ARRAY['red'::text, 'yellow'::text, 'green'::text])),
  reason text NOT NULL,
  set_by uuid,
  set_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_rehire_flags_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_rehire_flags_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.recruit_persons(id),
  CONSTRAINT recruit_rehire_flags_set_by_fkey FOREIGN KEY (set_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.recruit_screening_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer_text text,
  answer_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_screening_answers_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_screening_answers_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.recruit_applications(id),
  CONSTRAINT recruit_screening_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.recruit_screening_questions(id)
);
CREATE TABLE public.recruit_screening_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type = ANY (ARRAY['text'::text, 'boolean'::text, 'single_choice'::text, 'multi_choice'::text, 'number'::text])),
  options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_screening_questions_pkey PRIMARY KEY (id),
  CONSTRAINT recruit_screening_questions_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES public.recruit_job_postings(id)
);
CREATE TABLE public.recruit_status_transitions (
  from_status_key text NOT NULL,
  to_status_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  template_key text,
  CONSTRAINT recruit_status_transitions_pkey PRIMARY KEY (from_status_key, to_status_key),
  CONSTRAINT recruit_status_transitions_to_status_key_fkey FOREIGN KEY (to_status_key) REFERENCES public.recruit_statuses(status_key),
  CONSTRAINT recruit_status_transitions_from_status_key_fkey FOREIGN KEY (from_status_key) REFERENCES public.recruit_statuses(status_key),
  CONSTRAINT recruit_status_transitions_template_fk FOREIGN KEY (template_key) REFERENCES public.recruit_message_templates(template_key)
);
CREATE TABLE public.recruit_statuses (
  status_key text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  category text,
  requires_reason boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_statuses_pkey PRIMARY KEY (status_key)
);
CREATE TABLE public.recruit_template_variables (
  variable_key text NOT NULL,
  label text NOT NULL,
  description text,
  example_value text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruit_template_variables_pkey PRIMARY KEY (variable_key)
);