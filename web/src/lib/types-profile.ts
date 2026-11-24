import type { Address } from "./types";

/** Extra profile fields kept in students.extra (jsonb). */
export interface StudentExtra {
  phone_whatsapp?: boolean;
  alt_whatsapp?: boolean;
  admin_contact?: string;
  current_same?: boolean;
  current_address?: Address;
  complementary_months?: number;
  validity_type?: "fixed" | "extendable";
  company_designation?: string;
  /** Professional details before joining MasterVLSI (alongside students.professional). */
  before?: { designation?: string; from?: string; to?: string; location?: string };
  /** Placement after MasterVLSI. */
  placement?: { status?: string; company?: string; designation?: string; package?: string; doj?: string; hr_name?: string; hr_email?: string; location?: string };
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

