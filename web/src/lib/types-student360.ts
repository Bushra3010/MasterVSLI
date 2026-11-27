/** Student Management 360°: interviews, resume library, payment submissions, requests and the student action center. */

export type InterviewStatus = "scheduled" | "attended" | "missed" | "cancelled";
export interface StudentInterview {
  id: string;
  student_id: string;
  drive_id?: string | null;
  company: string;
  role?: string | null;
  round?: string | null;
  scheduled_at: string;
  mode?: string | null;
  location?: string | null;
  call_letter_url?: string | null;
  status: InterviewStatus;
  explanation?: string | null;
  explained_at?: string | null;
  outcome?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface StudentResume {
  id: string;
  student_id: string;
  title: string;
  domain?: string | null;
  version: string;
  document_id?: string | null;
  is_default: boolean;
  created_at?: string;
}
export const RESUME_DOMAINS = ["Design Verification", "Physical Design", "RTL Design", "DFT", "Analog Layout", "STA", "FPGA", "Embedded", "Other"];

export type SubmissionStatus = "pending" | "approved" | "rejected";
export interface PaymentSubmission {
  id: string;
  student_id: string;
  installment_id?: string | null;
  amount: number;
  mode: string;
  reference?: string | null;
  paid_on: string;
  document_id?: string | null;
  note?: string | null;
  status: SubmissionStatus;
  office_note?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  payment_id?: string | null;
  created_at?: string;
}
export const PAYMENT_MODES = ["UPI", "Bank Transfer", "Cash", "Card", "Cheque"];

export type RequestKind = "certificate" | "validity_extension" | "support" | "feedback" | "document" | "other";
export type RequestStatus = "open" | "in_progress" | "approved" | "rejected" | "closed";
export interface StudentRequest {
  id: string;
  student_id: string;
  kind: RequestKind;
  subject: string;
  details?: string | null;
  data?: Record<string, unknown>;
  status: RequestStatus;
  response?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  created_at?: string;
}
export const REQUEST_KINDS: [RequestKind, string][] = [
  ["certificate", "Certificate application"],
  ["validity_extension", "Validity extension"],
  ["support", "Support ticket"],
  ["document", "Document / letter request"],
  ["feedback", "Feedback"],
  ["other", "Other request"],
];
export const REQUEST_TONE: Record<RequestStatus, "amber" | "blue" | "green" | "red" | "slate"> = { open: "amber", in_progress: "blue", approved: "green", rejected: "red", closed: "slate" };
export const requestKindLabel = (k: string) => REQUEST_KINDS.find(([v]) => v === k)?.[1] ?? k;
export const CERTIFICATE_TYPES = ["Training certificate", "Internship completion", "Course completion", "Bonafide letter", "Other"];

export interface ReminderAck { student_id: string; key: string; acked_at: string }

/** Alumni profile (students.extra.alumni) — shown only after training validity expires. */
export interface AlumniProfile {
  company?: string;
  designation?: string;
  location?: string;
  package?: string;
  since?: string;
  linkedin?: string;
  changes?: { company: string; designation?: string; from?: string }[];
  hiring?: string;
  participation?: string[];
  updated_at?: string;
}
export const ALUMNI_PARTICIPATION = ["Guest lecture", "Mock interviews", "Mentoring juniors", "Hiring referrals", "Alumni meet"];

/** Reminder thresholds (days). */
export const ATTENDANCE_GAP_DAYS = 7;
export const PLACEMENT_GAP_DAYS = 7;
export const FEE_DUE_SOON_DAYS = 7;
export const VALIDITY_SOON_DAYS = 30;

export type ActionKind =
  | "attendance_irregular"
  | "placement_inactive"
  | "missed_interview"
  | "upcoming_interview"
  | "placement_response"
  | "profile_incomplete"
  | "fee_installment"
  | "learning_pending"
  | "training_validity"
  | "alumni_update";

export interface ActionItem {
  key: string;
  kind: ActionKind;
  title: string;
  detail: string;
  href: string;
  /** Urgent items are red; the rest amber / blue. */
  tone: "red" | "amber" | "blue";
  /** Informational items the student may acknowledge; the rest stay until resolved. */
  ackable: boolean;
}
