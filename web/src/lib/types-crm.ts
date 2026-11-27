// Types for leads, HR contacts, colleges, ambassador, learning, terms, alerts, branches and Enrich Silicon.
export type Company = "mastervlsi" | "enrich";
export type StudentCategory = "normal" | "college" | "corporate";
export type FeeAccount = "paka" | "kacha";
/** Ten pipeline stages. Stored keys stay stable: "lead" = New lead, "enrolled" = Converted, "lost" = Not interested. */
export type LeadStage = "lead" | "non_connected" | "connected" | "interested" | "visit_scheduled" | "visited" | "admission_pending" | "enrolled" | "lost" | "future_follow_up";

export interface Branch { id: string; name: string; city?: string | null; domain?: string | null; company: Company }

export interface College {
  id: string; code?: string | null; name: string; city?: string | null; state?: string | null; affiliation?: string | null;
  college_type?: string | null; since?: string | null; status: "partner" | "prospect" | "inactive";
  stage?: import("./types-colleges").CollegeStage; assigned_to?: string | null; student_strength?: number; target_students?: number;
  departments?: string | null; website?: string | null; next_follow_up?: string | null; follow_up_note?: string | null; source?: string | null; created_at?: string;
}
export interface TpoContact {
  id: string; college_id: string; name: string; designation?: string | null; phone?: string | null; alt_phone?: string | null;
  email?: string | null; is_primary: boolean; active: boolean; remarks?: string | null; next_follow_up?: string | null; last_interaction?: string | null;
  department?: string | null; call_status?: "not_called" | "connected" | "non_connected";
}
export interface Mou {
  id: string; college_id: string; mou_no?: string | null; agreement_type: string; start_date?: string | null; end_date?: string | null;
  scope?: string | null; status: "draft" | "review" | "shared" | "active" | "expired"; document_url?: string | null; document_path?: string | null;
}
export interface CampusDrive {
  id: string; college_id: string; company: string; job_role?: string | null; drive_date?: string | null; mode?: string | null;
  eligibility?: string | null; package?: string | null; registered: number; attended: number; shortlisted: number; selected: number;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
}

export interface Client { id: string; name: string; contact_person?: string | null; email?: string | null; phone?: string | null; gstin?: string | null; kind: "services" | "corporate_training"; city?: string | null; state?: string | null }
export interface Project { id: string; client_id?: string | null; name: string; status: "active" | "on_hold" | "completed"; start_date?: string | null; end_date?: string | null; hourly_rate?: number | null }
export interface Timesheet { id: string; project_id: string; staff_id: string; work_date: string; hours: number; note?: string | null }
export interface Invoice {
  id: string; invoice_no: string; company: Company; client_id?: string | null; issue_date: string; description?: string | null;
  amount: number; gst_pct: number; tds_pct?: number; status: "unpaid" | "paid" | "cancelled"; paid_on?: string | null;
}

export interface Lead {
  id: string; lead_no?: string | null; full_name: string; phone?: string | null; email?: string | null; city?: string | null; source: string;
  course_code?: string | null; stage: LeadStage; assigned_to?: string | null; next_follow_up?: string | null; follow_up_note?: string | null;
  batch_pref?: string | null; mode_pref?: string | null; fee_plan?: string | null; education?: string | null; remarks?: string | null;
  referred_by_student?: string | null; student_id?: string | null; stage_dates: Record<string, string>; created_at: string;
  priority?: "low" | "normal" | "high" | "urgent"; allocation_deadline?: string | null; allocation_note?: string | null; allocated_at?: string | null;
  allocated_by?: string | null; college_id?: string | null; archived?: boolean; archived_at?: string | null; archive_reason?: string | null; duplicate_of?: string | null;
}
export interface LeadActivity { id: string; lead_id: string; kind: string; summary: string; outcome?: string | null; by_name?: string | null; created_at: string }

