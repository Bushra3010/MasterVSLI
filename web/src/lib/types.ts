export type Role = "admin" | "staff" | "student";
export type StudentStatus = "active" | "on_hold" | "expired" | "completed" | "dropped";
export type TrainingMode = "online" | "offline" | "hybrid";
export type Channel = "zoom" | "teamviewer" | "biometric" | "placement" | "portal";
export type AttendanceSource = "zoom" | "teamviewer" | "biometric" | "manual";
export type InstallmentStatus = "pending" | "partial" | "paid" | "overdue";
export type DriveStatus = "upcoming" | "open" | "closed";
export type DriveResponseValue = "pending" | "yes" | "no";
export type LetterTemplate =
  | "training_certificate"
  | "internship_offer"
  | "internship_completion"
  | "admission_confirmation"
  | "placement_confirmation"
  | "student_id_card"
  | "visiting_card"
  | "staff_offer"
  | "payslip"
  | "service_agreement"
  | "experience_letter";

export const CHANNELS: Channel[] = ["zoom", "teamviewer", "biometric", "placement", "portal"];

export interface Address {
  line?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}
export interface Family {
  father_name?: string;
  father_occupation?: string;
  father_phone?: string;
  mother_name?: string;
  mother_occupation?: string;
  mother_phone?: string;
}
export interface Person {
  name?: string;
  relation?: string;
  occupation?: string;
  phone?: string;
}
export interface Professional {
  working_status?: string;
  company?: string;
  total_exp?: string;
  relevant_exp?: string;
  current_ctc?: string;
  expected_ctc?: string;
  notice_period?: string;
  preferred_location?: string;
  relocate?: boolean;
  interview_mode?: string;
}

export interface Student {
  id: string;
  user_id?: string | null;
  enrollment_no: string;
  status: StudentStatus;
  full_name: string;
  dob?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  blood_group?: string | null;
  nationality?: string | null;
  languages?: string[] | null;
  native_place?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
  email?: string | null;
  alt_email?: string | null;
  linkedin?: string | null;
  resume_url?: string | null;
  address: Address;
  family: Family;
  spouse: Person;
  emergency: Person;
  professional: Professional;
  course_id?: string | null;
  batch_id?: string | null;
  training_mode: TrainingMode;
  admission_date: string;
  validity_end?: string | null;
  total_fee: number;
  payment_plan?: string | null;
  referred_by?: string | null;
  lead_source?: string | null;
  placement_consent: boolean;
  placement_eligible: boolean;
  created_at?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  duration_months: number;
  validity_months: number;
  fee: number;
}
export interface Batch {
  id: string;
  course_id: string;
  name: string;
  mode: TrainingMode;
  start_date?: string | null;
}
export interface Vendor {
  id: string;
  parent_id?: string | null;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
}
export interface Education {
  id: string;
  student_id: string;
  level: string;
  institution?: string | null;
  board?: string | null;
  stream?: string | null;
  year_of_passing?: number | null;
  score?: string | null;
  location?: string | null;
}
export interface AccessRow {
  student_id: string;
  channel: Channel;
  enabled: boolean;
  external_ref?: string | null;
}
export interface AccessEvent {
  id: number;
  student_id: string;
  action: string;
  reason?: string | null;
  created_at: string;
}
export interface AttendanceRecord {
  id: number;
  student_id: string;
  source: AttendanceSource;
  session_date: string;
  check_in?: string | null;
  check_out?: string | null;
  duration_minutes: number;
  external_ref?: string | null;
}
export interface Allocation {
  id: string;
  student_id: string;
  vendor_id: string;
  amount: number;
}
export interface Installment {
  id: string;
  allocation_id: string;
  student_id: string;
  sub_vendor_id?: string | null;
  seq: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: InstallmentStatus;
}
export interface Payment {
  id: string;
  installment_id: string;
  student_id: string;
  amount: number;
  mode: string;
  reference?: string | null;
  paid_at: string;
}
export interface Drive {
  id: string;
  company: string;
  job_role: string;
  location?: string | null;
  drive_date?: string | null;
  interview_mode?: string | null;
  ctc?: string | null;
  eligibility?: string | null;
  status: DriveStatus;
  sheet_id?: string | null;
  created_at?: string;
}
export interface DriveResponse {
  drive_id: string;
  student_id: string;
  response: DriveResponseValue;
  stage?: string | null;
  synced_to_sheet: boolean;
  synced_at?: string | null;
  updated_at?: string;
}
export interface Staff {
  id: string;
  employee_code: string;
  full_name: string;
  designation?: string | null;
  department?: string | null;
  joining_date?: string | null;
  monthly_salary?: number | null;
  email?: string | null;
  phone?: string | null;
}
export interface Letter {
  id: string;
  serial_no: string;
  template: LetterTemplate;
  student_id?: string | null;
  staff_id?: string | null;
  data: Record<string, string>;
  issued_at: string;
  revoked: boolean;
}
export interface NotificationRow {
  id: number;
  student_id: string;
  kind: string;
  channel: string;
  sent_at?: string | null;
  created_at: string;
}

// ---- composite read models -------------------------------------------------
export interface StudentListItem extends Student {
  course_name?: string;
  batch_name?: string;
  attendance_pct: number;
  paid: number;
  balance: number;
  days_left: number | null;
}

export interface StudentDocument {
  id: string;
  student_id: string;
  kind: string; // resume | photo | id_proof | certificate | other
  storage_path: string; // <student_id>/<kind>/<timestamp>-<file name>
  verified: boolean;
  uploaded_at?: string;
}

export const DOC_KINDS: Record<string, string> = {
  resume: "Resume",
  photo: "Photo",
  id_proof: "ID proof",
  certificate: "Certificate",
  other: "Other",
};

/** Original file name, recovered from the storage path. */
export const docFileName = (path: string) => path.split("/").pop()?.replace(/^\d+-/, "") ?? path;

export interface StudentProfile {
  student: Student;
  course?: Course;
  batch?: Batch;
  education: Education[];
  access: AccessRow[];
  events: AccessEvent[];
  allocations: (Allocation & { vendor: Vendor })[];
  installments: (Installment & { sub_vendor?: Vendor })[];
  payments: Payment[];
  responses: (DriveResponse & { drive: Drive })[];
  letters: Letter[];
  documents: StudentDocument[];
  attendance: { pct: number; bySource: Record<AttendanceSource, number>; recent: AttendanceRecord[] };
  fee: { total: number; paid: number; balance: number; next_due: string | null };
}

export interface DashboardStats {
  total: number;
  active: number;
  on_hold: number;
  expired: number;
  expiring_month: number;
  pending_fees: number;
  collected: number;
  open_drives: number;
  interested: number;
  today_present: number;
  attendance_by_source: Record<AttendanceSource, number>;
  irregular: number;
}

export interface NewStudentInput {
  full_name: string;
  email?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  course_id: string;
  batch_id?: string;
  training_mode: TrainingMode;
  admission_date: string;
  total_fee: number;
  lead_source?: string;
  referred_by?: string;
  city?: string;
  state?: string;
  allocations: { vendor_id: string; amount: number; sub_vendor_id?: string; installments: number }[];
}

export interface NewDriveInput {
  company: string;
  job_role: string;
  location?: string;
  drive_date?: string;
  interview_mode?: string;
  ctc?: string;
  eligibility?: string;
  status: DriveStatus;
}

export interface AttendanceInput {
  student_id: string;
  source: AttendanceSource;
  session_date: string;
  check_in?: string;
  check_out?: string;
  duration_minutes: number;
  external_ref?: string;
}
