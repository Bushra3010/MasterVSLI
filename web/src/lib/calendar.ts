import "server-only";
import { fmtDate, istTime } from "./format";
import type { Store } from "./store/types";
import type { Staff } from "./types";
import { type CalendarEvent, type ReminderKind, categoryOf, reminderAt, reminderLabel } from "./types-calendar";

const IST_MS = 330 * 60_000;
/** A reminder is still worth sending for this long after it fell due (the job runs every hour). */
const SEND_WINDOW_MS = 3 * 3600_000;

export function createCalendarRepo(db: Store) {
  const all = () => db.select<CalendarEvent>("calendar_events", { order: { column: "start_at" } });
  return {
    /** Events starting between two UTC instants (inclusive start, exclusive end). */
    async between(fromUtc: string, toUtc: string) {
      return db.select<CalendarEvent>("calendar_events", { gte: { start_at: fromUtc }, lte: { start_at: toUtc }, order: { column: "start_at" } });
    },
    async event(id: string) {
      return (await db.select<CalendarEvent>("calendar_events", { eq: { id } }))[0] ?? null;
    },
    async save(e: Partial<CalendarEvent>) {
      const now = new Date().toISOString();
      if (e.id) {
        const { id, ...patch } = e;
        await db.update<CalendarEvent>("calendar_events", { id }, { ...patch, updated_at: now });
        return id;
      }
      const [row] = await db.insert<CalendarEvent>("calendar_events", [
        { reminders: [], channels: ["dashboard"], reminders_sent: [], done: false, priority: "medium", category: "task", all_day: false, ...e, created_at: now, updated_at: now },
      ]);
      return row.id;
    },
    remove: (id: string) => db.remove("calendar_events", { id }),
    setDone: (id: string, done: boolean, by: string) =>
      db.update<CalendarEvent>("calendar_events", { id }, { done, done_at: done ? new Date().toISOString() : null, done_by: done ? by : null, updated_at: new Date().toISOString() }),

    /** Open items whose reminder time has arrived (or that are already past), soonest first. */
    async pending(now = Date.now(), assigneeId?: string | null) {
      return (await all())
        .filter((e) => !e.done && (!assigneeId || e.assignee_id === assigneeId))
        .filter((e) => {
          const times = (e.reminders ?? []).map((k) => reminderAt(e, k));
          return times.some((t) => t <= now) || new Date(e.start_at).getTime() <= now;
        })
        .sort((a, b) => a.start_at.localeCompare(b.start_at));
    },
    async recentlyCompleted(limit = 8) {
      return (await all()).filter((e) => e.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")).slice(0, limit);
    },

    /**
     * WhatsApp / email reminders for the hourly job. Each reminder goes out once; ones more than
     * 3 hours late are marked as skipped rather than sent, so a paused job never floods people.
     */
    async sendDue(staff: Staff[], now = Date.now()) {
      const { emailConfigured, sendEmail, sendWhatsApp, waNumber, whatsappConfigured } = await import("./messaging");
      const out = { sent: 0, skipped: 0, failed: 0, not_configured: 0 };
      for (const e of await all()) {
        if (e.done) continue;
        const due = (e.reminders ?? []).filter((k) => !(e.reminders_sent ?? []).includes(k) && reminderAt(e, k) <= now);
        if (!due.length) continue;
        const who = staff.find((s) => s.id === e.assignee_id);
        for (const kind of due) {
          if (now - reminderAt(e, kind) > SEND_WINDOW_MS) {
            out.skipped++;
            continue;
          }
          const text = reminderText(e, kind, who?.full_name);
          if (e.channels.includes("whatsapp")) {
            const to = waNumber(who?.phone);
            if (!whatsappConfigured() || !to) out.not_configured++;
            else await sendWhatsApp(to, text).then(() => out.sent++, () => out.failed++);
          }
          if (e.channels.includes("email")) {
            const to = who?.email ?? e.created_by;
            if (!emailConfigured() || !to) out.not_configured++;
            else await sendEmail(to, `Reminder: ${e.title}`, text).then(() => out.sent++, () => out.failed++);
          }
        }
        await db.update<CalendarEvent>("calendar_events", { id: e.id }, { reminders_sent: [...(e.reminders_sent ?? []), ...due] });
      }
      return out;
    },
  };
}
/** Current time; a function so server components can read the clock once per request. */
export const nowMs = () => Date.now();

export type CalendarRepo = ReturnType<typeof createCalendarRepo>;

export function whenText(e: Pick<CalendarEvent, "start_at" | "end_at" | "all_day">) {
  const day = fmtDate(new Date(new Date(e.start_at).getTime() + IST_MS).toISOString().slice(0, 10));
  if (e.all_day) return `${day} · all day`;
  return `${day} · ${istTime(e.start_at)}${e.end_at ? `–${istTime(e.end_at)}` : ""}`;
}

export function reminderText(e: CalendarEvent, kind: ReminderKind, name?: string | null) {
  return `${name ? `Hi ${name.split(" ")[0]}, ` : ""}reminder (${reminderLabel(kind).toLowerCase()}): ${e.title} — ${categoryOf(e.category).label}, ${whenText(e)}${e.location ? ` at ${e.location}` : ""}. Priority: ${e.priority}.${e.description ? `\n${e.description}` : ""}\n— MasterVLSI ERP`;
}
