import { Bell, Briefcase, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flag, MapPin, Plus, User } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { createCalendarRepo, nowMs, whenText } from "@/lib/calendar";
import { addDays, fmtDate, istDate, istTime, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession, getStore } from "@/lib/session";
import {
  CALENDAR_CATEGORIES,
  type CalendarEvent,
  categoryOf,
  istToUtc,
  PRIORITIES,
  REMINDER_CHANNELS,
  REMINDER_KINDS,
  reminderLabel,
} from "@/lib/types-calendar";
import { deleteEventAction, saveEventAction, setEventDoneAction } from "./actions";

export const metadata = { title: "Calendar & reminders" };

type View = "month" | "week" | "day";
type Search = { view?: string; date?: string; who?: string; cat?: string; event?: string; new?: string; saved?: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SAVED: Record<string, string> = { added: "Event added", updated: "Event updated", done: "Marked done", reopened: "Reopened", deleted: "Event deleted" };
const prioTone = { high: "red", medium: "amber", low: "slate" } as const;

const dow = (iso: string) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
const monthStart = (iso: string) => iso.slice(0, 8) + "01";
function shiftMonth(iso: string, n: number) {
  const d = new Date(monthStart(iso) + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
const monthLabel = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const today = todayISO();
  const view: View = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;

  const [me, repo, cal] = await Promise.all([getSession(), getRepo(), getStore().then(createCalendarRepo)]);
  const staff = await repo.staff();
  const mine = await repo.staffForUser(me?.userId, me?.email);
  const who = sp.who ?? "all";
  const whoId = who === "me" ? (mine?.id ?? "__none__") : who !== "all" ? who : null;

  // Visible range
  let from: string, days: number;
  if (view === "month") {
    from = addDays(monthStart(date), -dow(monthStart(date)));
    days = 42;
  } else if (view === "week") {
    from = addDays(date, -dow(date));
    days = 7;
  } else {
    from = date;
    days = 1;
  }
  const to = addDays(from, days);
  const now = nowMs();
  const [inRange, drives, pending, completed] = await Promise.all([
    cal.between(istToUtc(from), istToUtc(to)),
    repo.drives(),
    cal.pending(now, whoId),
    cal.recentlyCompleted(),
  ]);
  const events = inRange.filter((e) => (!whoId || e.assignee_id === whoId) && (!sp.cat || e.category === sp.cat));
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const d = istDate(e.start_at);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  for (const list of byDay.values()) list.sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start_at.localeCompare(b.start_at));
  const driveDays = new Map<string, typeof drives>();
  if (!sp.cat || sp.cat === "placement")
    for (const d of drives.filter((x) => x.drive_date && x.drive_date >= from && x.drive_date < to && x.status !== "closed"))
      driveDays.set(d.drive_date!, [...(driveDays.get(d.drive_date!) ?? []), d]);

  const selected = sp.event ? ((await cal.event(sp.event)) ?? null) : null;
  const staffName = (id?: string | null) => staff.find((s) => s.id === id)?.full_name ?? "Unassigned";

  // URL helpers (keep the current filters)
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
  const showForm = Boolean(sp.new) || Boolean(selected);

  const Chip = ({ e, compact }: { e: CalendarEvent; compact?: boolean }) => {
    const c = categoryOf(e.category);
    return (
      <Link
        href={q({ event: e.id, new: undefined })}
        title={`${e.title} · ${c.label} · ${staffName(e.assignee_id)}`}
        className={`block rounded border px-1.5 py-0.5 text-[11px] leading-tight ${compact ? "truncate" : "break-words"} ${c.chip} ${e.done ? "line-through opacity-60" : ""} ${selected?.id === e.id ? "ring-2 ring-brand" : ""}`}
      >
        {!e.all_day && <span className="font-semibold">{istTime(e.start_at)} </span>}
        {e.title}
        {!compact && <span className="block text-[10px] opacity-75">{staffName(e.assignee_id)}{e.location ? ` · ${e.location}` : ""}</span>}
      </Link>
    );
  };
  const DriveChip = ({ d }: { d: (typeof drives)[number] }) => (
    <Link href="/placements" className="flex items-center gap-1 truncate rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-[11px] text-emerald-800">
      <Briefcase size={11} className="shrink-0" /> {d.company} drive
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Calendar & reminders"
        subtitle="Plan meetings, classes, follow-ups and tasks. Reminders go out 1 day before, on the day and 1 hour before — on the dashboard, WhatsApp or email."
        actions={<Link href={q({ new: date, event: undefined })} className="btn-primary"><Plus size={15} /> New event</Link>}
      />
      {sp.saved && SAVED[sp.saved] && <div role="status" className="mb-4 rounded-[5px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{SAVED[sp.saved]}.</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-[5px] border border-line bg-white p-2 shadow-sm">
            <Link href={q({ date: prev })} aria-label="Previous" className="grid size-8 place-items-center rounded border border-line hover:bg-slate-50"><ChevronLeft size={16} /></Link>
            <Link href={q({ date: today })} className="rounded border border-line px-3 py-1.5 text-xs font-medium hover:bg-slate-50">Today</Link>
            <Link href={q({ date: next })} aria-label="Next" className="grid size-8 place-items-center rounded border border-line hover:bg-slate-50"><ChevronRight size={16} /></Link>
            <h2 className="ml-1 text-sm font-semibold text-navy">{title}</h2>
            <div className="ml-auto flex overflow-hidden rounded border border-line text-xs">
              {(["month", "week", "day"] as View[]).map((v) => (
                <Link key={v} href={q({ view: v })} aria-current={v === view ? "page" : undefined} className={`px-3 py-1.5 capitalize ${v === view ? "bg-brand text-white" : "hover:bg-slate-50"}`}>{v}</Link>
              ))}
            </div>
            <form className="flex flex-wrap gap-2" action="/calendar">
              <input type="hidden" name="view" value={view} />
              <input type="hidden" name="date" value={date} />
              <select name="who" defaultValue={who} aria-label="Assignee" className="input w-auto py-1.5 text-xs">
                <option value="all">Everyone</option>
                <option value="me">Assigned to me</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <select name="cat" defaultValue={sp.cat ?? ""} aria-label="Category" className="input w-auto py-1.5 text-xs">
                <option value="">All categories</option>
                {Object.entries(CALENDAR_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
              <button className="btn-ghost py-1.5 text-xs">Filter</button>
            </form>
          </div>

          {/* month */}
          {view === "month" && (
            <div className="overflow-x-auto rounded-[5px] border border-line bg-white shadow-sm">
              <div className="grid min-w-[44rem] grid-cols-7 border-b border-line bg-slate-50 text-center text-[11px] font-semibold text-muted uppercase">
                {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
              </div>
              <div className="grid min-w-[44rem] grid-cols-7">
                {Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => {
                  const list = byDay.get(d) ?? [];
                  const dr = driveDays.get(d) ?? [];
                  const other = d.slice(0, 7) !== date.slice(0, 7);
                  return (
                    <div key={d} className={`min-h-28 border-r border-b border-line p-1.5 ${other ? "bg-slate-50/60" : ""} ${d === today ? "bg-blue-50/50" : ""}`}>
                      <div className="mb-1 flex items-center justify-between">
                        <Link href={q({ view: "day", date: d })} className={`grid size-6 place-items-center rounded-full text-xs ${d === today ? "bg-brand font-semibold text-white" : other ? "text-slate-400" : "text-navy hover:bg-slate-100"}`}>{Number(d.slice(8))}</Link>
                        <Link href={q({ new: d, date: d, event: undefined })} aria-label={`Add event on ${fmtDate(d)}`} className="text-slate-300 hover:text-brand"><Plus size={13} /></Link>
                      </div>
                      <div className="space-y-1">
                        {dr.map((x) => <DriveChip key={x.id} d={x} />)}
                        {list.slice(0, 3).map((e) => <Chip key={e.id} e={e} compact />)}
                        {list.length > 3 && <Link href={q({ view: "day", date: d })} className="block text-[10px] text-brand">+{list.length - 3} more</Link>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* week */}
          {view === "week" && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d, i) => (
                <div key={d} className={`min-h-48 rounded-[5px] border bg-white p-2 shadow-sm ${d === today ? "border-brand" : "border-line"}`}>
                  <Link href={q({ view: "day", date: d })} className="mb-2 flex items-baseline justify-between border-b border-line pb-1">
                    <span className="text-[11px] font-semibold text-muted uppercase">{WEEKDAYS[i]}</span>
                    <span className={`text-sm font-semibold ${d === today ? "text-brand" : "text-navy"}`}>{Number(d.slice(8))}</span>
                  </Link>
                  <div className="space-y-1">
                    {(driveDays.get(d) ?? []).map((x) => <DriveChip key={x.id} d={x} />)}
                    {(byDay.get(d) ?? []).map((e) => <Chip key={e.id} e={e} />)}
                    <Link href={q({ new: d, date: d, event: undefined })} className="block rounded border border-dashed border-line py-1 text-center text-[11px] text-muted hover:border-brand hover:text-brand">+ Add</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* day */}
          {view === "day" && (
            <div className="rounded-[5px] border border-line bg-white shadow-sm">
              {((byDay.get(date) ?? []).some((e) => e.all_day) || (driveDays.get(date) ?? []).length > 0) && (
                <div className="space-y-1 border-b border-line bg-slate-50 p-2">
                  <div className="text-[11px] font-semibold text-muted uppercase">All day</div>
                  {(driveDays.get(date) ?? []).map((x) => <DriveChip key={x.id} d={x} />)}
                  {(byDay.get(date) ?? []).filter((e) => e.all_day).map((e) => <Chip key={e.id} e={e} />)}
                </div>
              )}
              {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => {
                const slot = (byDay.get(date) ?? []).filter((e) => !e.all_day && Number(istTime(e.start_at).slice(0, 2)) === h);
                const early = h === 7 ? (byDay.get(date) ?? []).filter((e) => !e.all_day && Number(istTime(e.start_at).slice(0, 2)) < 7) : [];
                const late = h === 21 ? (byDay.get(date) ?? []).filter((e) => !e.all_day && Number(istTime(e.start_at).slice(0, 2)) > 21) : [];
                return (
                  <div key={h} className="grid grid-cols-[4rem_minmax(0,1fr)] border-b border-line last:border-0">
                    <div className="border-r border-line px-2 py-2 text-right text-[11px] text-muted">{String(h).padStart(2, "0")}:00</div>
                    <div className="min-h-11 space-y-1 p-1.5">{[...early, ...slot, ...late].map((e) => <Chip key={e.id} e={e} />)}</div>
                  </div>
                );
              })}
              {!(byDay.get(date) ?? []).length && !(driveDays.get(date) ?? []).length && <p className="p-3 text-center text-xs text-muted">Nothing planned. <Link href={q({ new: date, event: undefined })} className="text-brand underline">Add an event</Link></p>}
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-[11px] text-muted">
            {Object.entries(CALENDAR_CATEGORIES).map(([k, c]) => (
              <Link key={k} href={q({ cat: sp.cat === k ? undefined : k })} className={`flex items-center gap-1 ${sp.cat === k ? "font-semibold text-navy" : ""}`}><span className={`size-2 rounded-full ${c.dot}`} />{c.label}</Link>
            ))}
          </div>
        </div>

        {/* side panel */}
        <div className="space-y-5">
          {showForm && (
            <Card title={selected ? "Edit event" : "New event"} icon={<CalendarDays size={15} />} actions={<Link href={q({ event: undefined, new: undefined })} className="text-xs text-muted hover:text-brand">Close</Link>}>
              {selected && (
                <div className="mb-3 space-y-1 rounded border border-line bg-slate-50 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`size-2 rounded-full ${categoryOf(selected.category).dot}`} />
                    <span className="font-medium text-navy">{categoryOf(selected.category).label}</span>
                    <Badge tone={prioTone[selected.priority]}>{selected.priority} priority</Badge>
                    {selected.done && <Badge tone="green">Done</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-muted"><Clock size={12} /> {whenText(selected)}</div>
                  <div className="flex items-center gap-1 text-muted"><User size={12} /> {staffName(selected.assignee_id)}</div>
                  {selected.reminders.length > 0 && <div className="flex items-center gap-1 text-muted"><Bell size={12} /> {selected.reminders.map(reminderLabel).join(", ")} · {selected.channels.join(", ")}</div>}
                  {selected.done && selected.done_by && <div className="text-muted">Completed by {selected.done_by}</div>}
                  <div className="flex gap-2 pt-1">
                    <form action={setEventDoneAction.bind(null, selected.id, !selected.done)}>
                      <input type="hidden" name="back" value={q({ event: selected.id, saved: undefined })} />
                      <button className={selected.done ? "btn-ghost py-1 text-xs" : "btn-primary py-1 text-xs"}>{selected.done ? "Reopen" : "Mark done"}</button>
                    </form>
                    <form action={deleteEventAction.bind(null, selected.id)}>
                      <input type="hidden" name="back" value={q({ event: undefined, saved: undefined })} />
                      <button className="btn border border-red-200 bg-red-50 py-1 text-xs text-red-700">Delete</button>
                    </form>
                  </div>
                </div>
              )}
              <EventForm e={selected} date={sp.new && /^\d{4}-\d{2}-\d{2}$/.test(sp.new) ? sp.new : date} staff={staff} defaultAssignee={mine?.id} back={q({ event: undefined, new: undefined, saved: undefined })} />
            </Card>
          )}

          <Card title={`Pending reminders (${pending.length})`} icon={<Bell size={15} />}>
            {pending.length ? (
              <ul className="divide-y divide-line">
                {pending.slice(0, 10).map((e) => {
                  const overdue = new Date(e.start_at).getTime() < now && (e.all_day ? istDate(e.start_at) < today : true);
                  return (
                    <li key={e.id} className="flex items-start gap-2 py-2 text-[13px]">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${categoryOf(e.category).dot}`} />
                      <div className="min-w-0 flex-1">
                        <Link href={q({ event: e.id, date: istDate(e.start_at), new: undefined })} className="font-medium text-navy hover:text-brand">{e.title}</Link>
                        <div className="text-[11px] text-muted">{whenText(e)} · {staffName(e.assignee_id)}</div>
                        <div className="mt-0.5 flex gap-1">
                          <Badge tone={prioTone[e.priority]}>{e.priority}</Badge>
                          {overdue && <Badge tone="red">Overdue</Badge>}
                        </div>
                      </div>
                      <form action={setEventDoneAction.bind(null, e.id, true)}>
                        <input type="hidden" name="back" value={here} />
                        <button aria-label={`Mark ${e.title} done`} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100">Mark done</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No reminders due. You&apos;re all caught up.</Empty>
            )}
          </Card>

          <Card title="Recently completed" icon={<CheckCircle2 size={15} />}>
            {completed.length ? (
              <ul className="divide-y divide-line">
                {completed.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 py-2 text-[13px]">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <Link href={q({ event: e.id, date: istDate(e.start_at), new: undefined })} className="text-muted line-through hover:text-brand">{e.title}</Link>
                      <div className="text-[11px] text-muted">{e.done_by ? `${e.done_by} · ` : ""}{e.done_at ? fmtDate(istDate(e.done_at)) : ""}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nothing completed yet.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function EventForm({ e, date, staff, defaultAssignee, back }: { e: CalendarEvent | null; date: string; staff: { id: string; full_name: string }[]; defaultAssignee?: string; back: string }) {
  const start = e && !e.all_day ? istTime(e.start_at) : "";
  const end = e?.end_at && !e.all_day ? istTime(e.end_at) : "";
  const reminders = e ? e.reminders : ["1d", "1h"];
  const channels = e ? e.channels : ["dashboard"];
  return (
    <form action={saveEventAction} className="space-y-3 text-sm">
      {e && <input type="hidden" name="id" value={e.id} />}
      <input type="hidden" name="back" value={back} />
      <div>
        <label className="label" htmlFor="ev-title">Title *</label>
        <input id="ev-title" name="title" required defaultValue={e?.title} placeholder="e.g. Call Intel HR about drive" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="ev-category">Category</label>
          <select id="ev-category" name="category" defaultValue={e?.category ?? "task"} className="input">
            {Object.entries(CALENDAR_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ev-priority"><Flag size={11} className="inline" /> Priority</label>
          <select id="ev-priority" name="priority" defaultValue={e?.priority ?? "medium"} className="input">
            {PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ev-date">Date *</label>
        <input id="ev-date" name="date" type="date" required min="2000-01-01" max="2100-12-31" defaultValue={e ? istDate(e.start_at) : date} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="ev-start">Start time</label>
          <input id="ev-start" name="start_time" type="time" defaultValue={start} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ev-end">End time</label>
          <input id="ev-end" name="end_time" type="time" defaultValue={end} className="input" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="all_day" defaultChecked={e?.all_day} /> All day (or leave the start time empty)</label>
      <div>
        <label className="label" htmlFor="ev-assignee"><User size={11} className="inline" /> Assigned to</label>
        <select id="ev-assignee" name="assignee_id" defaultValue={e ? (e.assignee_id ?? "") : (defaultAssignee ?? "")} className="input">
          <option value="">Unassigned</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ev-location"><MapPin size={11} className="inline" /> Location / link</label>
        <input id="ev-location" name="location" defaultValue={e?.location ?? ""} placeholder="Room, address or Zoom link" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="ev-description">Notes</label>
        <textarea id="ev-description" name="description" rows={2} defaultValue={e?.description ?? ""} className="input" />
      </div>
      <fieldset className="rounded border border-line p-2">
        <legend className="px-1 text-xs font-semibold text-navy"><Bell size={11} className="inline" /> Remind</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {REMINDER_KINDS.map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" name="reminders" value={k} defaultChecked={reminders.includes(k)} /> {l}</label>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="text-muted">via</span>
          {REMINDER_CHANNELS.map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" name="channels" value={k} defaultChecked={channels.includes(k)} /> {l}</label>)}
        </div>
        <p className="mt-1 text-[10px] text-muted">WhatsApp and email go to the assigned staff member&apos;s mobile / email.</p>
      </fieldset>
      <button className="btn-primary w-full">{e ? "Save changes" : "Add event"}</button>
    </form>
  );
}
