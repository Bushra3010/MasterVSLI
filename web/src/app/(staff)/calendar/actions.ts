"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCalendarRepo } from "@/lib/calendar";
import { getStore, requireStaff } from "@/lib/session";
import { CALENDAR_CATEGORIES, type CalendarEvent, type CalendarPriority, istToUtc, type ReminderChannel, type ReminderKind } from "@/lib/types-calendar";

const repo = async () => createCalendarRepo(await getStore());
const t = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

/** Where to land after an action: back to the same view/date (passed as hidden "back"). */
function back(form: FormData, extra = "") {
  const b = t(form, "back");
  const url = b.startsWith("/calendar") ? b : "/calendar";
  return url + (extra ? (url.includes("?") ? "&" : "?") + extra : "");
}

export async function saveEventAction(form: FormData) {
  const me = await requireStaff();
  const title = t(form, "title");
  const date = t(form, "date");
  if (!title) throw new Error("Enter a title");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 2000 || Number(date.slice(0, 4)) > 2100) throw new Error("Pick a valid date");
  const start = t(form, "start_time");
  const end = t(form, "end_time");
  const allDay = !start || form.get("all_day") === "on";
  if (!allDay && end && end <= start) throw new Error("End time must be after the start time");
  const category = t(form, "category");
  const priority = t(form, "priority") as CalendarPriority;
  const reminders = form.getAll("reminders").map(String).filter((r): r is ReminderKind => ["1d", "same_day", "1h"].includes(r));
  const channels = form.getAll("channels").map(String).filter((c): c is ReminderChannel => ["dashboard", "whatsapp", "email"].includes(c));
  const id = t(form, "id") || undefined;
  const patch: Partial<CalendarEvent> = {
    id,
    title,
    description: t(form, "description") || null,
    category: category in CALENDAR_CATEGORIES ? category : "other",
    priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
    start_at: istToUtc(date, allDay ? null : start),
    end_at: !allDay && end ? istToUtc(date, end) : null,
    all_day: allDay,
    assignee_id: t(form, "assignee_id") || null,
    location: t(form, "location") || null,
    reminders,
    channels: channels.length ? channels : ["dashboard"],
  };
  const r = await repo();
  if (id) {
    // A new time means the reminders should fire again.
    const old = await r.event(id);
    if (old && old.start_at !== patch.start_at) patch.reminders_sent = [];
  } else patch.created_by = me.email ?? me.name;
  const saved = await r.save(patch);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(back(form, `saved=${id ? "updated" : "added"}&event=${saved}`));
}

export async function setEventDoneAction(id: string, done: boolean, form: FormData) {
  const me = await requireStaff();
  await (await repo()).setDone(id, done, me.name);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(back(form, `saved=${done ? "done" : "reopened"}`));
}

export async function deleteEventAction(id: string, form: FormData) {
  await requireStaff();
  await (await repo()).remove(id);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  redirect(back(form, "saved=deleted"));
}
