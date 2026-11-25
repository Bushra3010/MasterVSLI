/** Staff Calendar & Reminders. Times are stored as UTC timestamps and shown in India time. */

export type CalendarPriority = "low" | "medium" | "high";
export type ReminderKind = "1d" | "same_day" | "1h";
export type ReminderChannel = "dashboard" | "whatsapp" | "email";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  priority: CalendarPriority;
  start_at: string;
  end_at?: string | null;
  all_day: boolean;
  assignee_id?: string | null;
  location?: string | null;
  reminders: ReminderKind[];
  channels: ReminderChannel[];
  reminders_sent: ReminderKind[];
  done: boolean;
  done_at?: string | null;
  done_by?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Category → label and colour classes (dot, chip). */
export const CALENDAR_CATEGORIES: Record<string, { label: string; dot: string; chip: string }> = {
  meeting: { label: "Meeting", dot: "bg-blue-500", chip: "border-blue-200 bg-blue-50 text-blue-800" },
  class: { label: "Class / session", dot: "bg-violet-500", chip: "border-violet-200 bg-violet-50 text-violet-800" },
  follow_up: { label: "Follow-up call", dot: "bg-amber-500", chip: "border-amber-200 bg-amber-50 text-amber-800" },
  interview: { label: "Interview", dot: "bg-pink-500", chip: "border-pink-200 bg-pink-50 text-pink-800" },
  placement: { label: "Placement drive", dot: "bg-emerald-500", chip: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  fee: { label: "Fee collection", dot: "bg-orange-500", chip: "border-orange-200 bg-orange-50 text-orange-800" },
  task: { label: "Admin task", dot: "bg-slate-500", chip: "border-slate-200 bg-slate-50 text-slate-700" },
  personal: { label: "Personal", dot: "bg-cyan-500", chip: "border-cyan-200 bg-cyan-50 text-cyan-800" },
  other: { label: "Other", dot: "bg-gray-400", chip: "border-gray-200 bg-gray-50 text-gray-700" },
};
export const categoryOf = (c: string) => CALENDAR_CATEGORIES[c] ?? CALENDAR_CATEGORIES.other;

export const PRIORITIES: [CalendarPriority, string][] = [["high", "High"], ["medium", "Medium"], ["low", "Low"]];
export const REMINDER_KINDS: [ReminderKind, string][] = [["1d", "1 day before"], ["same_day", "Same day (9:00 AM)"], ["1h", "1 hour before"]];
export const REMINDER_CHANNELS: [ReminderChannel, string][] = [["dashboard", "Dashboard"], ["whatsapp", "WhatsApp"], ["email", "Email"]];

const IST_MS = 330 * 60_000;

/** "YYYY-MM-DD" + optional "HH:MM" in India time → UTC ISO timestamp. */
export function istToUtc(date: string, time?: string | null) {
  return new Date(`${date}T${time || "00:00"}:00+05:30`).toISOString();
}

/** When a reminder is due, as epoch ms. All-day events use 9:00 AM India time as their "start". */
export function reminderAt(e: Pick<CalendarEvent, "start_at" | "all_day">, kind: ReminderKind) {
  const start = new Date(e.start_at).getTime();
  const istDay = new Date(start + IST_MS).toISOString().slice(0, 10);
  const nineAm = new Date(`${istDay}T09:00:00+05:30`).getTime();
  const ref = e.all_day ? nineAm : start;
  if (kind === "1d") return ref - 24 * 3600_000;
  if (kind === "1h") return ref - 3600_000;
  return Math.min(nineAm, ref);
}

export const reminderLabel = (k: ReminderKind) => REMINDER_KINDS.find(([v]) => v === k)?.[1] ?? k;
