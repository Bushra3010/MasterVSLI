import "server-only";
import { istDate } from "./format";
import { createCrmRepo } from "./repo-crm";
import type { Store } from "./store/types";
import type {
  AllocationMode,
  CounsellorDay,
  DailyLeadReport,
  Lead,
  LeadActivity,
  LeadAllocation,
  LeadDailyReportRow,
  LeadPriority,
  LeadSettings,
  LeadStage,
  LeadTask,
  Staff,
  Student,
} from "./types";
import { FOLLOW_UP_OUTCOMES } from "./types-leads";

/** Last 10 digits — "+91 90000 00001", "09000000001" and "9000000001" are the same number. */
export const normPhone = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
const IST = (iso: string) => istDate(iso);

export function createLeadRepo(db: Store) {
  const crm = createCrmRepo(db);
  const repo = {
    leads: (opts: { archived?: boolean } = {}) =>
      db.select<Lead>("leads", { order: { column: "created_at", ascending: false } }).then((r) => r.filter((l) => Boolean(l.archived) === Boolean(opts.archived))),
    activities: () => db.select<LeadActivity>("lead_activities", { order: { column: "created_at", ascending: false } }),
    tasks: (assigned_to?: string) => db.select<LeadTask>("lead_tasks", { ...(assigned_to ? { eq: { assigned_to } } : {}), order: { column: "due_at" } }),
    allocations: () => db.select<LeadAllocation>("lead_allocations", { order: { column: "created_at", ascending: false } }),

    /** Active counsellors; until anyone is marked as a counsellor, every active staff member can take leads. */
    async counsellors(): Promise<Staff[]> {
      const staff = (await db.select<Staff>("staff", { order: { column: "full_name" } })).filter((s) => s.active !== false);
      const marked = staff.filter((s) => s.counsellor);
      return marked.length ? marked : staff;
    },

    /** Same mobile number among other leads and registered students. */
    async duplicatesOf(phone?: string | null, excludeId?: string) {
      const n = normPhone(phone);
      if (n.length < 10) return { leads: [] as Lead[], students: [] as Student[] };
      const [leads, students] = await Promise.all([db.select<Lead>("leads"), db.select<Student>("students")]);
      return {
        leads: leads.filter((l) => l.id !== excludeId && normPhone(l.phone) === n),
        students: students.filter((s) => normPhone(s.phone) === n || normPhone(s.alt_phone) === n),
      };
    },

    /** All duplicate groups: leads sharing a number, and leads whose number belongs to a registered student. */
    async duplicateGroups() {
      const [leads, students] = await Promise.all([repo.leads(), db.select<Student>("students")]);
      const by = new Map<string, Lead[]>();
      for (const l of leads) {
        const n = normPhone(l.phone);
        if (n.length === 10) by.set(n, [...(by.get(n) ?? []), l]);
      }
      const studentsBy = new Map(students.flatMap((s) => [normPhone(s.phone), normPhone(s.alt_phone)].filter((n) => n.length === 10).map((n) => [n, s] as const)));
      return [...by.entries()]
        .map(([phone, ls]) => ({ phone, leads: ls.sort((a, b) => a.created_at.localeCompare(b.created_at)), student: studentsBy.get(phone) }))
        .filter((g) => g.leads.length > 1 || g.student);
    },

    async create(l: Partial<Lead>, by: string, opts: { allowDuplicate?: boolean } = {}): Promise<{ ok: true; lead: Lead } | { ok: false; duplicate: Lead | null; student: Student | null }> {
      const dup = await repo.duplicatesOf(l.phone);
      if (!opts.allowDuplicate && (dup.leads.length || dup.students.length))
        return { ok: false, duplicate: dup.leads[0] ?? null, student: dup.students[0] ?? null };
      const lead = await crm.createLead({ ...l, assigned_to: l.assigned_to || null });
      await crm.addLeadActivity(lead.id, "created", `Lead created (${l.source ?? "manual"})`, null, by);
      if (l.assigned_to) await repo.allocate([lead.id], { to: l.assigned_to }, { mode: "individual" }, by);
      return { ok: true, lead };
    },

    /** Allocate leads to one counsellor, or round-robin across active counsellors (least loaded first). */
    async allocate(ids: string[], target: { to?: string; roundRobin?: boolean }, opts: { deadline?: string | null; priority?: LeadPriority; instructions?: string | null; mode: AllocationMode }, by: string) {
      if (!ids.length) return 0;
      const [leads, counsellors, open] = await Promise.all([db.select<Lead>("leads"), repo.counsellors(), repo.tasks()]);
      const load = new Map(counsellors.map((c) => [c.full_name, open.filter((t) => t.assigned_to === c.full_name && t.status === "pending").length]));
      const now = new Date().toISOString();
      let n = 0;
      for (const id of ids) {
        const lead = leads.find((l) => l.id === id);
        if (!lead || lead.archived) continue;
        let to = target.to;
        if (target.roundRobin) {
          to = [...load.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]?.[0];
          if (to) load.set(to, (load.get(to) ?? 0) + 1);
        }
        if (!to) continue;
        const mode: AllocationMode = lead.assigned_to && lead.assigned_to !== to && opts.mode === "individual" ? "reallocation" : opts.mode;
        await db.insert<LeadAllocation>("lead_allocations", [{ lead_id: id, from_staff: lead.assigned_to ?? null, to_staff: to, stage: lead.stage, deadline: opts.deadline ?? null, priority: opts.priority ?? "normal", instructions: opts.instructions ?? null, mode, allocated_by: by, created_at: now }]);
        await db.update<Lead>("leads", { id }, { assigned_to: to, priority: opts.priority ?? "normal", allocation_deadline: opts.deadline ?? null, allocation_note: opts.instructions ?? null, allocated_at: now, allocated_by: by });
        // Pending tasks move with the lead to the new counsellor.
        for (const t of open.filter((t) => t.lead_id === id && t.status === "pending")) await db.update<LeadTask>("lead_tasks", { id: t.id }, { status: "cancelled", remarks: `Reallocated to ${to}` });
        await db.insert<LeadTask>("lead_tasks", [{ lead_id: id, assigned_to: to, title: opts.instructions ? `Follow up: ${opts.instructions}` : "Follow up with the new lead", due_at: opts.deadline ?? null, priority: opts.priority ?? "normal", status: "pending", created_by: by, created_at: now }]);
        await crm.addLeadActivity(id, "allocation", `${mode === "reallocation" ? `Reallocated from ${lead.assigned_to} to` : "Allocated to"} ${to}${opts.instructions ? ` — ${opts.instructions}` : ""}`, null, by);
        n++;
      }
      return n;
    },

    /** A follow-up needs conversation remarks and the next action; it moves the stage and closes the task. */
    async completeFollowUp(leadId: string, input: { outcome: string; remarks: string; nextAction?: string; nextAt?: string | null; taskId?: string | null }, by: string) {
      const out = FOLLOW_UP_OUTCOMES.find((o) => o.key === input.outcome);
      if (!out) throw new Error("Choose the outcome of the conversation");
      if (input.remarks.trim().length < 5) throw new Error("Write the conversation remarks");
      if (out.needsDate && (!input.nextAction?.trim() || !input.nextAt)) throw new Error("Add the next action and its date");
      const [lead] = await db.select<Lead>("leads", { eq: { id: leadId } });
      if (!lead) throw new Error("Lead not found");
      const now = new Date().toISOString();
      await crm.addLeadActivity(leadId, "follow_up", input.remarks.trim().slice(0, 2000), out.key, by);
      if (lead.stage !== out.stage) await crm.moveLead(leadId, out.stage, by);
      await db.update<Lead>("leads", { id: leadId }, { next_follow_up: out.needsDate ? input.nextAt : null, follow_up_note: out.needsDate ? input.nextAction!.trim().slice(0, 300) : null });
      const tasks = (await repo.tasks()).filter((t) => t.lead_id === leadId && t.status === "pending" && (!input.taskId || t.id === input.taskId));
      for (const t of tasks) await db.update<LeadTask>("lead_tasks", { id: t.id }, { status: "completed", completed_at: now, completed_by: by, remarks: input.remarks.trim().slice(0, 500) });
      if (out.needsDate) await db.insert<LeadTask>("lead_tasks", [{ lead_id: leadId, assigned_to: lead.assigned_to || by, title: input.nextAction!.trim().slice(0, 200), due_at: input.nextAt, priority: lead.priority ?? "normal", status: "pending", created_by: by, created_at: now }]);
    },

    /** Completing a task does not close the lead. */
    completeTask: (id: string, by: string, remarks: string) => db.update<LeadTask>("lead_tasks", { id }, { status: "completed", completed_at: new Date().toISOString(), completed_by: by, remarks }),

    async archive(id: string, reason: string, by: string) {
      await db.update<Lead>("leads", { id }, { archived: true, archived_at: new Date().toISOString(), archive_reason: reason });
      for (const t of (await repo.tasks()).filter((t) => t.lead_id === id && t.status === "pending")) await db.update<LeadTask>("lead_tasks", { id: t.id }, { status: "cancelled", remarks: "Lead archived" });
      await crm.addLeadActivity(id, "archive", `Archived — ${reason}`, null, by);
    },
    async restore(id: string, by: string) {
      await db.update<Lead>("leads", { id }, { archived: false, archived_at: null, archive_reason: null });
      await crm.addLeadActivity(id, "archive", "Restored from archive", null, by);
    },
    /** Keep the older lead; the duplicate is archived and points to it. History stays on both. */
    async mergeDuplicate(dupId: string, keepId: string, by: string) {
      if (dupId === keepId) return;
      await db.update<Lead>("leads", { id: dupId }, { duplicate_of: keepId });
      await repo.archive(dupId, "Duplicate", by);
      await crm.addLeadActivity(keepId, "note", `Duplicate lead merged into this one`, null, by);
    },

    async settings(): Promise<LeadSettings> {
      return (await db.select<LeadSettings>("lead_settings", { eq: { id: 1 } }))[0] ?? { id: 1, report_time: "20:30", report_email: null, attend_hours: 24 };
    },
    async saveSettings(patch: Partial<LeadSettings>) {
      if ((await db.select<LeadSettings>("lead_settings", { eq: { id: 1 } })).length) await db.update<LeadSettings>("lead_settings", { id: 1 }, { ...patch, updated_at: new Date().toISOString() });
      else await db.insert<LeadSettings>("lead_settings", [{ id: 1, report_time: "20:30", attend_hours: 24, ...patch }]);
    },

    /** Counsellor-wise activity for one India date. */
    async dailyReport(date: string): Promise<DailyLeadReport> {
      const [allocs, acts, leads, counsellors] = await Promise.all([repo.allocations(), repo.activities(), db.select<Lead>("leads"), repo.counsellors()]);
      return buildDailyReport(date, allocs, acts, leads, counsellors.map((c) => c.full_name));
    },
    savedReports: () => db.select<LeadDailyReportRow>("lead_daily_reports", { order: { column: "report_date", ascending: false }, limit: 30 }),
    saveReport: (r: DailyLeadReport) => db.upsert<LeadDailyReportRow>("lead_daily_reports", [{ report_date: r.date, data: r, created_at: new Date().toISOString() }], "report_date"),
  };
  return repo;
}
export type LeadRepo = ReturnType<typeof createLeadRepo>;

