/** HR Management 360°: relationship pipeline, employment history, communication log and hiring requirements. */

export type HrStage =
  | "new_hr" | "not_connected" | "connected" | "rapport_building"
  | "future_hiring" | "active_hiring" | "profiles_shared" | "drive_scheduled";

export const HR_STAGES: { key: HrStage; label: string; bar: string }[] = [
  { key: "new_hr", label: "New HR", bar: "border-t-slate-500" },
  { key: "not_connected", label: "Not connected", bar: "border-t-red-600" },
  { key: "connected", label: "Connected", bar: "border-t-blue-600" },
  { key: "rapport_building", label: "Rapport building", bar: "border-t-teal-600" },
  { key: "future_hiring", label: "Future hiring", bar: "border-t-violet-600" },
  { key: "active_hiring", label: "Active hiring", bar: "border-t-emerald-600" },
  { key: "profiles_shared", label: "Profiles shared", bar: "border-t-sky-600" },
  { key: "drive_scheduled", label: "Drive scheduled", bar: "border-t-green-700" },
];
export const hrStageLabel = (s?: string | null) => HR_STAGES.find((x) => x.key === s)?.label ?? "New HR";

export type RelationshipStatus = "new" | "developing" | "good" | "strong" | "lost";
export const RELATIONSHIP_STATUSES: [RelationshipStatus, string][] = [
  ["new", "New"], ["developing", "Developing"], ["good", "Good"], ["strong", "Strong"], ["lost", "Lost"],
];
export const relationshipTone = (s?: string | null) =>
  (s === "strong" ? "green" : s === "good" ? "blue" : s === "developing" ? "amber" : s === "lost" ? "red" : "slate") as
    "green" | "blue" | "amber" | "red" | "slate";

export type HiringStatus = "unknown" | "not_hiring" | "future_hiring" | "active_hiring";
export const HIRING_STATUSES: [HiringStatus, string][] = [
  ["unknown", "Not known"], ["not_hiring", "Not hiring"], ["future_hiring", "Future hiring"], ["active_hiring", "Active hiring"],
];
export const hiringLabel = (s?: string | null) => HIRING_STATUSES.find(([k]) => k === s)?.[1] ?? "Not known";

/** How the HR prefers to be reached, and how a contact was actually made. */
export const CONTACT_MODES: [string, string][] = [
  ["call", "Call"], ["email", "Email"], ["meeting", "Meeting"], ["whatsapp", "WhatsApp"], ["linkedin", "LinkedIn"], ["other", "Other"],
];
export const HR_SOURCES: Record<string, string> = {
  employee_reference: "Employee reference",
  alumni: "Alumni",
  linkedin: "LinkedIn",
  cold_call: "Cold call",
  event: "Event / seminar",
  existing_client: "Existing client",
  other: "Other",
};

export const HR_ACTIVITY_KINDS: [string, string][] = [
  ["stage", "Stage change"], ["allocation", "Allocation"], ["note", "Note"], ["company_change", "Company change"],
];
export interface HrActivity {
  id: string; hr_id: string; kind: string; summary: string; outcome?: string | null; by_name?: string | null; created_at: string;
}

export const REQUIREMENT_STATUSES: [string, string][] = [
  ["pending", "Pending"], ["expected", "Expected"], ["tentative", "Tentative"], ["confirmed", "Confirmed"], ["closed", "Closed"], ["lost", "Lost"],
];
export const requirementTone = (s?: string | null) =>
  (s === "confirmed" ? "green" : s === "tentative" ? "amber" : s === "expected" ? "blue" : s === "lost" ? "red" : "slate") as
    "green" | "amber" | "blue" | "red" | "slate";

export interface HrRequirement {
  id: string; hr_id: string; company: string; role: string; vacancies: number;
  expected_period?: string | null; expected_date?: string | null; qualification?: string | null; branches?: string | null;
  package?: string | null; experience?: string | null; location?: string | null; assigned_to?: string | null;
  status: "pending" | "expected" | "tentative" | "confirmed" | "closed" | "lost";
  notes?: string | null; created_by?: string | null; created_at?: string;
}

/** One staff member's relationship with an HR, derived from the communication log. */
export interface StaffRelationship {
  staff: string;
  interactions: number;
  connected: number;
  last_contacted?: string | null;
  strength: RelationshipStatus;
}