export interface HrContact {
  id: string; full_name: string; designation?: string | null; department?: string | null; phone?: string | null; email?: string | null;
  linkedin?: string | null; city?: string | null; current_company?: string | null; company_type?: string | null; joined_on?: string | null;
  reference_note?: string | null; created_at?: string;
  /** Permanent identity, kept for life even when the HR moves company. */
  hr_code?: string | null;
  stage?: string | null; relationship_status?: string | null; hiring_status?: string | null;
  assigned_to?: string | null; alt_assigned_to?: string | null; introduced_by?: string | null; source?: string | null;
  personal_email?: string | null; previous_company?: string | null; preferred_contact?: string | null;
  next_follow_up?: string | null; follow_up_note?: string | null; last_verified?: string | null; active?: boolean;
}
/** One stint at one company. Rows are appended on a company change, never overwritten. */
export interface HrHistory {
  id: string; hr_id: string; company: string; designation?: string | null; from_date?: string | null; to_date?: string | null;
  official_email?: string | null; location?: string | null; replacement_hr_id?: string | null; created_at?: string;
}
export interface HrCall {
  id: string; hr_id: string; call_date: string; activity: string; outcome?: string | null; remarks?: string | null;
  by_name?: string | null; mode?: string | null; created_at?: string;
}

export type AmbassadorKind = "referral" | "review" | "social" | "mentor" | "feedback" | "incident";
export interface AmbassadorActivity {
  id: string; student_id: string; kind: AmbassadorKind; details: string; proof_url?: string | null; reward_amount: number; gift?: string | null;
  status: "pending" | "approved" | "credited" | "delivered" | "rejected"; created_at: string;
  /** Activity details (referral contact, social counts, mentorship dates, incident report…). */
  data?: Record<string, string | number | boolean | null>; decided_by?: string | null; decided_at?: string | null;
}

export interface CourseModule { id: string; course_id: string; seq: number; name: string; total_videos: number }
export interface ModuleProgress { student_id: string; module_id: string; videos_done: number; test_score?: number | null; test_max?: number | null; updated_at?: string }
export interface Assessment { id: string; student_id: string; module_id?: string | null; title: string; marks: number; max_marks: number; taken_on: string }

export interface TermsDoc { id: string; kind: "general" | "placement"; version: number; title: string; items: { title: string; body: string }[]; active: boolean; created_at?: string }
export interface Consent { id: string; consent_no: string; student_id: string; kind: string; version: number; accepted_at: string; user_agent?: string | null }

export interface AlertRow {
  id: string; kind: string; ref_id: string; title: string; details?: string | null; owner_role: string; level: number;
  status: "open" | "resolved"; due_at: string; created_at: string; resolved_at?: string | null; resolved_note?: string | null; notified_level?: number;
}

export interface AssignmentRow { id: string; course_id?: string | null; batch_id?: string | null; module_id?: string | null; title: string; instructions?: string | null; due_date?: string | null; max_marks: number; created_at?: string }
export interface Submission { id: string; assignment_id: string; student_id: string; link?: string | null; note?: string | null; submitted_at: string; marks?: number | null; feedback?: string | null; status: "submitted" | "graded" | "resubmit" }
export interface CollegeLogin { user_id: string; college_id: string; tpo_id?: string | null; created_at?: string }
export interface TpoInteraction { id: string; tpo_id: string; on_date: string; mode: string; summary: string; next_follow_up?: string | null; by_name?: string | null; created_at?: string }
export interface AlertContact { id: string; role_name: string; name: string; email?: string | null; phone?: string | null }
export interface Milestone { id: string; project_id: string; title: string; due_date: string; done: boolean; done_on?: string | null }
export interface Appraisal { id: string; staff_id: string; period: string; rating: number; increment_pct: number; comments?: string | null; created_at?: string }
export interface CompanyProfile { company: Company; legal_name: string; address?: string | null; gstin?: string | null; pan?: string | null; bank_name?: string | null; bank_account?: string | null; bank_ifsc?: string | null; email?: string | null; phone?: string | null }
export interface AuditRow { id: number; at: string; user_id?: string | null; user_email?: string | null; table_name: string; action: string; record_id?: string | null; changes?: Record<string, unknown> | null }