const blank = (name: string): CounsellorDay => ({ name, allocated: 0, attended: 0, pending: 0, connected: 0, non_connected: 0, interested: 0, scheduled: 0, visited: 0, converted: 0 });

export function buildDailyReport(date: string, allocs: LeadAllocation[], acts: LeadActivity[], leads: Lead[], counsellors: string[]): DailyLeadReport {
  const rows = new Map<string, CounsellorDay>(counsellors.map((n) => [n, blank(n)]));
  const row = (n: string) => rows.get(n) ?? rows.set(n, blank(n)).get(n)!;
  const owner = new Map(leads.map((l) => [l.id, l.assigned_to ?? ""]));
  const dayActs = acts.filter((a) => IST(a.created_at) === date);
  const worked = (lead: string, who: string, after: string) =>
    acts.some((a) => a.lead_id === lead && a.by_name === who && a.kind !== "allocation" && a.kind !== "created" && a.created_at >= after && IST(a.created_at) === date);
  for (const a of allocs.filter((x) => IST(x.created_at) === date)) {
    const r = row(a.to_staff);
    r.allocated++;
    if (worked(a.lead_id, a.to_staff, a.created_at)) r.attended++;
  }
  for (const a of dayActs) {
    const who = a.by_name || owner.get(a.lead_id) || "";
    if (!who) continue;
    if (a.kind === "follow_up") {
      if (a.outcome === "non_connected") row(who).non_connected++;
      else row(who).connected++;
    }
    if (a.kind === "stage") {
      const s = a.outcome as LeadStage;
      if (s === "interested") row(who).interested++;
      if (s === "visit_scheduled") row(who).scheduled++;
      if (s === "visited") row(who).visited++;
      if (s === "enrolled") row(who).converted++;
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, pending: Math.max(0, r.allocated - r.attended) }));
  const total = list.reduce((t, r) => {
    for (const k of Object.keys(t) as (keyof CounsellorDay)[]) if (k !== "name") (t[k] as number) += r[k] as number;
    return t;
  }, blank("Total"));
  return { date, rows: list, total, completion: total.allocated ? Math.round((total.attended / total.allocated) * 1000) / 10 : 0 };
}

