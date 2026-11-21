// Types for leads, HR contacts, colleges, ambassador, learning, terms, alerts, branches and Enrich Silicon.
export type Company = "mastervlsi" | "enrich";
export type StudentCategory = "normal" | "college" | "corporate";
export type FeeAccount = "paka" | "kacha";
export type LeadStage = "lead" | "interested" | "visited" | "enrolled" | "lost";

export interface Branch { id: string; name: string; city?: string | null; domain?: string | null; company: Company }

export interface College {
  id: string; code?: string | null; name: string; city?: string | null; state?: string | null; affiliation?: string | null;
  college_type?: string | null; since?: string | null; status: "partner" | "prospect" | "inactive";
}
export interface TpoContact {
  id: string; college_id: string; name: string; designation?: string | null; phone?: string | null; alt_phone?: string | null;
  email?: string | null; is_primary: boolean; active: boolean; remarks?: string | null; next_follow_up?: string | null; last_interaction?: string | null;
}
export interface Mou {
  id: string; college_id: string; mou_no?: string | null; agreement_type: string; start_date?: string | null; end_date?: string | null;
  scope?: string | null; status: "draft" | "review" | "shared" | "active" | "expired"; document_url?: string | null;
}
export interface CampusDrive {
  id: string; college_id: string; company: string; job_role?: string | null; drive_date?: string | null; mode?: string | null;
  eligibility?: string | null; package?: string | null; registered: number; attended: number; shortlisted: number; selected: number;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
}

export interface Client { id: string; name: string; contact_person?: string | null; email?: string | null; phone?: string | null; gstin?: string | null; kind: "services" | "corporate_training" }
export interface Project { id: string; client_id?: string | null; name: string; status: "active" | "on_hold" | "completed"; start_date?: string | null; end_date?: string | null; hourly_rate?: number | null }
export interface Timesheet { id: string; project_id: string; staff_id: string; work_date: string; hours: number; note?: string | null }
export interface Invoice {
  id: string; invoice_no: string; company: Company; client_id?: string | null; issue_date: string; description?: string | null;
  amount: number; gst_pct: number; status: "unpaid" | "paid" | "cancelled"; paid_on?: string | null;
}

export interface Lead {
  id: string; lead_no?: string | null; full_name: string; phone?: string | null; email?: string | null; city?: string | null; source: string;
  course_code?: string | null; stage: LeadStage; assigned_to?: string | null; next_follow_up?: string | null; follow_up_note?: string | null;
  batch_pref?: string | null; mode_pref?: string | null; fee_plan?: string | null; education?: string | null; remarks?: string | null;
  referred_by_student?: string | null; student_id?: string | null; stage_dates: Record<string, string>; created_at: string;
}
export interface LeadActivity { id: string; lead_id: string; kind: string; summary: string; outcome?: string | null; by_name?: string | null; created_at: string }

export interface HrContact {
  id: string; full_name: string; designation?: string | null; department?: string | null; phone?: string | null; email?: string | null;
  linkedin?: string | null; city?: string | null; current_company?: string | null; company_type?: string | null; joined_on?: string | null;
  reference_note?: string | null; created_at?: string;
}
export interface HrHistory { id: string; hr_id: string; company: string; designation?: string | null; from_date?: string | null; to_date?: string | null }
export interface HrCall { id: string; hr_id: string; call_date: string; activity: string; outcome?: string | null; remarks?: string | null }

export type AmbassadorKind = "referral" | "review" | "social" | "mentor";
export interface AmbassadorActivity {
  id: string; student_id: string; kind: AmbassadorKind; details: string; proof_url?: string | null; reward_amount: number; gift?: string | null;
  status: "pending" | "approved" | "credited" | "delivered" | "rejected"; created_at: string;
}

export interface CourseModule { id: string; course_id: string; seq: number; name: string; total_videos: number }
export interface ModuleProgress { student_id: string; module_id: string; videos_done: number; test_score?: number | null; test_max?: number | null; updated_at?: string }
export interface Assessment { id: string; student_id: string; module_id?: string | null; title: string; marks: number; max_marks: number; taken_on: string }

export interface TermsDoc { id: string; kind: "general" | "placement"; version: number; title: string; items: { title: string; body: string }[]; active: boolean; created_at?: string }
export interface Consent { id: string; consent_no: string; student_id: string; kind: string; version: number; accepted_at: string; user_agent?: string | null }

export interface AlertRow {
  id: string; kind: string; ref_id: string; title: string; details?: string | null; owner_role: string; level: number;
  status: "open" | "resolved"; due_at: string; created_at: string; resolved_at?: string | null; resolved_note?: string | null;
}
