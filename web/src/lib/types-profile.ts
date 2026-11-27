import type { Address } from "./types";

/** Extra profile fields kept in students.extra (jsonb). */
export interface StudentExtra {
  phone_whatsapp?: boolean;
  alt_whatsapp?: boolean;
  admin_contact?: string;
  current_same?: boolean;
  current_address?: Address;
  complementary_months?: number;
  /** Validity chosen from the admin list (months); falls back to the course validity. */
  validity_months?: number;
  validity_type?: "fixed" | "extendable";
  company_designation?: string;
  /** Professional details before joining MasterVLSI (alongside students.professional). */
  before?: { designation?: string; from?: string; to?: string; location?: string };
  /** Every company worked at before joining, newest first. Replaces the single `before` entry. */
  employment?: EmploymentRow[];
  /** Placement after MasterVLSI. */
  placement?: { status?: string; company?: string; designation?: string; package?: string; doj?: string; hr_name?: string; hr_email?: string; location?: string };
  career_objective?: string;
  /** Gap in studies / career: from, to (YYYY-MM) and why. */
  career_gap?: { from?: string; to?: string; reason?: string };
  /** Every career gap. Replaces the single `career_gap` entry. */
  career_gaps?: CareerGapRow[];
  /** College students: university roll number and key contacts. */
  college_info?: { roll_no?: string; department?: string; hod?: string; tpo?: string; faculty?: string };
  /** Corporate students: employee, HR and reporting manager; billing is office-only. */
  corporate?: { employee_id?: string; department?: string; hr_name?: string; hr_contact?: string; manager_name?: string; manager_contact?: string; billing?: string };
  /** Filled after training validity expires. */
  alumni?: import("./types-student360").AlumniProfile;
}

export type MasterCategory = "board" | "university" | "stream" | "contact_position" | "validity_months" | "designation";
export interface MasterOption { id: string; category: MasterCategory; value: string; sort: number }

export type ApplicationStatus = "applied" | "in_process" | "shortlisted" | "rejected" | "selected" | "placed";
export const APPLICATION_STATUSES: [ApplicationStatus, string][] = [
  ["applied", "Applied"], ["in_process", "In process"], ["shortlisted", "Shortlisted"], ["rejected", "Rejected"], ["selected", "Selected"], ["placed", "Placed"],
];
export interface StudentApplication {
  id: string;
  student_id: string;
  drive_id?: string | null;
  company: string;
  role?: string | null;
  applied_on: string;
  rounds: number;
  status: ApplicationStatus;
  package?: string | null;
  doj?: string | null;
  hr_name?: string | null;
  hr_email?: string | null;
  job_location?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}
export interface StudentNote { id: string; student_id: string; note: string; by_name?: string | null; created_at: string }

/** All 28 states and 8 union territories. */
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

/** Education rows: stored level key, label shown, and which master list feeds the board/university dropdown. */
export const EDU_ROWS = [
  { key: "10th", label: "10th (SSLC)", list: "board" },
  { key: "12th / Diploma", label: "12th / PUC / Diploma", list: "board" },
  { key: "B.Tech / B.E", label: "B.E. / B.Tech / B.Sc (Graduation)", list: "university" },
  { key: "M.Tech / PG", label: "M.E. / M.Tech (PG)", list: "university" },
] as const;
/** Older rows may use other names for the same level. */
export const EDU_ALIASES: Record<string, string> = { "M.Tech": "M.Tech / PG", "12th": "12th / Diploma", "B.E": "B.Tech / B.E", "B.Tech": "B.Tech / B.E" };

/** Sections of the profile form, for the side menu. */
export const PROFILE_SECTIONS: [string, string][] = [
  ["personal", "Personal details"],
  ["contact", "Contact & access"],
  ["address", "Address"],
  ["master", "Master data"],
  ["family", "Family & emergency"],
  ["education", "Education"],
  ["college", "College details"],
  ["course", "Course & admission"],
  ["professional", "Professional info"],
];


/** One stint before joining MasterVLSI. Duration is derived from the dates, never typed. */
export interface EmploymentRow {
  company?: string; designation?: string; from?: string; to?: string; ctc?: string; location?: string;
}
export interface CareerGapRow { from?: string; to?: string; reason?: string }

/** Whole months between two YYYY-MM values; an empty `to` means "still there". */
export function monthsBetween(from?: string | null, to?: string | null): number {
  if (!from) return 0;
  const [fy, fm] = from.split("-").map(Number);
  if (!fy || !fm) return 0;
  const now = new Date();
  let ty: number, tm: number;
  if (to) {
    const parts = to.split("-").map(Number);
    if (!parts[0] || !parts[1]) return 0;
    [ty, tm] = parts;
  } else {
    ty = now.getFullYear();
    tm = now.getMonth() + 1;
  }
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

export const formatExperience = (months: number) =>
  months <= 0 ? "—" : `${Math.floor(months / 12)} yr ${months % 12} mo`;

/**
 * Total experience across every stint. Overlapping stints are counted once, so two
 * jobs held in the same months do not inflate the total.
 */
export function totalExperienceMonths(rows: EmploymentRow[]): number {
  const spans = rows
    .filter((r) => r.from)
    .map((r) => {
      const [fy, fm] = r.from!.split("-").map(Number);
      const start = fy * 12 + fm;
      return { start, end: start + monthsBetween(r.from, r.to) };
    })
    .filter((x) => Number.isFinite(x.start) && x.end > x.start)
    .sort((a, b) => a.start - b.start);
  let total = 0, cursor = -Infinity;
  for (const s of spans) {
    const from = Math.max(s.start, cursor);
    if (s.end > from) total += s.end - from;
    cursor = Math.max(cursor, s.end);
  }
  return total;
}

/** Older records kept one employment entry and one gap; read them as single-row grids. */
export function employmentRows(x: StudentExtra, company?: string | null): EmploymentRow[] {
  if (x.employment?.length) return x.employment;
  const b = x.before;
  if (company || b?.designation || b?.from || b?.to || b?.location)
    return [{ company: company ?? undefined, designation: b?.designation, from: b?.from, to: b?.to, location: b?.location }];
  return [];
}
export function careerGapRows(x: StudentExtra): CareerGapRow[] {
  if (x.career_gaps?.length) return x.career_gaps;
  return x.career_gap?.from || x.career_gap?.reason ? [x.career_gap] : [];
}