/* -------------------------------------------------------------------------- */
/* Phase 2: drives, reminder sequence, Excel submissions and feedback.         */

/** §10 What the HR module adds on top of a placement drive. */
export interface HrDriveConfig {
  hr_id?: string | null; coordinator?: string | null; vacancies?: number; qualification?: string | null;
  branches?: string | null; passout?: string | null; experience?: string | null;
  interest_close_at?: string | null; excel_due_at?: string | null;
  sending_mode?: "after_approval" | "automatic"; jd_url?: string | null; excel_format?: string | null;
  consent_required?: boolean; reminder_lead_days?: number;
  confirmation?: "pending" | "tentative" | "confirmed" | "postponed" | "cancelled";
}

export const CONFIRMATIONS: [string, string][] = [
  ["pending", "Pending"], ["tentative", "Tentative"], ["confirmed", "Confirmed"], ["postponed", "Postponed"], ["cancelled", "Cancelled"],
];
export const confirmationTone = (s?: string | null) =>
  (s === "confirmed" ? "green" : s === "tentative" ? "amber" : s === "postponed" ? "blue" : s === "cancelled" ? "red" : "slate") as
    "green" | "amber" | "blue" | "red" | "slate";

/** §11 One step of the automatic reminder sequence. */
export interface HrDriveTask {
  id: string; drive_id?: string | null; hr_id?: string | null; step: string; title: string; detail?: string | null;
  due_on: string; assigned_to?: string | null; status: "pending" | "done" | "skipped";
  completed_by?: string | null; completed_at?: string | null; hard_deadline: boolean; created_at?: string;
}

/** §13 The student sheet sent to a company. */
export interface HrSubmission {
  id: string; drive_id: string; hr_id?: string | null; recipient_email: string; student_count: number;
  file_name?: string | null; scheduled_at?: string | null; sent_at?: string | null;
  status: "draft" | "awaiting_approval" | "scheduled" | "sent" | "failed";
  failure_reason?: string | null; prepared_by?: string | null; approved_by?: string | null; created_at?: string;
}
export const SUBMISSION_STATUSES: [string, string][] = [
  ["draft", "Draft"], ["awaiting_approval", "Awaiting approval"], ["scheduled", "Scheduled"], ["sent", "Sent"], ["failed", "Failed"],
];
export const submissionTone = (s?: string | null) =>
  (s === "sent" ? "green" : s === "scheduled" ? "blue" : s === "awaiting_approval" ? "amber" : s === "failed" ? "red" : "slate") as
    "green" | "blue" | "amber" | "red" | "slate";

/** §17 HR feedback and the corrective action. */
export interface HrFeedback {
  id: string; hr_id: string; drive_id?: string | null; company?: string | null; feedback: string;
  sentiment: "positive" | "neutral" | "concern"; action?: string | null; assigned_to?: string | null;
  due_on?: string | null; status: "open" | "in_progress" | "closed";
  closed_by?: string | null; closed_at?: string | null; created_by?: string | null; created_at?: string;
}
export const SENTIMENTS: [string, string][] = [["positive", "Positive"], ["neutral", "Neutral"], ["concern", "Concern"]];
export const sentimentTone = (s?: string | null) => (s === "positive" ? "green" : s === "concern" ? "red" : "slate") as "green" | "red" | "slate";

/** §14 The placement funnel, in the order the spec lists it. */
export interface PipelineCounts {
  interested: number; profiles_shared: number; shortlisted: number; call_letters: number;
  attended: number; selected: number; offered: number; joined: number;
  not_shared: number; no_show: number; not_selected: number; not_joined: number;
}

/** §15 What one HR has delivered over their whole relationship with us. */
export interface HrContribution {
  drives: number; interested: number; shared: number; shortlisted: number;
  attended: number; selected: number; offers: number; joined: number;
}

/** §18 One staff member's column in the daily activity report. */
export interface StaffDayStats {
  staff: string; allocated: number; contacted: number; connected: number; not_connected: number;
  new_hrs: number; follow_ups: number; requirements: number; drives_confirmed: number;
  tasks_done: number; tasks_pending: number;
}
