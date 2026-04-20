import { ShieldCheck, FileText, User, Calendar as CalendarIcon } from "lucide-react";

export interface PrivacyNotice { 
  id: string; 
  content_md: string; 
}

export interface JobPosting { 
  id: string; 
  title: string; 
  branch: string | null; 
  area: string | null; 
  employment_type: string | null; 
  description_short: string | null; 
}

export interface JobProfile {
  role_summary: string | null;
  requirements: string | null;
  min_education: string | null;
  schedule: string | null;
  salary_range: string | null;
  location_details: string | null;
  skills: string | null;
  experience: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  benefits: string | null;
  growth_plan: string | null;
}

export interface ScreeningQuestion { 
  id: string; 
  question_text: string; 
  question_type: "text" | "boolean" | "single_choice" | "multi_choice" | "number"; 
  options: string[] | null; 
  is_required: boolean; 
}

export interface DocumentType { 
  id: string; 
  name: string; 
  stage: "application" | "post_interview" | "onboarding"; 
  is_required: boolean; 
}

export interface ApplyFormValues {
  consent: { accepted: boolean; };
  job_posting_id: string;
  person: { 
    first_name: string; 
    last_name: string; 
    email: string; 
    phone: string; 
    phone_optional?: string;
    birth_date: string;
    address_line1: string; 
    postal_code: string;
    colonia: string;
    city: string; 
    state: string; 
    marital_status: string;
  };
  application_details: {
    desired_salary: string;
    has_experience: boolean | string;
    years_experience: number;
    schedule_preference: "morning" | "afternoon" | "both" | "rotative" | "";
    can_rotate_shifts: boolean;
    fixed_commitment_bool: boolean | string;
    fixed_commitment: string;
    weekend_availability: boolean | string;
    previous_employee: boolean | string;
    previous_employee_reason?: string;
    agrees_with_salary: "yes" | "no" | "negotiable" | "";
    has_infonavit: boolean | string;
    salary_agreement: boolean | string;
    adjustments_required: boolean | string;
    start_date: string;
    health_adjustments: string;
    comments: string;
  };
  work_history: {
    company: string;
    position: string;
    period_from: string;
    period_to: string;
    manager: string;
    manager_position: string;
    phone: string;
    reason_for_leaving: string;
  }[];
  personal_references: {
    name: string;
    occupation: string;
    phone: string;
  }[];
  skills: {
    cashier?: boolean;
    drinks?: boolean;
    inventory?: boolean;
    cleaning?: boolean;
    others: string;
  };
  candidate: { 
    education_level: string; 
    has_education_certificate: string; 
  };
  screening_answers: Record<string, string | string[] | boolean | number>;
  signature_base64: string | null;
  signer_name: string;
  availability: { slot_1: string };
}

export const steps = [
  { id: "consent", label: "FASE 01", helper: "CONSENTIMIENTO", icon: ShieldCheck },
  { id: "vacancy", label: "FASE 02", helper: "SELECCIÓN", icon: FileText },
  { id: "identity", label: "FASE 03", helper: "IDENTIDAD", icon: User },
  { id: "availability", label: "FASE 04", helper: "ENCUENTRO", icon: CalendarIcon }
];
