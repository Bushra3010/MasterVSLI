import "server-only";
import type { Store } from "./store/types";
import type { Drive, DriveResponse, HrCall, HrContact, HrRequirement, StudentApplication } from "./types";
import type {
  HrActivity, HrContribution, HrDriveTask, HrFeedback, HrSubmission, PipelineCounts, StaffDayStats,
} from "./types-hr";

const day = 86_400_000;
const shift = (iso: string, days: number) => new Date(Date.parse(iso + "T00:00:00Z") + days * day).toISOString().slice(0, 10);
const dateOf = (iso?: string | null) => (iso ? iso.slice(0, 10) : null);

/** §11 The seven steps the spec lays out, as offsets from the interview date. */
export const SEQUENCE: { step: string; offset: number; title: string; detail: string }[] = [
  { step: "reconfirm", offset: -7, title: "Reconfirm drive with HR", detail: "Collect the JD, vacancies and eligibility." },
  { step: "publish", offset: -5, title: "Review student interest", detail: "Publish the opportunity if it is not already live." },
  { step: "prepare", offset: -3, title: "Check profiles and prepare Excel", detail: "Verify student profiles, resumes and the sheet." },
  { step: "submit", offset: -2, title: "Close interest and submit Excel", detail: "Close interest and send the sheet to the HR." },
  { step: "confirm", offset: -1, title: "Confirm call letters and attendance", detail: "Confirm call letters, venue and who is attending." },
  { step: "interview", offset: 0, title: "Record attendance and interview status", detail: "Log attendance, no-shows and interview outcomes." },
  { step: "results", offset: 1, title: "Follow up for results", detail: "Chase results, selections and offer letters." },
];

/**
 * Build the reminder sequence for a drive. The lead time shifts the first step only;
 * the company's own Excel deadline overrides the generated submit date, because a
 * deadline we were given always beats one we calculated.
 */
export function sequenceFor(drive: Drive): Omit<HrDriveTask, "id" | "status" | "created_at">[] {
  const d = dateOf(drive.drive_date);
  if (!d) return [];
  const lead = drive.reminder_lead_days ?? 7;
  const hardDue = dateOf(drive.excel_due_at);
  return SEQUENCE.map((s) => {
    const generated = shift(d, s.step === "reconfirm" ? -lead : s.offset);
    const useHard = s.step === "submit" && hardDue;
    return {
      drive_id: drive.id,
      hr_id: drive.hr_id ?? null,
      step: s.step,
      title: s.title,
      detail: s.detail,
      due_on: useHard ? hardDue : generated,
      assigned_to: drive.coordinator ?? null,
      hard_deadline: Boolean(useHard),
    };
  });
}

/** §14 The funnel for a set of drives, from interest through to joining. */
export function pipelineFor(driveIds: Set<string>, responses: DriveResponse[], apps: StudentApplication[]): PipelineCounts {
  const rs = responses.filter((r) => driveIds.has(r.drive_id));
  const as = apps.filter((a) => a.drive_id && driveIds.has(a.drive_id));
  const stage = (s: string) => rs.filter((r) => (r.stage ?? "").toLowerCase() === s).length;
  const interested = rs.filter((r) => r.response === "yes").length;
  const shared = rs.filter((r) => r.synced_to_sheet).length;
  const shortlisted = as.filter((a) => ["shortlisted", "selected", "placed"].includes(a.status)).length + stage("shortlisted");
  const attended = stage("attended") || as.filter((a) => a.rounds > 0).length;
  const selected = as.filter((a) => a.status === "selected" || a.status === "placed").length;
  const joined = as.filter((a) => a.status === "placed" && a.doj).length;
  const callLetters = stage("call_letter") || shortlisted;
  return {
    interested, profiles_shared: shared, shortlisted, call_letters: callLetters,
    attended, selected, offered: selected, joined,
    not_shared: Math.max(0, interested - shared),
    no_show: Math.max(0, callLetters - attended),
    not_selected: Math.max(0, attended - selected),
    not_joined: Math.max(0, selected - joined),
  };
}

/** §15 Everything one HR has delivered, across every drive they have run with us. */
export function contributionFor(hrId: string, drives: Drive[], responses: DriveResponse[], apps: StudentApplication[]): HrContribution {
  const mine = drives.filter((d) => d.hr_id === hrId);
  const ids = new Set(mine.map((d) => d.id));
  const p = pipelineFor(ids, responses, apps);
  return {
    drives: mine.length, interested: p.interested, shared: p.profiles_shared, shortlisted: p.shortlisted,
    attended: p.attended, selected: p.selected, offers: p.offered, joined: p.joined,
  };
}

