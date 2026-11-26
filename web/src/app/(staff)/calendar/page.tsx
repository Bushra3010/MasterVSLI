import { AlertCircle, ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Lightbulb, PlusCircle, RotateCcw, Save, Search, User } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { createCalendarRepo, nowMs, whenText } from "@/lib/calendar";
import { addDays, fmtDate, istDate, istTime, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession, getStore } from "@/lib/session";
import type { Client, College } from "@/lib/types";
import {
  type CalendarEvent,
  CATEGORY_MENU,
  categoryOf,
  istToUtc,
  PRIORITIES,
  PRIORITY_PILL,
  priorityLabel,
  REMINDER_CHANNELS,
  REMINDER_KINDS,
  reminderAt,
} from "@/lib/types-calendar";
import { deleteEventAction, saveEventAction, setEventDoneAction } from "./actions";

export const metadata = { title: "Staff Calendar & Reminders" };

type View = "month" | "week" | "day";
type Search = { view?: string; date?: string; who?: string; cat?: string; event?: string; new?: string; saved?: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SAVED: Record<string, string> = { added: "Reminder saved", updated: "Reminder updated", done: "Marked done", reopened: "Reopened", deleted: "Reminder deleted" };
const card = "overflow-hidden rounded-[8px] border border-[#cfdcf2] bg-white shadow-sm";

const dowSun = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay(); // Sunday = 0
const monthStart = (iso: string) => iso.slice(0, 8) + "01";
function shiftMonth(iso: string, n: number) {
  const d = new Date(monthStart(iso) + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
const monthLabel = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortMonth = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
const time12 = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).toUpperCase();

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const today = todayISO();
  const view: View = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  const [me, repo, cal] = await Promise.all([getSession(), getRepo(), getStore().then(createCalendarRepo)]);
  const [staff, students, colleges, clients] = await Promise.all([repo.staff(), repo.students(), repo.list<College>("colleges", { order: { column: "name" } }), repo.list<Client>("clients", { order: { column: "name" } })]);
  const mine = await repo.staffForUser(me?.userId, me?.email);
  const who = sp.who ?? "all";
  const whoId = who === "me" ? (mine?.id ?? "__none__") : who !== "all" ? who : null;

  // Visible range (weeks start on Sunday, as in the calendar layout)
  let from: string, days: number;
  if (view === "month") {
    from = addDays(monthStart(date), -dowSun(monthStart(date)));
    const lastDay = addDays(shiftMonth(date, 1), -1);
    days = Math.ceil((dowSun(monthStart(date)) + Number(lastDay.slice(8))) / 7) * 7;
  } else if (view === "week") {
    from = addDays(date, -dowSun(date));
    days = 7;
  } else {
    from = date;
    days = 1;
  }
  const to = addDays(from, days);
  const now = nowMs();
  const mStart = monthStart(date);
  const mEnd = shiftMonth(date, 1);
  const [inRange, monthEvents, drives, pending, completed, upcomingAll] = await Promise.all([
    cal.between(istToUtc(from), istToUtc(to)),
    cal.between(istToUtc(mStart), istToUtc(mEnd)),
    repo.drives(),
    cal.pending(now, whoId),
    cal.recentlyCompleted(6),
    cal.between(new Date(now).toISOString(), istToUtc(addDays(today, 60))),
  ]);
  const keep = (e: CalendarEvent) => (!whoId || e.assignee_id === whoId) && (!sp.cat || e.category === sp.cat);
  const events = inRange.filter(keep);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(istDate(e.start_at), [...(byDay.get(istDate(e.start_at)) ?? []), e]);
  for (const list of byDay.values()) list.sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start_at.localeCompare(b.start_at));
  const driveDays = new Map<string, typeof drives>();
  if (!sp.cat || sp.cat === "placement")
    for (const d of drives.filter((x) => x.drive_date && x.drive_date >= from && x.drive_date < to && x.status !== "closed"))
      driveDays.set(d.drive_date!, [...(driveDays.get(d.drive_date!) ?? []), d]);

  // Month counters
  const month = monthEvents.filter(keep);
  const isOverdue = (e: CalendarEvent) => !e.done && (e.all_day ? istDate(e.start_at) < today : new Date(e.start_at).getTime() < now);
  const stats = { total: month.length, done: month.filter((e) => e.done).length, overdue: month.filter(isOverdue).length };
  const upcoming = upcomingAll.filter((e) => !e.done && keep(e)).slice(0, 6);
  // Pending list: reminders due now, then everything else still open this month
  const pendingRows = [...pending, ...month.filter((e) => !e.done && !pending.some((p) => p.id === e.id))].sort((a, b) => a.start_at.localeCompare(b.start_at));

  const selected = sp.event ? ((await cal.event(sp.event)) ?? null) : null;
  const staffName = (id?: string | null) => staff.find((s) => s.id === id)?.full_name ?? "Unassigned";
  const linkOptions = [
    ...students.map((s) => `Student · ${s.full_name} (${s.enrollment_no})`),
    ...colleges.map((c) => `College · ${c.name}`),
    ...clients.map((c) => `Company · ${c.name}`),
  ];

  const q = (p: Partial<Search>) => {
    const u = new URLSearchParams();
    const merged = { view, date, who: sp.who, cat: sp.cat, ...p };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "view" && v === "month") && !(k === "who" && v === "all")) u.set(k, v);
    const s = u.toString();
    return `/calendar${s ? `?${s}` : ""}`;
  };
  const here = q({});
  const prev = view === "month" ? shiftMonth(date, -1) : addDays(date, view === "week" ? -7 : -1);
  const next = view === "month" ? shiftMonth(date, 1) : addDays(date, view === "week" ? 7 : 1);
  const title = view === "month" ? monthLabel(date) : view === "week" ? `${fmtDate(from)} – ${fmtDate(addDays(from, 6))}` : dayLabel(date);
  const formDate = sp.new && /^\d{4}-\d{2}-\d{2}$/.test(sp.new) ? sp.new : view === "month" && date === today ? today : date;

  const pill = (className: string, children: ReactNode) => <span className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap ${className}`}>{children}</span>;
  const doneButton = (e: CalendarEvent, label = "Mark Done") => (
    <form action={setEventDoneAction.bind(null, e.id, true)}>
      <input type="hidden" name="back" value={here} />
      <button aria-label={`Mark ${e.title} done`} className="rounded-[6px] bg-[#1a56db] px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap text-white hover:bg-[#1747b8]">{label}</button>
    </form>
  );
  const chip = (e: CalendarEvent) => {
    const c = categoryOf(e.category);
    return (
      <Link key={e.id} href={q({ event: e.id, new: undefined })} title={`${e.title} · ${c.label} · ${staffName(e.assignee_id)}`} className={`block rounded border px-1.5 py-0.5 text-[11px] leading-tight break-words ${c.chip} ${e.done ? "line-through opacity-60" : ""} ${selected?.id === e.id ? "ring-2 ring-brand" : ""}`}>
        {!e.all_day && <span className="font-semibold">{istTime(e.start_at)} </span>}
        {e.title}
        <span className="block text-[10px] opacity-75">{staffName(e.assignee_id)}</span>
      </Link>
    );
  };

  return (
    <>
      {/* title band */}
      <div className="-mt-1 mb-4 flex flex-wrap items-center gap-3 rounded-[8px] bg-gradient-to-r from-[#0f2f7a] via-[#1745a8] to-[#1d5fd6] px-5 py-3.5 text-white shadow-sm">
        <span className="grid size-10 place-items-center rounded-[8px] bg-white/15"><CalendarDays size={22} /></span>
        <h1 className="text-xl font-bold tracking-tight">Staff Calendar &amp; Reminders</h1>
        <Link href={q({ new: today, event: undefined })} className="ml-auto flex items-center gap-1.5 rounded-[6px] bg-white px-3 py-1.5 text-sm font-semibold text-[#1745a8] hover:bg-blue-50"><PlusCircle size={16} /> New reminder</Link>
      </div>
      {sp.saved && SAVED[sp.saved] && <div role="status" className="mb-4 rounded-[6px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{SAVED[sp.saved]}.</div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { l: "Total Tasks", v: stats.total, icon: <CalendarDays size={26} />, c: "border-blue-200 bg-blue-50", ic: "bg-[#1a56db] text-white" },
              { l: "Pending", v: stats.total - stats.done - stats.overdue, icon: <Clock size={26} />, c: "border-orange-200 bg-orange-50", ic: "bg-white text-orange-500 ring-4 ring-orange-400" },
              { l: "Completed", v: stats.done, icon: <CheckCircle2 size={26} />, c: "border-emerald-200 bg-emerald-50", ic: "bg-emerald-500 text-white" },
              { l: "Overdue", v: stats.overdue, icon: <AlertCircle size={26} />, c: "border-red-200 bg-red-50", ic: "bg-red-500 text-white" },
            ].map((k) => (
              <div key={k.l} className={`flex items-center gap-3 rounded-[8px] border p-3.5 shadow-sm ${k.c}`}>
                <span className={`grid size-12 shrink-0 place-items-center rounded-full ${k.ic}`}>{k.icon}</span>
                <div>
                  <div className={`text-[14px] font-semibold ${k.l === "Overdue" ? "text-red-700" : "text-[#1f2a44]"}`}>{k.l}</div>
                  <div className={`text-2xl font-bold ${k.l === "Overdue" ? "text-red-700" : "text-[#1f2a44]"}`}>{k.v}</div>
                </div>
              </div>
            ))}
          </div>

          {/* calendar + upcoming */}
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={q({ date: prev })} aria-label="Previous" className="grid size-9 place-items-center rounded-[6px] border border-[#cfdcf2] bg-white hover:bg-slate-50"><ChevronLeft size={18} /></Link>
                <Link href={q({ date: next })} aria-label="Next" className="grid size-9 place-items-center rounded-[6px] border border-[#cfdcf2] bg-white hover:bg-slate-50"><ChevronRight size={18} /></Link>
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[6px] px-2 py-1.5 text-[17px] font-semibold text-[#1f2a44] hover:bg-white">
                    <CalendarDays size={18} className="text-muted" /> {title} <ChevronDown size={16} />
                  </summary>
                  <div className="absolute z-20 mt-1 grid w-56 grid-cols-2 gap-1 rounded-[6px] border border-line bg-white p-2 shadow-lg">
                    {Array.from({ length: 12 }, (_, i) => shiftMonth(today, i - 4)).map((m) => (
                      <Link key={m} href={q({ date: m, view: "month" })} className={`rounded px-2 py-1 text-xs hover:bg-blue-50 ${m.slice(0, 7) === date.slice(0, 7) ? "bg-blue-100 font-semibold text-blue-800" : ""}`}>{monthLabel(m)}</Link>
                    ))}
                    <Link href={q({ date: today })} className="col-span-2 rounded border border-line px-2 py-1 text-center text-xs font-medium">Today</Link>
                  </div>
                </details>
                <div className="ml-auto flex overflow-hidden rounded-[6px] border border-[#cfdcf2] bg-white text-sm font-semibold">
                  {(["month", "week", "day"] as View[]).map((v) => (
                    <Link key={v} href={q({ view: v })} aria-current={v === view ? "page" : undefined} className={`px-4 py-1.5 capitalize ${v === view ? "bg-[#1a56db] text-white" : "text-[#1f2a44] hover:bg-slate-50"}`}>{v}</Link>
                  ))}
                </div>
              </div>

              {view === "month" && (
                <div className={card}>
                  <div className="grid grid-cols-7 border-b border-[#cfdcf2] bg-[#eef3fb] text-center text-[14px] font-semibold text-[#1f2a44]">
                    {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => {
                      const list = byDay.get(d) ?? [];
                      const dr = driveDays.get(d) ?? [];
                      const inMonth = d.slice(0, 7) === date.slice(0, 7);
                      const dots = [...dr.map(() => "bg-violet-600"), ...list.map((e) => categoryOf(e.category).dot)].slice(0, 4);
                      const tip = [...dr.map((x) => `${x.company} drive`), ...list.map((e) => `${e.all_day ? "" : istTime(e.start_at) + " "}${e.title}`)].join("\n");
                      return (
                        <Link
                          key={d}
                          href={q({ view: "day", date: d, event: undefined })}
                          title={tip || undefined}
                          className={`flex h-16 flex-col items-center justify-center gap-1 border-r border-b border-[#e3eaf6] text-[18px] font-semibold ${inMonth ? "text-[#1f2a44]" : "text-transparent"} ${d === today ? "rounded-[6px] bg-blue-50 ring-2 ring-[#1a56db] ring-inset" : "hover:bg-slate-50"}`}
                        >
                          {inMonth ? Number(d.slice(8)) : ""}
                          {inMonth && dots.length > 0 && (
                            <span className="flex gap-1">{dots.map((c, i) => <span key={i} className={`size-2.5 rounded-full ${c}`} />)}</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {view === "week" && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                  {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d, i) => (
                    <div key={d} className={`min-h-48 rounded-[8px] border bg-white p-2 shadow-sm ${d === today ? "border-[#1a56db]" : "border-[#cfdcf2]"}`}>
                      <Link href={q({ view: "day", date: d })} className="mb-2 flex items-baseline justify-between border-b border-line pb-1">
                        <span className="text-[11px] font-semibold text-muted uppercase">{WEEKDAYS[i]}</span>
                        <span className={`text-sm font-semibold ${d === today ? "text-[#1a56db]" : "text-navy"}`}>{Number(d.slice(8))}</span>
                      </Link>
                      <div className="space-y-1">
                        {(driveDays.get(d) ?? []).map((x) => <Link key={x.id} href="/placements" className="block rounded border border-violet-300 bg-white px-1.5 py-0.5 text-[11px] text-violet-800">{x.company} drive</Link>)}
                        {(byDay.get(d) ?? []).map((e) => chip(e))}
                        <Link href={q({ new: d, date: d, event: undefined })} className="block rounded border border-dashed border-line py-1 text-center text-[11px] text-muted hover:border-brand hover:text-brand">+ Add</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === "day" && (
                <div className={card}>
                  {((byDay.get(date) ?? []).some((e) => e.all_day) || (driveDays.get(date) ?? []).length > 0) && (
                    <div className="space-y-1 border-b border-line bg-slate-50 p-2">
                      <div className="text-[11px] font-semibold text-muted uppercase">All day</div>
                      {(driveDays.get(date) ?? []).map((x) => <Link key={x.id} href="/placements" className="block rounded border border-violet-300 bg-white px-1.5 py-0.5 text-[11px] text-violet-800">{x.company} drive</Link>)}
                      {(byDay.get(date) ?? []).filter((e) => e.all_day).map((e) => chip(e))}
                    </div>
                  )}
                  {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => {
                    const hr = (e: CalendarEvent) => Number(istTime(e.start_at).slice(0, 2));
                    const timed = (byDay.get(date) ?? []).filter((e) => !e.all_day);
                    const slot = timed.filter((e) => hr(e) === h || (h === 7 && hr(e) < 7) || (h === 21 && hr(e) > 21));
                    return (
                      <div key={h} className="grid grid-cols-[4rem_minmax(0,1fr)] border-b border-line last:border-0">
                        <div className="border-r border-line px-2 py-2 text-right text-[11px] text-muted">{String(h).padStart(2, "0")}:00</div>
                        <div className="min-h-11 space-y-1 p-1.5">{slot.map((e) => chip(e))}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* upcoming */}
            <section className={card}>
              <div className="flex items-center justify-between bg-gradient-to-r from-[#0f2f7a] to-[#1d5fd6] px-4 py-2.5 text-white">
                <h2 className="font-semibold">Upcoming Activities</h2>
                <Link href={q({ view: "week", date: today })} className="flex items-center gap-1 text-xs font-medium">View All <ArrowRight size={13} /></Link>
              </div>
              <ul className="divide-y divide-[#e3eaf6]">
                {upcoming.map((e) => {
                  const c = categoryOf(e.category);
                  const d = istDate(e.start_at);
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className={`w-1 self-stretch rounded-full ${c.dot}`} />
                      <div className="w-9 shrink-0 text-center leading-tight"><div className="text-lg font-bold text-[#1f2a44]">{Number(d.slice(8))}</div><div className="text-xs text-muted">{shortMonth(d)}</div></div>
                      <Link href={q({ event: e.id, date: d, new: undefined })} className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-[#1f2a44]">{e.title}</div>
                        <div className="truncate text-[12px] text-muted">({c.label})</div>
                      </Link>
                      {pill(PRIORITY_PILL[e.priority], priorityLabel(e.priority))}
                      <form action={setEventDoneAction.bind(null, e.id, true)}>
                        <input type="hidden" name="back" value={here} />
                        <button title="Mark done" aria-label={`Tick ${e.title} as done`} className="grid size-5 place-items-center rounded border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50" />
                      </form>
                    </li>
                  );
                })}
                {!upcoming.length && <li className="px-4 py-6 text-center text-sm text-muted">Nothing coming up. Add a reminder on the right.</li>}
              </ul>
            </section>
          </div>

          {/* pending reminders */}
          <section className={card}>
            <div className="flex flex-wrap items-center gap-2 bg-gradient-to-r from-[#0f2f7a] to-[#1d5fd6] px-4 py-2.5 text-white">
              <Bell size={18} />
              <h2 className="font-semibold">Pending Reminders</h2>
              <form action="/calendar" className="ml-auto flex flex-wrap gap-1.5">
                <input type="hidden" name="view" value={view} />
                <input type="hidden" name="date" value={date} />
                <select name="who" defaultValue={who} aria-label="Assignee" className="rounded border-0 bg-white/15 px-2 py-1 text-xs text-white [&>option]:text-ink">
                  <option value="all">Everyone</option>
                  <option value="me">Assigned to me</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <select name="cat" defaultValue={sp.cat ?? ""} aria-label="Category" className="rounded border-0 bg-white/15 px-2 py-1 text-xs text-white [&>option]:text-ink">
                  <option value="">All categories</option>
                  {CATEGORY_MENU.map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
                </select>
                <button className="rounded bg-white/20 px-2 py-1 text-xs font-medium">Filter</button>
              </form>
            </div>
            <div className="max-h-[22rem] overflow-auto">
              <table className="w-full min-w-[46rem] text-[13px]">
                <thead className="sticky top-0 bg-[#eef3fb] text-left text-[#1f2a44]">
                  <tr>{["Date & Time", "Task Details", "Category", "Assigned To", "Priority", "Status", "Action"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {pendingRows.map((e) => {
                    const c = categoryOf(e.category);
                    const overdue = isOverdue(e);
                    const due = (e.reminders ?? []).some((k) => reminderAt(e, k) <= now);
                    return (
                      <tr key={e.id} className="border-t border-[#e3eaf6] align-middle">
                        <td className="px-3 py-2 whitespace-nowrap text-[#1f2a44]">{fmtDate(istDate(e.start_at))}<div className="text-xs text-muted">{e.all_day ? "All day" : time12(e.start_at)}</div></td>
                        <td className="px-3 py-2">
                          <Link href={q({ event: e.id, date: istDate(e.start_at), new: undefined })} className="font-medium text-[#1f2a44] hover:text-brand">{e.title}</Link>
                          {e.linked_label && <div className="text-xs text-muted">({e.linked_label.replace(/^(Student|College|Company) · /, "")})</div>}
                        </td>
                        <td className="px-3 py-2">{pill(c.pill, c.label)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{staffName(e.assignee_id)}</td>
                        <td className="px-3 py-2">{pill(PRIORITY_PILL[e.priority], priorityLabel(e.priority))}</td>
                        <td className="px-3 py-2">{pill(overdue ? "bg-red-600 text-white" : due ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800", overdue ? "Overdue" : "Pending")}</td>
                        <td className="px-3 py-2">{doneButton(e)}</td>
                      </tr>
                    );
                  })}
                  {!pendingRows.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">No pending reminders. You&apos;re all caught up.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* create / edit reminder */}
        <section id="reminder-form" className={`${card} h-fit xl:sticky xl:top-20`}>
          <div className="flex items-center gap-2 bg-gradient-to-r from-[#0f2f7a] to-[#1d5fd6] px-4 py-3 text-white">
            <PlusCircle size={22} />
            <h2 className="text-lg font-semibold">{selected ? "Edit Reminder" : "Create Reminder"}</h2>
            {selected && <Link href={q({ event: undefined })} className="ml-auto text-xs underline">New</Link>}
          </div>
          {selected && (
            <div className="space-y-1 border-b border-line bg-slate-50 px-4 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {pill(categoryOf(selected.category).pill, categoryOf(selected.category).label)}
                {pill(PRIORITY_PILL[selected.priority], priorityLabel(selected.priority))}
                {selected.done && pill("bg-emerald-100 text-emerald-800", "Completed")}
              </div>
              <div className="text-muted">{whenText(selected)} · {staffName(selected.assignee_id)}{selected.done && selected.done_by ? ` · done by ${selected.done_by}` : ""}</div>
              {selected.linked_label && <div>Linked: {selected.linked_href ? <Link href={selected.linked_href} className="text-brand underline">{selected.linked_label}</Link> : selected.linked_label}</div>}
              <div className="flex gap-2 pt-1">
                <form action={setEventDoneAction.bind(null, selected.id, !selected.done)}>
                  <input type="hidden" name="back" value={q({ event: selected.id, saved: undefined })} />
                  <button className={selected.done ? "btn-ghost py-1 text-xs" : "rounded-[6px] bg-[#1a56db] px-3 py-1 text-xs font-semibold text-white"}>{selected.done ? "Reopen" : "Mark as done"}</button>
                </form>
                <form action={deleteEventAction.bind(null, selected.id)}>
                  <input type="hidden" name="back" value={q({ event: undefined, saved: undefined })} />
                  <button className="btn border border-red-200 bg-red-50 py-1 text-xs text-red-700">Delete</button>
                </form>
              </div>
            </div>
          )}
          <ReminderForm e={selected} date={formDate} staff={staff} defaultAssignee={mine?.id} back={q({ event: undefined, new: undefined, saved: undefined })} linkOptions={linkOptions} />
        </section>
      </div>

      {/* recently completed + tip */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="overflow-hidden rounded-[8px] border border-emerald-200 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 bg-emerald-50 px-4 py-2.5 text-lg font-semibold text-emerald-800"><CheckCircle2 size={22} className="text-emerald-600" /> Recently Completed</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-[13px]">
              <tbody>
                {completed.map((e) => (
                  <tr key={e.id} className="border-t border-emerald-100">
                    <td className="px-4 py-2 font-medium whitespace-nowrap">{e.done_at ? `${fmtDate(istDate(e.done_at))} ${time12(e.done_at)}` : fmtDate(istDate(e.start_at))}</td>
                    <td className="px-3 py-2">{e.title}</td>
                    <td className="px-3 py-2">{categoryOf(e.category).label}</td>
                    <td className="px-3 py-2">{e.done_by ?? staffName(e.assignee_id)}</td>
                    <td className="px-3 py-2">{pill("border border-emerald-400 bg-emerald-50 text-emerald-700", "Completed")}</td>
                    <td className="px-3 py-2"><Link href={q({ event: e.id, date: istDate(e.start_at), new: undefined })} className="rounded-full border border-blue-200 px-3 py-0.5 text-xs font-semibold text-[#1a56db] hover:bg-blue-50">View</Link></td>
                  </tr>
                ))}
                {!completed.length && <tr><td className="px-4 py-4 text-center text-muted">Nothing completed yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <div className="flex items-center gap-3 rounded-[8px] border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4 shadow-sm">
          <Lightbulb size={40} className="shrink-0 text-amber-400" />
          <p className="text-[15px] font-semibold text-[#1f2a44]">Get timely reminders and keep your operations on track!</p>
        </div>
      </div>
    </>
  );
}

function ReminderForm({ e, date, staff, defaultAssignee, back, linkOptions }: { e: CalendarEvent | null; date: string; staff: { id: string; full_name: string }[]; defaultAssignee?: string; back: string; linkOptions: string[] }) {
  const reminders = e ? e.reminders : ["1d", "same_day"];
  const channels = e ? e.channels : ["dashboard", "whatsapp"];
  const label = "mb-1 block text-[14px] font-semibold text-[#1f2a44]";
  const req = <span className="text-red-500"> *</span>;
  return (
    <form action={saveEventAction} className="space-y-3 p-4 text-sm">
      {e && <input type="hidden" name="id" value={e.id} />}
      <input type="hidden" name="back" value={back} />
      <div>
        <label className={label} htmlFor="ev-category">Task Category{req}</label>
        <select id="ev-category" name="category" required defaultValue={e?.category ?? "admission"} className="input">
          {CATEGORY_MENU.map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="ev-title">Task Title{req}</label>
        <input id="ev-title" name="title" required defaultValue={e?.title} placeholder="e.g. Student joining follow-up" className="input" />
      </div>
      <div>
        <label className={label} htmlFor="ev-assignee">Assign To{req}</label>
        <div className="relative">
          <User size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <select id="ev-assignee" name="assignee_id" required defaultValue={e ? (e.assignee_id ?? "") : (defaultAssignee ?? "")} className="input pl-8">
            <option value="">Select staff…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-[1.15fr_1fr_1fr] gap-2">
        <div>
          <label className={label} htmlFor="ev-date">Date{req}</label>
          <input id="ev-date" name="date" type="date" required min="2000-01-01" max="2100-12-31" defaultValue={e ? istDate(e.start_at) : date} className="input px-2" />
        </div>
        <div>
          <label className={label} htmlFor="ev-start">Time</label>
          <input id="ev-start" name="start_time" type="time" defaultValue={e && !e.all_day ? istTime(e.start_at) : "10:00"} className="input px-2" />
        </div>
        <div>
          <label className={label} htmlFor="ev-priority">Priority{req}</label>
          <select id="ev-priority" name="priority" required defaultValue={e?.priority ?? "medium"} className="input px-2">
            {PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={label} htmlFor="ev-linked">Linked Record</label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <input id="ev-linked" name="linked" list="ev-linked-list" defaultValue={e?.linked_label ?? ""} placeholder="Search Student / Company / College…" autoComplete="off" className="input pl-8" />
          <datalist id="ev-linked-list">{linkOptions.map((o) => <option key={o} value={o} />)}</datalist>
        </div>
      </div>
      <div>
        <label className={label} htmlFor="ev-description">Notes / Description</label>
        <textarea id="ev-description" name="description" rows={3} defaultValue={e?.description ?? ""} placeholder="e.g. Call student and confirm joining." className="input" />
      </div>
      <input type="hidden" name="location" value={e?.location ?? ""} />
      <fieldset>
        <legend className={label}>Reminder Notification</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {REMINDER_KINDS.map(([k, l]) => <label key={k} className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name="reminders" value={k} defaultChecked={reminders.includes(k)} className="size-4 accent-[#1a56db]" /> {l}</label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className={label}>Notify Via</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {REMINDER_CHANNELS.map(([k, l]) => <label key={k} className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name="channels" value={k} defaultChecked={channels.includes(k)} className="size-4 accent-[#1a56db]" /> {l}</label>)}
        </div>
        <p className="mt-1 text-[11px] text-muted">WhatsApp and email go to the assigned staff member&apos;s mobile / email.</p>
      </fieldset>
      <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
        <button type="reset" className="flex items-center justify-center gap-1.5 rounded-[6px] border border-[#1a56db] py-2 font-semibold text-[#1a56db] hover:bg-blue-50"><RotateCcw size={16} /> Reset</button>
        <button className="flex items-center justify-center gap-1.5 rounded-[6px] bg-[#1a56db] py-2 font-semibold text-white hover:bg-[#1747b8]"><Save size={16} /> {e ? "Update" : "Save Reminder"}</button>
      </div>
    </form>
  );
}
