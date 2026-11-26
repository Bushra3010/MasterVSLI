/** Earn & Rewards: admin-configurable targets and rewards, program settings and goodies. */
import type { AmbassadorKind } from "./types-crm";

export type RewardKey = "institute_feedback" | "google_review" | "social_media" | "referral" | "mentorship" | "incident";
export type RewardType = "goodie" | "amount" | "mentorship" | "none";

export interface RewardSetting {
  key: RewardKey;
  label: string;
  target?: number | null;
  reward_type: RewardType;
  reward_amount: number;
  active: boolean;
  paused: boolean;
  sort: number;
}
export interface RewardProgram { id: number; academic_year: string; valid_from?: string | null; valid_to?: string | null; branch_id?: string | null }
export interface Goodie { id: string; student_id: string; source: string; ref: string; reason: string; status: "earned" | "collected"; earned_at: string; collected_at?: string | null }

/** Which setting governs each kind of student activity. */
export const KIND_SETTING: Record<AmbassadorKind, RewardKey> = {
  referral: "referral",
  feedback: "institute_feedback",
  review: "google_review",
  social: "social_media",
  mentor: "mentorship",
  incident: "incident",
};
export const KIND_LABEL: Record<AmbassadorKind, string> = {
  referral: "Referral",
  feedback: "Institute feedback",
  review: "Google review",
  social: "Like / Share / Subscribe",
  mentor: "Mentorship",
  incident: "Incident report",
};

export const DEFAULT_REWARD_SETTINGS: RewardSetting[] = [
  { key: "institute_feedback", label: "Institute Feedback", target: 4, reward_type: "goodie", reward_amount: 0, active: true, paused: false, sort: 1 },
  { key: "google_review", label: "Google Review (Voluntary)", target: null, reward_type: "none", reward_amount: 0, active: true, paused: false, sort: 2 },
  { key: "social_media", label: "Social Media Activity", target: 10000, reward_type: "goodie", reward_amount: 0, active: true, paused: false, sort: 3 },
  { key: "referral", label: "Referral (Admission)", target: 1, reward_type: "amount", reward_amount: 2000, active: true, paused: false, sort: 4 },
  { key: "mentorship", label: "Mentorship (Min. 4 Months)", target: null, reward_type: "goodie", reward_amount: 0, active: true, paused: false, sort: 5 },
  { key: "incident", label: "Incident Report (Verified)", target: null, reward_type: "goodie", reward_amount: 0, active: true, paused: false, sort: 6 },
];

export const SOCIAL_PLATFORMS = [
  { key: "youtube", label: "YouTube", color: "bg-red-600" },
  { key: "instagram", label: "Instagram", color: "bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600" },
  { key: "facebook", label: "Facebook", color: "bg-blue-600" },
  { key: "linkedin", label: "LinkedIn", color: "bg-sky-700" },
] as const;

export const MENTOR_DOMAINS = ["UVM", "SystemVerilog", "Physical Design", "DFT", "Analog Layout", "RTL Design", "STA", "Verilog / Digital Design"];

export const rewardText = (s: Pick<RewardSetting, "reward_type" | "reward_amount">) =>
  s.reward_type === "amount" ? `₹${Number(s.reward_amount).toLocaleString("en-IN")}` : s.reward_type === "goodie" ? "Goodie" : s.reward_type === "mentorship" ? "Mentorship" : "—";