/** §16 A company seen whole: its HRs past and present, its drives, and our alumni inside it. */
export function company360(
  company: string,
  ctx: { contacts: HrContact[]; drives: Drive[]; responses: DriveResponse[]; apps: StudentApplication[] },
) {
  const key = (v?: string | null) => (v ?? "").toLowerCase().split(" ")[0];
  const target = key(company);
  const drives = ctx.drives.filter((d) => key(d.company) === target);
  const ids = new Set(drives.map((d) => d.id));
  const today = new Date().toISOString().slice(0, 10);
  return {
    drives,
    completed: drives.filter((d) => (dateOf(d.drive_date) ?? "") < today).length,
    upcoming: drives.filter((d) => (dateOf(d.drive_date) ?? "") >= today).length,
    pipeline: pipelineFor(ids, ctx.responses, ctx.apps),
    // Alumni are students we placed here, whoever the drive ran through.
    alumni: ctx.apps.filter((a) => a.status === "placed" && key(a.company) === target),
  };
}

/** §18 Activity per staff member over a date range, built from what they actually logged. */
export function dailyReport(
  from: string,
  to: string,
  ctx: { contacts: HrContact[]; calls: HrCall[]; acts: HrActivity[]; reqs: HrRequirement[]; drives: Drive[]; tasks: HrDriveTask[] },
): StaffDayStats[] {
  const names = new Set<string>();
  for (const h of ctx.contacts) if (h.assigned_to) names.add(h.assigned_to);
  for (const c of ctx.calls) if (c.by_name) names.add(c.by_name);
  for (const t of ctx.tasks) if (t.assigned_to) names.add(t.assigned_to);

  const inRange = (iso?: string | null) => { const d = dateOf(iso); return Boolean(d && d >= from && d <= to); };
  const connected = new Set(["connected", "interested", "replied"]);

  return [...names].sort().map((staff) => {
    const calls = ctx.calls.filter((c) => c.by_name === staff && c.call_date.slice(0, 10) >= from && c.call_date.slice(0, 10) <= to);
    const tasks = ctx.tasks.filter((t) => t.assigned_to === staff);
    return {
      staff,
      allocated: ctx.contacts.filter((h) => h.assigned_to === staff).length,
      contacted: calls.length,
      connected: calls.filter((c) => connected.has((c.outcome ?? "").toLowerCase())).length,
      not_connected: calls.filter((c) => !connected.has((c.outcome ?? "").toLowerCase())).length,
      new_hrs: ctx.acts.filter((a) => a.by_name === staff && a.kind === "note" && a.summary.startsWith("HR added") && inRange(a.created_at)).length,
      follow_ups: calls.filter((c) => (c.activity ?? "").toLowerCase().includes("follow")).length,
      requirements: ctx.reqs.filter((r) => r.assigned_to === staff && inRange(r.created_at)).length,
      drives_confirmed: ctx.drives.filter((d) => d.coordinator === staff && d.confirmation === "confirmed").length,
      tasks_done: tasks.filter((t) => t.status === "done" && inRange(t.completed_at)).length,
      tasks_pending: tasks.filter((t) => t.status === "pending").length,
    };
  });
}

export function createHrDriveRepo(db: Store) {
  const repo = {
    tasks: (driveId?: string) =>
      db.select<HrDriveTask>("hr_drive_tasks", { ...(driveId ? { eq: { drive_id: driveId } } : {}), order: { column: "due_on" } }),

    /**
     * Create any missing steps for a drive. Existing steps are left alone so a
     * date someone corrected by hand is not overwritten on the next regeneration.
     */
    async syncSequence(driveId: string) {
      const [drive] = await db.select<Drive>("placement_drives", { eq: { id: driveId } });
      if (!drive) return 0;
      const existing = await db.select<HrDriveTask>("hr_drive_tasks", { eq: { drive_id: driveId } });
      const have = new Set(existing.map((t) => t.step));
      const rows = sequenceFor(drive).filter((t) => !have.has(t.step));
      if (rows.length) await db.insert<HrDriveTask>("hr_drive_tasks", rows.map((r) => ({ ...r, status: "pending" as const, created_at: new Date().toISOString() })));
      return rows.length;
    },

    async completeTask(id: string, by: string) {
      await db.update<HrDriveTask>("hr_drive_tasks", { id }, { status: "done", completed_by: by, completed_at: new Date().toISOString() });
    },

    submissions: (driveId?: string) =>
      db.select<HrSubmission>("hr_submissions", { ...(driveId ? { eq: { drive_id: driveId } } : {}), order: { column: "created_at", ascending: false } }),

    feedback: (hrId?: string) =>
      db.select<HrFeedback>("hr_feedback", { ...(hrId ? { eq: { hr_id: hrId } } : {}), order: { column: "created_at", ascending: false } }),
  };
  return repo;
}
