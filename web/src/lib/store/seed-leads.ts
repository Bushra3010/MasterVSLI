import type { Lead } from "../types";
import type { LeadAllocation, LeadDailyReportRow, LeadSettings, LeadTask } from "../types-leads";

export interface LeadTables {
  lead_tasks: LeadTask[];
  lead_allocations: LeadAllocation[];
  lead_settings: LeadSettings[];
  lead_daily_reports: LeadDailyReportRow[];
}

/** Every assigned demo lead has its allocation and, while open, a pending follow-up task. */
export function buildLeadSeed(leads: Lead[]): LeadTables {
  const assigned = leads.filter((l) => l.assigned_to);
  return {
    lead_allocations: assigned.map((l) => ({
      id: `la-al-${l.id}`, lead_id: l.id, from_staff: null, to_staff: l.assigned_to!, stage: "lead", deadline: null, priority: "normal",
      instructions: null, mode: "individual", allocated_by: "Demo Admin", created_at: l.created_at,
    })),
    lead_tasks: assigned
      .filter((l) => l.stage !== "enrolled" && l.stage !== "lost")
      .map((l) => ({
        id: `lt-${l.id}`, lead_id: l.id, assigned_to: l.assigned_to!, title: l.follow_up_note ?? "Follow up", due_at: l.next_follow_up ?? null,
        priority: "normal", status: "pending", created_by: "Demo Admin", created_at: l.created_at,
      })),
    lead_settings: [{ id: 1, report_time: "20:30", report_email: null, attend_hours: 24 }],
    lead_daily_reports: [],
  };
}
