export type ProfileRole = "rh_admin" | "rh_recruiter" | "interviewer";

export interface Profile {
  id: string;
  role: ProfileRole;
  full_name: string | null;
}
