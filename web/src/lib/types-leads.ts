/** Lead Management 360°: stages, allocation, counsellor tasks and the daily report. */
import type { LeadStage } from "./types-crm";

export const LEAD_STAGES: { key: LeadStage; label: string; head: string; bar: string; closed?: boolean }[] = [
  { key: "lead", label: "New lead", head: "text-slate-700", bar: "border-t-slate-500" },
  { key: "non_connected", label: "Non-connected", head: "text-red-700", bar: "border-t-red-600" },
  { key: "connected", label: "Connected", head: "text-blue-700", bar: "border-t-blue-600" },
  { key: "interested", label: "Interested", head: "text-emerald-700", bar: "border-t-emerald-600" },
  { key: "visit_scheduled", label: "Visit scheduled", head: "text-orange-700", bar: "border-t-orange-500" },
  { key: "visited", label: "Visited", head: "text-teal-700", bar: "border-t-teal-600" },
  { key: "admission_pending", label: "Admission pending", head: "text-violet-700", bar: "border-t-violet-600" },
  { key: "enrolled", label: "Converted", head: "text-green-800", bar: "border-t-green-700", closed: true },
  { key: "lost", label: "Not interested", head: "text-rose-700", bar: "border-t-rose-500", closed: true },
  { key: "future_follow_up", label: "Future follow-up", head: "text-indigo-700", bar: "border-t-indigo-600" },
];
export const stageLabel = (s: string) => LEAD_STAGES.find((x) => x.key === s)?.label ?? s;
export const OPEN_STAGES = LEAD_STAGES.filter((s) => !s.closed).map((s) => s.key);

/** Follow-up outcome → the stage the lead moves to. */
export const FOLLOW_UP_OUTCOMES: { key: string; label: string; stage: LeadStage; needsDate: boolean }[] = [
  { key: "connected", label: "Connected — discussed", stage: "connected", needsDate: true },
  { key: "non_connected", label: "Not connected (no answer / switched off)", stage: "non_connected", needsDate: true },
  { key: "interested", label: "Interested", stage: "interested", needsDate: true },
  { key: "visit_scheduled", label: "Visit scheduled", stage: "visit_scheduled", needsDate: true },
  { key: "visited", label: "Visited the institute", stage: "visited", needsDate: true },
  { key: "admission_pending", label: "Admission pending (fee / documents)", stage: "admission_pending", needsDate: true },
  { key: "future_follow_up", label: "Future follow-up (later intake)", stage: "future_follow_up", needsDate: true },
  { key: "lost", label: "Not interested — close lead", stage: "lost", needsDate: false },
];

export type LeadPriority = "low" | "normal" | "high" | "urgent";
export const LEAD_PRIORITIES: [LeadPriority, string][] = [["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"], ["low", "Low"]];
export const PRIORITY_TONE: Record<LeadPriority, "slate" | "blue" | "amber" | "red"> = { low: "slate", normal: "blue", high: "amber", urgent: "red" };

export interface LeadTask {
  id: string;
  lead_id: string;
  assigned_to: string;
  title: string;
  due_at?: string | null;
  priority: LeadPriority;
  status: "pending" | "completed" | "cancelled";
  completed_at?: string | null;
  completed_by?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type AllocationMode = "individual" | "bulk" | "stage" | "reallocation" | "upload";
export interface LeadAllocation {
  id: string;
  lead_id: string;
  from_staff?: string | null;
  to_staff: string;
  stage?: string | null;
  deadline?: string | null;
  priority: LeadPriority;
  instructions?: string | null;
  mode: AllocationMode;
  allocated_by?: string | null;
  created_at: string;
}

export interface LeadSettings { id: number; report_time: string; report_email?: string | null; attend_hours: number; updated_at?: string }

export interface CounsellorDay {
  name: string;
  allocated: number;
  attended: number;
  pending: number;
  connected: number;
  non_connected: number;
  interested: number;
  scheduled: number;
  visited: number;
  converted: number;
}
export interface DailyLeadReport { date: string; rows: CounsellorDay[]; total: CounsellorDay; completion: number }
export interface LeadDailyReportRow { report_date: string; data: DailyLeadReport; created_at?: string }
