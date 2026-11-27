/** College Management 360°: pipeline, incoming college data, reference network and college engagement. */

export type CollegeStage =
  | "new" | "non_connected" | "connected" | "interested" | "meeting_scheduled" | "meeting_completed"
  | "proposal_sent" | "mou_pending" | "mou_signed" | "not_interested" | "future_follow_up";

export const COLLEGE_STAGES: { key: CollegeStage; label: string; bar: string }[] = [
  { key: "new", label: "New College", bar: "border-t-slate-500" },
  { key: "non_connected", label: "Non-connected", bar: "border-t-red-600" },
  { key: "connected", label: "Connected", bar: "border-t-blue-600" },
  { key: "interested", label: "Interested", bar: "border-t-emerald-600" },
  { key: "meeting_scheduled", label: "Meeting Scheduled", bar: "border-t-orange-500" },
  { key: "meeting_completed", label: "Meeting Completed", bar: "border-t-teal-600" },
  { key: "proposal_sent", label: "Proposal Sent", bar: "border-t-sky-600" },
  { key: "mou_pending", label: "MoU Pending", bar: "border-t-violet-600" },
  { key: "mou_signed", label: "MoU Signed", bar: "border-t-green-700" },
  { key: "not_interested", label: "Not Interested", bar: "border-t-rose-500" },
  { key: "future_follow_up", label: "Future Follow-up", bar: "border-t-indigo-600" },
];
export const collegeStageLabel = (s?: string | null) => COLLEGE_STAGES.find((x) => x.key === s)?.label ?? "New College";

export const COLLEGE_ACTIVITY_KINDS: [string, string][] = [
  ["call", "Call"], ["meeting", "Meeting"], ["visit", "Campus visit"], ["proposal", "Proposal"], ["email", "Email"], ["whatsapp", "WhatsApp"], ["note", "Note"],
];
export interface CollegeActivity { id: string; college_id: string; kind: string; summary: string; outcome?: string | null; by_name?: string | null; created_at: string }

export interface CollegeSubmission {
  id: string; college_name: string; city?: string | null; state?: string | null; contact_name?: string | null; designation?: string | null;
  department?: string | null; phone?: string | null; email?: string | null; source: string; submitted_by?: string | null;
  status: "pending" | "verified" | "rejected"; college_id?: string | null; decided_by?: string | null; decided_at?: string | null; note?: string | null; created_at: string;
}
export const SUBMISSION_SOURCES: Record<string, string> = { public_form: "Public registration", student: "Student", alumni: "Alumni", staff: "Staff" };

export type ReferenceType = "active_student" | "alumni" | "placed_alumni" | "faculty" | "other";
export const REFERENCE_TYPES: [ReferenceType, string][] = [["active_student", "Active Student"], ["alumni", "Alumni"], ["placed_alumni", "Placed Alumni"], ["faculty", "Faculty"], ["other", "Other"]];
export interface CollegeReference {
  id: string; college_id: string; student_id?: string | null; person_name: string; person_type: ReferenceType; department?: string | null;
  batch?: string | null; reference_to?: string | null; phone?: string | null; notes?: string | null; created_at?: string;
}

export const OPPORTUNITY_KINDS = ["Training", "Seminar / workshop", "Internship", "Campus placement", "Faculty development", "Value-added course", "Other"];
export interface CollegeOpportunity {
  id: string; college_id: string; kind: string; title: string; students: number; value: number; expected_date?: string | null;
  status: "open" | "proposed" | "won" | "lost"; owner?: string | null; notes?: string | null; created_at?: string;
}
export interface CollegeEvent {
  id: string; college_id: string; kind: string; title: string; event_date?: string | null; speaker?: string | null; attendees: number;
  leads_generated: number; status: "planned" | "done" | "cancelled"; notes?: string | null; created_at?: string;
}
export interface CollegeFeedback { id: string; college_id: string; given_by?: string | null; rating: number; comments?: string | null; on_date: string; created_at?: string }
export interface CollegeFinance { id: string; college_id: string; description: string; amount: number; kind: "invoice" | "payment"; due_date?: string | null; paid_on?: string | null; reference?: string | null; created_at?: string }
export interface CollegeDocument { id: string; college_id: string; title: string; kind: string; url?: string | null; storage_path?: string | null; uploaded_by?: string | null; created_at?: string }