export { parseCsv } from "./csv";

/** Plain-text daily report for the super admin's email. */
export function reportText(r: DailyLeadReport) {
  const cols: (keyof CounsellorDay)[] = ["allocated", "attended", "pending", "connected", "non_connected", "interested", "scheduled", "visited", "converted"];
  const line = (x: CounsellorDay) => `${x.name.padEnd(16)} ${cols.map((c) => String(x[c]).padStart(5)).join(" ")}`;
  return [
    `MasterVLSI — Daily Lead Management Report, ${r.date}`,
    "",
    `${"Counsellor".padEnd(16)} ${["Alloc", "Attnd", "Pend", "Conn", "NConn", "Intr", "Sched", "Visit", "Conv"].map((h) => h.padStart(5)).join(" ")}`,
    ...r.rows.map(line),
    line(r.total),
    "",
    `Daily allocated lead completion: ${r.completion}%`,
  ].join("\n");
}

/**
 * Hourly job: once the configured time (default 8:30 PM India time) has passed, build today's report,
 * save it, and email it to the configured address. Runs at most once per day.
 */
export async function runDailyLeadReport(db: Store, nowMs: number) {
  const repo = createLeadRepo(db);
  const settings = await repo.settings();
  const ist = new Date(nowMs + 330 * 60_000).toISOString();
  const date = ist.slice(0, 10);
  if (ist.slice(11, 16) < settings.report_time) return { report: "not yet" as const };
  if ((await db.select<LeadDailyReportRow>("lead_daily_reports", { eq: { report_date: date } })).length) return { report: "already sent" as const };
  const r = await repo.dailyReport(date);
  await repo.saveReport(r);
  let emailed = false;
  if (settings.report_email) {
    const { emailConfigured, sendEmail } = await import("./messaging");
    if (emailConfigured()) emailed = await sendEmail(settings.report_email, `Daily Lead Report — ${date}`, reportText(r)).then(() => true).catch(() => false);
  }
  return { report: "generated" as const, date, emailed };
}
