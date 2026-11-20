import {
  BadgeCheck,
  BarChart3,
  UserCheck,
  UserX,
  Bell,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  GraduationCap,
  IndianRupee,
  Landmark,
  Layers,
  MessageCircle,
  Monitor,
  RefreshCw,
  Trophy,
  UserCog,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { addDays, addMonths, daysBetween, fmtDate, inr, todayISO } from "@/lib/format";
import { templateMeta } from "@/lib/letters";
import { getRepo } from "@/lib/server";
import { getSession } from "@/lib/session";
import { decideLeaveAction } from "../module-actions";

export const metadata = { title: "Admin Dashboard" };

const box = "rounded-[5px] border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

function Panel({ title, action, children, className = "", bodyClass = "p-4" }: { title: string; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`${box} flex flex-col ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-medium text-navy">{title}</h2>
        {action}
      </header>
      <div className={`flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

const ViewAll = ({ href, label = "View all" }: { href: string; label?: string }) => (
  <Link href={href} className="text-xs font-medium text-brand hover:underline">{label}</Link>
);

function Donut({ parts, size = 150, hole = 58, children }: { parts: { value: number; color: string }[]; size?: number; hole?: number; children?: ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const ends = parts.map((_, k) => parts.slice(0, k + 1).reduce((a, p) => a + p.value, 0));
  const stops = parts.map((p, k) => `${p.color} ${((ends[k] - p.value) / total) * 360}deg ${(ends[k] / total) * 360}deg`);
  return (
    <div className="relative mx-auto grid place-items-center rounded-full" style={{ width: size, height: size, background: `conic-gradient(${stops.join(",")})` }}>
      <div className="grid place-items-center rounded-full bg-white text-center" style={{ width: `${hole}%`, height: `${hole}%` }}>{children}</div>
    </div>
  );
}

export default async function Dashboard() {
  const repo = await getRepo();
  const today = todayISO();
  const [session, stats, students, courses, batches, drives, responses, ledger, staff, leaves, staffAtt, att, letters, messages, notifications] = await Promise.all([
    getSession(),
    repo.dashboard(),
    repo.students(),
    repo.courses(),
    repo.batches(),
    repo.drives(),
    repo.responses(),
    repo.ledger(),
    repo.staff(),
    repo.leaveRequests(),
    repo.staffAttendance(today, today),
    repo.attendance(addDays(today, -29), today),
    repo.letters(),
    repo.messages(),
    repo.notifications(),
  ]);
  const name = new Map(students.map((s) => [s.id, s]));
  const staffName = new Map(staff.map((s) => [s.id, s]));

  // ---- headline numbers ----------------------------------------------------
  const inactive = students.length - stats.active;
  const runningBatches = batches.filter((b) => {
    const c = courses.find((x) => x.id === b.course_id);
    return b.start_date && c && b.start_date <= today && addMonths(b.start_date, c.duration_months) >= today;
  });
  const lastPayment = ledger.payments[0];
  const lastPayer = lastPayment ? name.get(lastPayment.student_id) : undefined;

  // ---- calendar: this month, marking drives, batch starts and fee due dates --
  const first = today.slice(0, 8) + "01";
  const monthEnd = addDays(addMonths(first, 1), -1);
  const lead = new Date(first + "T00:00:00Z").getUTCDay();
  const cells = Array.from({ length: Math.ceil((lead + Number(monthEnd.slice(8))) / 7) * 7 }, (_, k) => addDays(first, k - lead));
  const events = [
    ...drives.filter((d) => d.drive_date).map((d) => ({ date: d.drive_date!, title: `${d.company} drive`, sub: d.job_role, icon: Briefcase, tone: "border-brand", href: `/placements?drive=${d.id}` })),
    ...batches.filter((b) => b.start_date).map((b) => ({ date: b.start_date!, title: `${b.name} starts`, sub: courses.find((c) => c.id === b.course_id)?.name ?? "", icon: Layers, tone: "border-emerald-500", href: "/courses" })),
    ...leaves.filter((l) => l.status === "approved").map((l) => ({ date: l.from_date, title: `${staffName.get(l.staff_id)?.full_name ?? "Staff"} on leave`, sub: l.leave_type, icon: UserCog, tone: "border-amber-500", href: "/hr" })),
  ];
  const dueDays = new Set(ledger.installments.filter((i) => i.status !== "paid").map((i) => i.due_date));
  const eventDays = new Set(events.map((e) => e.date));
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

  // ---- attendance ----------------------------------------------------------
  const lastDay = att.reduce((m, r) => (r.session_date > m ? r.session_date : m), "");
  const presentIds = new Set(att.filter((r) => r.session_date === lastDay).map((r) => r.student_id));
  const present = students.filter((s) => s.status === "active" && presentIds.has(s.id)).length;
  const absent = Math.max(0, stats.active - present);
  const daySources = att.filter((r) => r.session_date === lastDay);
  const staffPresent = staffAtt.filter((a) => a.status === "present" || a.status === "half_day").length;

  // ---- performance -----------------------------------------------------------
  const active = students.filter((s) => s.status === "active");
  const good = active.filter((s) => s.attendance_pct >= 75).length;
  const average = active.filter((s) => s.attendance_pct >= 60 && s.attendance_pct < 75).length;
  const below = active.length - good - average;
  const topAttendance = [...active].sort((a, b) => b.attendance_pct - a.attendance_pct)[0];
  const offered = responses.filter((r) => r.stage === "Offered");
  const star = offered[0] ? name.get(offered[0].student_id) : [...active].sort((a, b) => b.paid - a.paid)[0];
  const starDrive = offered[0] ? drives.find((d) => d.id === offered[0].drive_id) : undefined;

  // ---- fees ------------------------------------------------------------------
  const quarters = Array.from({ length: 8 }, (_, k) => addMonths(first, -(7 - k)).slice(0, 7));
  const feeBars = quarters.map((m) => ({
    m,
    due: ledger.installments.filter((i) => i.due_date.startsWith(m)).reduce((a, i) => a + Number(i.amount), 0),
    paid: ledger.payments.filter((p) => p.paid_at.startsWith(m)).reduce((a, p) => a + Number(p.amount), 0),
  }));
  const maxBar = Math.max(1, ...feeBars.map((b) => Math.max(b.due, b.paid)));
  const thisMonth = ledger.payments.filter((p) => p.paid_at.startsWith(today.slice(0, 7))).reduce((a, p) => a + Number(p.amount), 0);
  const notPaid = new Set(ledger.installments.filter((i) => i.status !== "paid" && i.due_date < today).map((i) => i.student_id)).size;

  const initials = (n?: string) => (n ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const statCards = [
    { icon: GraduationCap, tint: "bg-rose-50 text-rose-600", value: stats.total, label: "Total Students", a: `Active : ${stats.active}`, b: `Inactive : ${inactive}`, href: "/students" },
    { icon: UserCog, tint: "bg-blue-50 text-blue-600", value: staff.length, label: "Total Staff", a: `Present : ${staffPresent}`, b: `Leave : ${staffAtt.filter((x) => x.status === "leave").length}`, href: "/hr" },
    { icon: Layers, tint: "bg-amber-50 text-amber-600", value: courses.length, label: "Total Courses", a: `Batches : ${batches.length}`, b: `Running : ${runningBatches.length}`, href: "/courses" },
    { icon: Briefcase, tint: "bg-emerald-50 text-emerald-600", value: drives.length, label: "Placement Drives", a: `Open : ${stats.open_drives}`, b: `Interested : ${stats.interested}`, href: "/placements" },
  ];
  const quickLinks = [
    { href: "/attendance", label: "Attendance", icon: CalendarCheck },
    { href: "/fees", label: "Fees", icon: IndianRupee },
    { href: "/documents", label: "Certificates", icon: FileText },
    { href: "/placements", label: "Placements", icon: Briefcase },
    { href: "/lab", label: "Lab Systems", icon: Monitor },
    { href: "/reports", label: "Reports", icon: CalendarDays },
  ];
  const moduleStrip = [
    { href: "/hr", label: "Human Resources", icon: UserCog },
    { href: "/communication", label: "Communication", icon: MessageCircle },
    { href: "/validity", label: "Training Validity", icon: Bell },
    { href: "/accounts", label: "Finance & Accounts", icon: Landmark },
    { href: "/fees", label: "Fees Collection", icon: IndianRupee },
    { href: "/courses", label: "Courses & Batches", icon: Layers },
  ];
  const expiring = students
    .filter((s) => s.status !== "expired" && s.days_left !== null && s.days_left >= 0 && s.days_left <= 30)
    .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0))
    .slice(0, 5);
  const activity = responses
    .filter((r) => r.response === "yes")
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .slice(0, 4)
    .map((r) => ({ r, s: name.get(r.student_id), d: drives.find((x) => x.id === r.drive_id) }));

  return (
    <>
      {/* page title + actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-navy">Admin Dashboard</h1>
          <nav className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted" aria-label="Breadcrumb">
            <span>Dashboard</span><span>/</span><span className="text-navy">Admin Dashboard</span>
          </nav>
        </div>
        <div className="flex gap-2">
          <Link href="/students/new" className="btn-primary">Add New Student</Link>
          <Link href="/fees" className="btn-soft">Fees Details</Link>
        </div>
      </div>

      {lastPayment && (
        <div className="mb-4 flex items-center gap-2 rounded-[5px] border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="grid size-5 place-items-center rounded-full bg-emerald-500 text-white"><Check size={12} /></span>
          <span><b className="font-medium">{lastPayer?.full_name ?? "A student"}</b> has paid {inr(lastPayment.amount)} fees via {lastPayment.mode} on {fmtDate(lastPayment.paid_at)}</span>
          <Link href="/fees" className="ml-auto text-emerald-700 hover:underline">View</Link>
        </div>
      )}

      {/* welcome banner */}
      <div className="relative mb-5 overflow-hidden rounded-[5px] bg-navy px-5 py-5 text-white">
        <div className="pointer-events-none absolute -top-6 right-40 size-16 rotate-12 rounded-xl border-4 border-brand/70" />
        <div className="pointer-events-none absolute -bottom-8 right-72 size-20 rounded-full border-4 border-brand/60" />
        <div className="pointer-events-none absolute top-3 left-1/2 size-6 rotate-45 border-2 border-amber-400/80" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium">Welcome Back, {session?.name ?? "Admin"}</h2>
            <p className="mt-1 text-xs text-white/80">Have a Good day at work</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/80"><RefreshCw size={13} /> Updated Recently on {fmtDate(today)}</div>
        </div>
      </div>

      {/* at a glance */}
      <div className="mb-5 flex flex-wrap items-stretch overflow-hidden rounded-[5px] border border-line bg-white">
        <div className="flex items-center gap-2 bg-navy px-4 py-3 text-white">
          <BarChart3 size={22} />
          <div className="leading-tight"><div className="text-sm font-medium">Admin Dashboard</div><div className="text-[11px] text-white/75">(At a Glance)</div></div>
        </div>
        {[
          { l: "Total Students", v: stats.total, icon: Users, c: "text-brand", href: "/students" },
          { l: "Active Students", v: stats.active, icon: UserCheck, c: "text-emerald-600", href: "/students?status=active" },
          { l: "On Hold", v: stats.on_hold, icon: UserX, c: "text-red-500", href: "/students?status=on_hold" },
          { l: "Expiring This Month", v: stats.expiring_month, icon: Bell, c: "text-amber-500", href: "/validity" },
          { l: "Pending Fees", v: inr(stats.pending_fees), icon: IndianRupee, c: "text-amber-600", href: "/fees" },
          { l: "Active Placement Drives", v: stats.open_drives, icon: Briefcase, c: "text-brand", href: "/placements" },
        ].map((k) => (
          <Link key={k.l} href={k.href} className="flex min-w-36 flex-1 items-center gap-2 border-l border-line px-4 py-3 hover:bg-slate-50">
            <k.icon size={24} className={k.c} />
            <div className="leading-tight"><div className="text-[11px] text-muted">{k.l}</div><div className="text-lg font-medium text-navy tabular-nums">{k.v}</div></div>
          </Link>
        ))}
      </div>

      {/* four headline cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.label} className={`${box} p-4`}>
            <div className="flex items-center gap-3">
              <span className={`grid size-12 place-items-center rounded-[5px] ${c.tint}`}><c.icon size={24} /></span>
              <div>
                <div className="text-xl font-medium text-navy tabular-nums">{c.value}</div>
                <div className="text-[13px] text-muted">{c.label}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
              <span>{c.a} &nbsp; {c.b}</span>
              <ViewAll href={c.href} />
            </div>
          </div>
        ))}
      </div>

      {/* schedules · attendance · quick links */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Schedules" action={<span className="text-xs text-muted">{new Date(first + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</span>}>
          <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, k) => <div key={k} className="pb-1 font-medium text-navy">{d}</div>)}
            {cells.map((d) => {
              const inMonth = d.slice(0, 7) === first.slice(0, 7);
              const isToday = d === today;
              const has = eventDays.has(d);
              return (
                <div key={d} className="grid place-items-center py-0.5">
                  <span className={`grid size-7 place-items-center rounded-[5px] ${isToday ? "bg-brand text-white" : has ? "bg-brand-soft font-medium text-brand" : inMonth ? "text-[#515b73]" : "text-slate-300"}`}>
                    {Number(d.slice(8))}
                  </span>
                  {inMonth && dueDays.has(d) && <span className="-mt-0.5 size-1 rounded-full bg-amber-500" title="Fee installments due" />}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-3 text-[11px] text-muted"><span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-brand-soft ring-1 ring-brand" /> Event</span><span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" /> Fees due</span></div>
          <h3 className="mt-4 mb-2 text-sm font-medium text-navy">Upcoming Events</h3>
          <div className="space-y-2">
            {upcoming.map((e, k) => (
              <Link key={k} href={e.href} className={`block rounded-[5px] border border-line border-l-[3px] ${e.tone} p-3 hover:bg-slate-50`}>
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-[5px] bg-navy-soft text-brand"><e.icon size={15} /></span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-navy">{e.title}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted"><CalendarDays size={11} /> {fmtDate(e.date)} · {e.sub}</div>
                  </div>
                </div>
              </Link>
            ))}
            {!upcoming.length && <p className="text-xs text-muted">No upcoming drives, batch starts or approved leave.</p>}
          </div>
        </Panel>

        <Panel title="Attendance" action={<span className="rounded-[5px] border border-line px-2 py-1 text-[11px] text-muted">{lastDay ? fmtDate(lastDay) : "No classes"}</span>}>
          <div className="mb-3 flex gap-4 border-b border-line text-xs">
            <span className="border-b-2 border-brand pb-2 font-medium text-brand">Students</span>
            <Link href="/hr" className="pb-2 text-muted hover:text-brand">Staff ({staffPresent}/{staff.length} today)</Link>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { v: daySources.filter((r) => r.source === "zoom").length, l: "Zoom" },
              { v: daySources.filter((r) => r.source === "teamviewer").length, l: "TeamViewer" },
              { v: daySources.filter((r) => r.source === "biometric").length, l: "Biometric" },
              { v: stats.irregular, l: "Irregular" },
            ].map((x) => (
              <div key={x.l} className="rounded-[5px] border border-line py-2">
                <div className="text-base font-medium text-navy">{x.v}</div>
                <div className="text-[10px] text-muted">{x.l}</div>
              </div>
            ))}
          </div>
          <div className="relative my-5">
            <Donut parts={[{ value: present, color: "#3d5ee1" }, { value: absent, color: "#e9edf4" }]} size={190} hole={52}>
              <div><div className="text-lg font-medium text-navy">{present}</div><div className="text-[10px] text-muted">Present</div></div>
            </Donut>
            <div className="absolute right-6 bottom-2 rounded-[5px] bg-white px-2 py-1 text-center shadow ring-1 ring-line">
              <div className="text-sm font-medium text-navy">{absent}</div><div className="text-[10px] text-muted">Absent</div>
            </div>
          </div>
          <Link href="/attendance" className="btn-ghost w-full text-xs"><CalendarDays size={14} /> View All Student Attendance</Link>
        </Panel>

        <div className="space-y-5">
          <Panel title="Quick Links">
            <div className="grid grid-cols-3 gap-3">
              {quickLinks.map((q, k) => (
                <Link key={q.href + k} href={q.href} className={`flex flex-col items-center gap-2 rounded-[5px] border p-3 text-center text-[11px] text-[#515b73] hover:border-brand hover:text-brand ${k === 1 ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>
                  <span className={`grid size-8 place-items-center rounded-[5px] ${k === 1 ? "bg-brand text-white" : "bg-navy text-white"}`}><q.icon size={15} /></span>
                  {q.label}
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Batch Progress" action={<ViewAll href="/courses" label="+ Create New Batch" />}>
            <div className="space-y-3">
              {runningBatches.slice(0, 3).map((b) => {
                const c = courses.find((x) => x.id === b.course_id)!;
                const end = addMonths(b.start_date!, c.duration_months);
                const pct = Math.min(100, Math.round((100 * daysBetween(b.start_date!, today)) / Math.max(1, daysBetween(b.start_date!, end))));
                return (
                  <div key={b.id} className="flex items-center gap-3 rounded-[5px] border border-line p-3">
                    <span className="grid size-9 place-items-center rounded-[5px] bg-brand-soft text-[11px] font-medium text-brand">{c.code}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-navy">{b.name}</div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
                      <div className="mt-1 text-[10px] text-muted">{pct}% complete · ends {fmtDate(end)}</div>
                    </div>
                  </div>
                );
              })}
              {!runningBatches.length && <p className="text-xs text-muted">No batch is running today.</p>}
            </div>
          </Panel>
        </div>
      </div>

      {/* performers · performance */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-[5px] bg-emerald-500 p-5 text-white">
          <Trophy size={70} className="absolute -right-2 -bottom-2 text-white/15" />
          <div className="text-sm text-white/90">Best Attendance</div>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-14 place-items-center rounded-full bg-white/20 text-lg font-medium">{initials(topAttendance?.full_name)}</span>
            <div>
              <div className="text-xl font-medium">{topAttendance?.full_name ?? "—"}</div>
              <div className="text-xs text-white/85">{topAttendance ? `${topAttendance.course_name ?? ""} · ${topAttendance.attendance_pct}% attendance` : "No active students"}</div>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[5px] bg-brand p-5 text-white">
          <BadgeCheck size={70} className="absolute -right-2 -bottom-2 text-white/15" />
          <div className="text-sm text-white/90">Star Student</div>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-14 place-items-center rounded-full bg-white/20 text-lg font-medium">{initials(star?.full_name)}</span>
            <div>
              <div className="text-xl font-medium text-amber-300">{star?.full_name ?? "—"}</div>
              <div className="text-xs text-white/85">{starDrive ? `Offer from ${starDrive.company}` : star?.batch_name ?? ""}</div>
            </div>
          </div>
        </div>
        <Panel title="Attendance Performance" action={<ViewAll href="/attendance" />}>
          <div className="flex items-center gap-5">
            <Donut parts={[{ value: good, color: "#3d5ee1" }, { value: average, color: "#7dd3e8" }, { value: below, color: "#e9edf4" }]} size={120} hole={60}>
              <div><div className="text-[10px] text-muted">Good</div><div className="text-sm font-medium text-navy">{active.length ? Math.round((100 * good) / active.length) : 0}%</div></div>
            </Donut>
            <ul className="flex-1 space-y-2 text-xs">
              {[["Good (≥75%)", good, "bg-brand"], ["Average (60–75%)", average, "bg-sky-300"], ["Below average", below, "bg-slate-200"]].map(([l, v, c]) => (
                <li key={l as string} className="flex items-center justify-between rounded-[5px] border border-line px-3 py-2">
                  <span className="flex items-center gap-2 text-muted"><span className={`size-2 rounded-full ${c}`} />{l}</span>
                  <span className="font-medium text-navy">{v as number}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      {/* fees collection · fee stats · leave requests */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <Panel
          title="Fees Collection"
          action={<div className="flex items-center gap-3 text-[11px] text-muted"><span className="flex items-center gap-1"><span className="size-2 rounded-full bg-slate-200" /> Total due</span><span className="flex items-center gap-1"><span className="size-2 rounded-full bg-brand" /> Collected</span><span>Last 8 months</span></div>}
        >
          <div className="flex h-56 items-end gap-3 border-b border-l border-line pb-0 pl-2">
            {feeBars.map((b) => (
              <div key={b.m} className="group relative flex h-full flex-1 items-end justify-center">
                <div className="relative w-full max-w-9 rounded-t bg-slate-200" style={{ height: `${(100 * b.due) / maxBar}%` }}>
                  <div className="absolute inset-x-0 bottom-0 rounded-t bg-brand" style={{ height: b.due ? `${Math.min(100, (100 * b.paid) / b.due)}%` : 0 }} />
                </div>
                {!b.due && b.paid > 0 && <div className="absolute bottom-0 w-full max-w-9 rounded-t bg-brand" style={{ height: `${(100 * b.paid) / maxBar}%` }} />}
                <div className="pointer-events-none absolute -top-10 z-10 hidden rounded bg-navy px-2 py-1 text-[10px] whitespace-nowrap text-white group-hover:block">{inr(b.paid)} / {inr(b.due)}</div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-3 pl-2 text-center text-[10px] text-muted">
            {feeBars.map((b) => <div key={b.m} className="flex-1">{new Date(b.m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" })}</div>)}
          </div>
        </Panel>

        <div className="grid gap-3">
          {[
            { v: inr(stats.collected), l: "Total Fees Collected" },
            { v: inr(thisMonth), l: "Collected this month" },
            { v: notPaid, l: "Students with overdue fees", extra: <Link href="/communication" className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand hover:underline"><Bell size={11} /> Remind All</Link> },
            { v: inr(stats.pending_fees), l: "Total Outstanding" },
          ].map((x) => (
            <div key={x.l} className={`${box} px-4 py-3`}>
              <div className="text-base font-medium text-navy tabular-nums">{x.v}</div>
              <div className="text-[11px] text-muted">{x.l}</div>
              {x.extra}
            </div>
          ))}
        </div>

        <Panel title="Leave Requests" action={<ViewAll href="/hr" />} bodyClass="p-0">
          <div className="max-h-80 divide-y divide-line overflow-y-auto">
            {leaves.slice(0, 5).map((l) => {
              const s = staffName.get(l.staff_id);
              return (
                <div key={l.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-9 place-items-center rounded-[5px] bg-navy-soft text-xs font-medium text-brand">{initials(s?.full_name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium text-navy">
                        {s?.full_name}
                        <Badge tone={l.leave_type === "sick" ? "red" : l.leave_type === "casual" ? "amber" : "blue"}>{l.leave_type}</Badge>
                      </div>
                      <div className="text-[11px] text-muted">{s?.designation}</div>
                    </div>
                    {l.status === "pending" ? (
                      <div className="flex gap-1">
                        <form action={decideLeaveAction.bind(null, l.id, "approved")}><button title="Approve" className="grid size-6 place-items-center rounded bg-emerald-500 text-white"><Check size={13} /></button></form>
                        <form action={decideLeaveAction.bind(null, l.id, "rejected")}><button title="Reject" className="grid size-6 place-items-center rounded bg-red-500 text-white"><X size={13} /></button></form>
                      </div>
                    ) : (
                      <Badge tone={l.status === "approved" ? "green" : "red"}>{l.status}</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted">
                    <span>Leave : {fmtDate(l.from_date)}{l.to_date !== l.from_date ? ` – ${fmtDate(l.to_date)}` : ""}</span>
                    <span>Applied on : {fmtDate(l.created_at)}</span>
                  </div>
                </div>
              );
            })}
            {!leaves.length && <p className="p-4 text-xs text-muted">No leave requests.</p>}
          </div>
        </Panel>
      </div>

      {/* module strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {moduleStrip.map((m) => (
          <Link key={m.href + m.label} href={m.href} className={`${box} flex items-center gap-2 px-3 py-3 text-[12px] text-navy hover:border-brand`}>
            <span className="grid size-7 place-items-center rounded-[5px] bg-navy-soft text-brand"><m.icon size={14} /></span>
            <span className="flex-1 leading-tight">{m.label}</span>
            <ChevronRight size={14} className="text-muted" />
          </Link>
        ))}
      </div>

      {/* notices · documents */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Notice Board" action={<div className="flex gap-3"><ViewAll href="/communication" label="+ Add New" /><ViewAll href="/validity" /></div>}>
          <div className="space-y-2">
            {expiring.map((s) => (
              <Link key={s.id} href={`/students/${s.id}`} className="flex items-center gap-3 rounded-[5px] border border-line p-3 hover:bg-slate-50">
                <span className="grid size-8 place-items-center rounded-[5px] bg-amber-50 text-amber-600"><Bell size={14} /></span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-navy">{s.full_name}: training validity ends in {s.days_left} day{s.days_left === 1 ? "" : "s"}</div>
                  <div className="flex items-center gap-1 text-[11px] text-muted"><CalendarDays size={11} /> Valid until : {fmtDate(s.validity_end)}</div>
                </div>
              </Link>
            ))}
            {!expiring.length && <p className="text-xs text-muted">No student validity ends in the next 30 days.</p>}
            {notifications.filter((n) => !n.sent_at).length > 0 && (
              <p className="text-[11px] text-amber-700">{notifications.filter((n) => !n.sent_at).length} reminder(s) waiting to be sent.</p>
            )}
          </div>
        </Panel>

        <Panel title="Recent Documents" action={<ViewAll href="/documents" />}>
          <div className="mb-3 flex gap-4 border-b border-line text-xs">
            <span className="border-b-2 border-brand pb-2 font-medium text-brand">Certificates & Letters</span>
          </div>
          <div className="space-y-2">
            {letters.slice(0, 4).map((l) => (
              <Link key={l.id} href={`/documents/${l.serial_no}`} className="flex items-center gap-3 rounded-[5px] border border-line p-3 hover:bg-slate-50">
                <span className="grid size-8 place-items-center rounded-[5px] bg-navy-soft text-brand"><FileText size={14} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-navy">{templateMeta(l.template)?.title} · {l.student_id ? name.get(l.student_id)?.full_name : staffName.get(l.staff_id ?? "")?.full_name}</div>
                  <div className="text-[11px] text-muted">Issued on : {fmtDate(l.issued_at)} · {l.serial_no}</div>
                </div>
              </Link>
            ))}
          </div>
          <Link href="/documents" className="btn-primary mt-3 w-full text-xs">Issue New Document</Link>
        </Panel>
      </div>

      {/* inbox · student activity */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Messages" action={<ViewAll href="/communication" />}>
          <div className="space-y-2">
            {messages.slice(0, 3).map((m) => (
              <div key={m.id} className="rounded-[5px] border border-line p-3">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="flex items-center gap-2"><span className={`grid size-6 place-items-center rounded-full text-white ${m.channel === "whatsapp" ? "bg-emerald-500" : "bg-brand"}`}><MessageCircle size={12} /></span><b className="font-medium text-navy">{m.audience}</b></span>
                  <span>{fmtDate(m.created_at)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-[#515b73]">{m.subject ? `${m.subject}: ` : ""}{m.body}</p>
              </div>
            ))}
            {!messages.length && <p className="text-xs text-muted">No broadcasts yet. <Link href="/communication" className="text-brand hover:underline">Send one</Link>.</p>}
          </div>
        </Panel>

        <Panel title="Student Activity" action={<ViewAll href="/placements" />}>
          <div className="space-y-2">
            {activity.map(({ r, s, d }) => (
              <div key={`${r.drive_id}-${r.student_id}`} className="flex items-center gap-3 rounded-[5px] border border-line p-3">
                <span className="grid size-9 place-items-center rounded-[5px] bg-brand-soft text-xs font-medium text-brand">{initials(s?.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-navy">{s?.full_name} · {r.stage ?? "Applied"} at &quot;{d?.company}&quot;</div>
                  <div className="truncate text-[11px] text-muted">{d?.job_role}{d?.location ? ` · ${d.location}` : ""}</div>
                </div>
                <span className="text-[11px] whitespace-nowrap text-muted">{r.updated_at ? fmtDate(r.updated_at) : ""}</span>
              </div>
            ))}
            {!activity.length && <p className="text-xs text-muted">No placement activity yet.</p>}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted"><Users size={12} /> {stats.interested} students interested across {drives.length} drives</div>
        </Panel>
      </div>
    </>
  );
}
