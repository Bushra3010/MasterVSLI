import { addDays } from "../format";
import type { Staff } from "../types";
import { type CalendarEvent, istToUtc } from "../types-calendar";

export interface CalendarTables {
  calendar_events: CalendarEvent[];
}

export function buildCalendarSeed(today: string, staff: Staff[]): CalendarTables {
  const [a, b, c] = staff.map((s) => s.id);
  const ev = (id: string, day: number, time: string | null, rest: Partial<CalendarEvent>): CalendarEvent => ({
    id,
    title: "",
    category: "task",
    priority: "medium",
    start_at: istToUtc(addDays(today, day), time),
    all_day: !time,
    reminders: ["1d", "1h"],
    channels: ["dashboard"],
    reminders_sent: [],
    done: false,
    created_by: "admin@mastervlsi.example",
    created_at: addDays(today, -3) + "T05:00:00Z",
    ...rest,
  });
  return {
    calendar_events: [
      ev("cal-1", 0, "10:00", { title: "HR meeting", category: "hr", priority: "high", assignee_id: a, end_at: istToUtc(today, "11:00"), location: "Conference room" }),
      ev("cal-2", 0, "15:30", { title: "Student joining follow-up", category: "admission", linked_label: "Student · Rahul Kumar", assignee_id: b, channels: ["dashboard", "whatsapp"] }),
      ev("cal-3", 1, "09:30", { title: "Interview drive – Wipro", category: "placement", priority: "high", assignee_id: c, reminders: ["1d", "same_day", "1h"], channels: ["dashboard", "email"] }),
      ev("cal-4", 3, null, { title: "Student fee collection", category: "payment_collection", assignee_id: b, reminders: ["same_day"] }),
      ev("cal-5", -1, "11:00", { title: "Vendor payment (ABC Tech)", category: "payment_outgoing", priority: "high", assignee_id: a }),
      ev("cal-6", -2, "14:00", { title: "MoU renewal with ABC College", category: "college", assignee_id: c, done: true, done_at: addDays(today, -2) + "T10:00:00Z", done_by: "Imran Sheikh" }),
      ev("cal-7", 6, "11:00", { title: "College / TPO visit", category: "college", priority: "urgent", assignee_id: b, location: "Partner college" }),
    ],
  };
}
