import { Bell, CalendarCheck, CalendarOff, CheckSquare, GraduationCap, Square } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Empty, PageHeader, Progress, Stat } from "@/components/ui";
import { addDays, fmtDate, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession } from "@/lib/session";
import { addTaskAction, applyLeaveAction, checkInAction, removeTaskAction, toggleTaskAction } from "../module-actions";

export const metadata = { title: "My workspace" };

/** Staff self-service (the "Staff app"): attendance, daily tasks, leave, student progress, notifications. */
export default async function MyWorkspace() {
  const me = await getSession();
  const repo = await getRepo();
  const today = todayISO();
  const staff = (await repo.staffForUser(me?.userId, me?.email)) ?? (me?.demo ? (await repo.staff())[0] : null);

  if (!staff)
    return (
      <>
        <PageHeader title="My workspace" />
        <Empty>
          Your login ({me?.email ?? "unknown"}) isn&apos;t linked to a staff record yet. An admin can add this email to your record in{" "}
          <Link href="/hr" className="text-brand hover:underline">Staff &amp; HR</Link>.
        </Empty>
      </>
    );

  const [att, tasks, leaves, students, notifications, messages] = await Promise.all([
    repo.staffAttendance(addDays(today, -29), today),
    repo.tasks(staff.id),
    repo.leaveRequests(),
    repo.students(),
    repo.notifications(),
    repo.messages(),
  ]);
  const mine = att.filter((a) => a.staff_id === staff.id);
  const todayMark = mine.find((a) => a.att_date === today)?.status;
  const presentDays = mine.filter((a) => a.status === "present").length + 0.5 * mine.filter((a) => a.status === "half_day").length;
  const myLeaves = leaves.filter((l) => l.staff_id === staff.id);
  const open = tasks.filter((t) => !t.done);
  const active = students.filter((s) => s.status === "active").sort((a, b) => a.attendance_pct - b.attendance_pct);

  return (
    <>
      <PageHeader
        title="My workspace"
        subtitle={`${staff.full_name} · ${staff.designation ?? "Staff"}${staff.department ? ` · ${staff.department}` : ""}`}
        actions={
          todayMark ? (
            <Badge tone="green">Marked {todayMark.replace("_", " ")} today</Badge>
          ) : (
            <form action={checkInAction}><button className="btn-primary"><CalendarCheck size={15} /> Check in for today</button></form>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Days present (30 days)" value={presentDays} icon={<CalendarCheck size={18} />} />
        <Stat label="Open tasks" value={open.length} tone="amber" icon={<CheckSquare size={18} />} />
        <Stat label="Leave requests pending" value={myLeaves.filter((l) => l.status === "pending").length} tone="blue" icon={<CalendarOff size={18} />} />
        <Stat label="Notifications" value={notifications.filter((n) => !n.sent_at).length + messages.slice(0, 5).length} tone="red" icon={<Bell size={18} />} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Daily tasks" icon={<CheckSquare size={15} />} className="xl:col-span-2">
          <form action={addTaskAction} className="mb-3 flex flex-wrap gap-2">
            <input name="title" required placeholder="Add a task for today…" aria-label="New task" className="input min-w-48 flex-1" />
            <input name="due_date" type="date" defaultValue={today} aria-label="Due date" className="input w-auto" />
            <button className="btn-primary">Add</button>
          </form>
          <ul className="divide-y divide-line">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-[13px]">
                <form action={toggleTaskAction.bind(null, t.id, !t.done)}>
                  <button aria-label={t.done ? "Mark not done" : "Mark done"} className={t.done ? "text-brand" : "text-slate-400 hover:text-brand"}>
                    {t.done ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                </form>
                <span className={`flex-1 ${t.done ? "text-muted line-through" : "text-navy"}`}>{t.title}</span>
                {t.due_date && <span className={`text-[11px] ${!t.done && t.due_date < today ? "text-red-600" : "text-muted"}`}>{fmtDate(t.due_date)}</span>}
                <form action={removeTaskAction.bind(null, t.id)}><button className="text-[11px] text-muted hover:text-brand">Delete</button></form>
              </li>
            ))}
            {!tasks.length && <li className="py-3 text-sm text-muted">No tasks yet.</li>}
          </ul>
        </Card>

        <Card title="Leave requests" icon={<CalendarOff size={15} />}>
          <form action={applyLeaveAction} className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">From<input type="date" name="from_date" required defaultValue={today} className="input mt-1 py-1.5" /></label>
            <label className="text-xs text-muted">To<input type="date" name="to_date" required defaultValue={today} className="input mt-1 py-1.5" /></label>
            <label className="text-xs text-muted">Type
              <select name="leave_type" className="input mt-1 py-1.5"><option value="casual">Casual</option><option value="sick">Sick</option><option value="earned">Earned</option><option value="unpaid">Unpaid</option></select>
            </label>
            <label className="text-xs text-muted">Reason<input name="reason" className="input mt-1 py-1.5" /></label>
            <button className="btn-primary col-span-2">Apply for leave</button>
          </form>
          <ul className="mt-3 space-y-2">
            {myLeaves.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-[5px] border border-line px-3 py-2 text-xs">
                <span>{fmtDate(l.from_date)}{l.to_date !== l.from_date ? ` – ${fmtDate(l.to_date)}` : ""} · <span className="capitalize">{l.leave_type}</span></span>
                <Badge tone={l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "amber"}>{l.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Student progress" icon={<GraduationCap size={15} />} className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>Batch</th><th className="w-48">Attendance (30 days)</th><th>Validity</th></tr></thead>
            <tbody>
              {active.slice(0, 12).map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`} className="font-medium text-navy hover:text-brand">{s.full_name}</Link></td>
                  <td>{s.batch_name ?? "—"}</td>
                  <td><div className="flex items-center gap-2"><Progress value={s.attendance_pct} /><span className="text-xs tabular-nums">{s.attendance_pct}%</span></div></td>
                  <td className="text-xs">{s.days_left !== null ? `${s.days_left} days left` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Notifications" icon={<Bell size={15} />}>
          <ul className="space-y-2 text-xs">
            {students
              .filter((s) => s.status !== "expired" && s.days_left !== null && s.days_left >= 0 && s.days_left <= 7)
              .slice(0, 4)
              .map((s) => (
                <li key={s.id} className="rounded-[5px] border border-line p-2"><b className="font-medium text-navy">{s.full_name}</b>: validity ends in {s.days_left} day(s)</li>
              ))}
            {messages.slice(0, 3).map((m) => (
              <li key={m.id} className="rounded-[5px] border border-line p-2"><b className="font-medium text-navy">{m.channel === "whatsapp" ? "WhatsApp" : "Email"} to {m.audience}</b><div className="line-clamp-2 text-muted">{m.body}</div></li>
            ))}
            {open.filter((t) => t.due_date && t.due_date < today).map((t) => (
              <li key={t.id} className="rounded-[5px] border border-red-200 bg-red-50 p-2 text-red-800">Overdue task: {t.title}</li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
