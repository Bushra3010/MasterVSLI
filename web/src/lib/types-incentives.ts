/** HR incentives: commission rules, ledger, targets and milestones. */

export type IncentiveMetric = "admissions" | "reviews" | "feedback_videos" | "video_views" | "interviews" | "tieups";
export type CommissionStatus = "pending" | "approved" | "paid" | "rejected";

export interface CommissionRule {
  key: string;
  label: string;
  amount: number;
  unit: string;
  metric?: IncentiveMetric | null;
  kind: "auto" | "activity" | "milestone";
  threshold?: number | null;
  loggable: boolean;
  active: boolean;
  sort: number;
  updated_at?: string;
}

export interface Commission {
  id: string;
  staff_id: string;
  rule_key: string;
  label: string;
  quantity: number;
  amount: number;
  category?: "normal" | "college" | "corporate" | null;
  ref_id?: string | null;
  ref_label?: string | null;
  occurred_on: string;
  status: CommissionStatus;
  proof_url?: string | null;
  note?: string | null;
  created_by?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
}

export interface HrTarget {
  id: string;
  staff_id?: string | null;
  month?: string | null;
  metric: IncentiveMetric;
  target: number;
}

export const METRICS: { key: IncentiveMetric; label: string; unit: string }[] = [
  { key: "admissions", label: "Admissions", unit: "students" },
  { key: "reviews", label: "Reviews", unit: "reviews" },
  { key: "feedback_videos", label: "Feedback videos", unit: "videos" },
  { key: "video_views", label: "Video views", unit: "views" },
  { key: "interviews", label: "Interviews scheduled", unit: "interviews" },
  { key: "tieups", label: "College / corporate tie-ups", unit: "tie-ups" },
];

export const DEFAULT_TARGETS: Record<IncentiveMetric, number> = { admissions: 40, reviews: 50, feedback_videos: 50, video_views: 10000, interviews: 15, tieups: 5 };

/** Same defaults as the migration. */
export const DEFAULT_RULES: CommissionRule[] = [
  { key: "lead_interested", label: "Lead → Interested", amount: 300, unit: "per lead", metric: null, kind: "auto", loggable: false, active: true, sort: 1 },
  { key: "interested_visited", label: "Interested → Visited", amount: 300, unit: "per lead", metric: null, kind: "auto", loggable: false, active: true, sort: 2 },
  { key: "visited_admission", label: "Visited → Admission", amount: 400, unit: "per student", metric: "admissions", kind: "auto", loggable: false, active: true, sort: 3 },
  { key: "admission_individual", label: "Individual admission (Normal / College / Corporate)", amount: 1000, unit: "per student", metric: "admissions", kind: "activity", loggable: true, active: true, sort: 4 },
  { key: "admission_bulk", label: "Bulk admission (College / Corporate)", amount: 500, unit: "per student", metric: "admissions", kind: "activity", loggable: true, active: true, sort: 5 },
  { key: "review", label: "Student review (internal)", amount: 10, unit: "per review", metric: "reviews", kind: "activity", loggable: true, active: true, sort: 6 },
  { key: "feedback_video", label: "Feedback video (student)", amount: 10, unit: "per video", metric: "feedback_videos", kind: "activity", loggable: true, active: true, sort: 7 },
  { key: "video_views", label: "Video views", amount: 0, unit: "per view", metric: "video_views", kind: "activity", loggable: true, active: true, sort: 8 },
  { key: "interview", label: "Interview scheduled", amount: 100, unit: "per interview", metric: "interviews", kind: "activity", loggable: true, active: true, sort: 9 },
  { key: "college_tieup", label: "College tie-up / MoU", amount: 0, unit: "admin configurable", metric: "tieups", kind: "activity", loggable: true, active: true, sort: 10 },
  { key: "corporate_training", label: "Corporate training tie-up – admission", amount: 1000, unit: "per student", metric: "admissions", kind: "activity", loggable: true, active: true, sort: 11 },
  { key: "corporate_placement", label: "Corporate placement tie-up", amount: 100, unit: "per placed student", metric: "tieups", kind: "activity", loggable: true, active: true, sort: 12 },
  { key: "milestone_reviews", label: "Milestone: 50 reviews", amount: 500, unit: "extra incentive", metric: "reviews", kind: "milestone", threshold: 50, loggable: false, active: true, sort: 13 },
  { key: "milestone_videos", label: "Milestone: 50 feedback videos", amount: 500, unit: "extra incentive", metric: "feedback_videos", kind: "milestone", threshold: 50, loggable: false, active: true, sort: 14 },
  { key: "milestone_views", label: "Milestone: 10,000 video views", amount: 100, unit: "extra incentive", metric: "video_views", kind: "milestone", threshold: 10000, loggable: false, active: true, sort: 15 },
];

/** Admission-type choices on the admission form (credited to the chosen HR). */
export const ADMISSION_COMMISSION: [string, string][] = [
  ["", "No commission"],
  ["admission_individual", "Individual admission"],
  ["admission_bulk", "Bulk admission (college / corporate)"],
  ["corporate_training", "Corporate training tie-up"],
];

/** Groups for the commission breakdown chart. */
export const BREAKDOWN: { key: string; label: string; color: string; rules: string[] }[] = [
  { key: "admissions", label: "Admissions", color: "#a855f7", rules: ["lead_interested", "interested_visited", "visited_admission", "admission_individual", "admission_bulk", "corporate_training"] },
  { key: "reviews", label: "Reviews", color: "#3b82f6", rules: ["review", "milestone_reviews"] },
  { key: "feedback_videos", label: "Feedback videos", color: "#22c55e", rules: ["feedback_video", "milestone_videos"] },
  { key: "video_views", label: "Video views", color: "#eab308", rules: ["video_views", "milestone_views"] },
  { key: "interviews", label: "Interviews", color: "#f97316", rules: ["interview"] },
  { key: "tieups", label: "Tie-ups", color: "#06b6d4", rules: ["college_tieup", "corporate_placement"] },
];

export const STATUS_TONE: Record<CommissionStatus, "amber" | "green" | "blue" | "red"> = { pending: "amber", approved: "green", paid: "blue", rejected: "red" };
