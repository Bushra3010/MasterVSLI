import { CalendarCheck, CalendarOff, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { I, Row, Save } from "@/components/form-bits";
import { Badge, Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { addDays, fmtDate, inr, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import type { StaffAttStatus } from "@/lib/types";
import { saveStaffAction } from "../actions";
import { addLeaveAction, addTaskAction, decideLeaveAction, generatePayrollAction, markPayrollPaidAction, markStaffAttendanceAction, toggleTaskAction } from "../module-actions";

export const metadata = { title: "Staff & HR" };

const ATT: Record<StaffAttStatus, string> = { present: "P", half_day: "½", leave: "L", absent: "A" };
const attTone: Record<StaffAttStatus, string> = {
  present: "bg-emerald-100 text-emerald-800",
  half_day: "bg-amber-100 text-amber-800",
  leave: "bg-blue-100 text-blue-800",
  absent: "bg-red-100 text-red-800",
};

export default async function HrPage({ searchParams }: PageProps<"/hr">) {
  const sp = await searchParams;
  const today = todayISO();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const days = Array.from({ length: 14 }, (_, k) => addDays(today, -13 + k));

  const repo = await getRepo();
  const [tasks, staff, att, leaves, payroll] = await Promise.all([repo.tasks(), repo.staff(), repo.staffAttendance(days[0] < date ? days[0] : date, today > date ? today : date), repo.leaveRequests(), repo.payroll(month)]);
  const name = new Map(staff.map((s) => [s.id, s.full_name]));
  const mark = (staffId: string, d: string) => att.find((a) => a.staff_id === staffId && a.att_date === d)?.status;
  const todayMarks = staff.map((s) => mark(s.id, today));

  return (
    <>
      <PageHeader title="Staff & HR" subtitle="Staff records, daily staff attendance, leave requests and monthly payroll." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Staff" value={staff.length} />
        <Stat label="Present today" value={todayMarks.filter((m) => m === "present" || m === "half_day").length} tone="green" hint={`${todayMarks.filter((m) => !m).length} not marked`} />
        <Stat label="Pending leave requests" value={leaves.filter((l) => l.status === "pending").length} tone="amber" />
        <Stat label="Monthly payroll" value={inr(staff.reduce((a, s) => a + Number(s.monthly_salary ?? 0), 0))} tone="blue" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Staff attendance (last 14 days)" icon={<CalendarCheck size={15} />} bodyClass="p-0 overflow-x-auto">
          <table className="table text-xs">
            <thead><tr><th>Staff</th>{days.map((d) => <th key={d} className="px-1 text-center">{d.slice(8)}</th>)}</tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap font-medium">{s.full_name}</td>
                  {days.map((d) => {
                    const m = mark(s.id, d);
                    return <td key={d} className="px-1 text-center">{m ? <span className={`inline-block w-5 rounded ${attTone[m]}`}>{ATT[m]}</span> : <span className="text-slate-300">·</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Mark attendance">
          <form className="mb-3 flex items-center gap-2 text-sm">
            <input type="date" name="date" defaultValue={date} max={today} aria-label="Attendance date" className="input w-auto py-1.5" />
            <button className="btn-ghost py-1.5 text-xs">Load</button>
          </form>
          <form key={`${date}:${staff.map((s) => mark(s.id, date) ?? "").join(",")}`} action={markStaffAttendanceAction}>
            <input type="hidden" name="date" value={date} />
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-sm last:border-0">
                <span>{s.full_name}</span>
                <select name={`att_${s.id}`} defaultValue={mark(s.id, date) ?? "present"} aria-label={`${s.full_name} attendance`} className="input w-auto py-1">
                  <option value="present">Present</option><option value="half_day">Half day</option><option value="leave">Leave</option><option value="absent">Absent</option>
                </select>
              </div>
            ))}
            <button className="btn-primary mt-3 w-full">Save attendance for {fmtDate(date)}</button>
          </form>
        </Card>
      </div>

      <Card title={`Daily tasks (${tasks.filter((t) => !t.done).length} open)`} icon={<CalendarCheck size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <form action={addTaskAction} className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <select name="staff_id" required aria-label="Assign to" className="input w-auto py-1.5">
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <input name="title" required placeholder="Task, e.g. Evaluate assignment 3" aria-label="Task" className="input min-w-48 flex-1 py-1.5" />
          <input name="due_date" type="date" defaultValue={today} aria-label="Due date" className="input w-auto py-1.5" />
          <Save label="Assign task" />
        </form>
        <table className="table">
          <thead><tr><th>Staff</th><th>Task</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {tasks.slice(0, 15).map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{name.get(t.staff_id)}</td>
                <td className={t.done ? "text-muted line-through" : ""}>{t.title}</td>
                <td className={!t.done && t.due_date && t.due_date < today ? "text-red-600" : ""}>{fmtDate(t.due_date)}</td>
                <td><form action={toggleTaskAction.bind(null, t.id, !t.done)}><button><Badge tone={t.done ? "green" : "amber"}>{t.done ? "Done" : "Open"}</Badge></button></form></td>
              </tr>
            ))}
            {!tasks.length && <tr><td colSpan={4} className="text-center text-muted">No tasks yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Leave requests" icon={<CalendarOff size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Staff</th><th>Dates</th><th>Type</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>
            {leaves.map((l) => (
              <tr key={l.id}>
                <td className="font-medium">{name.get(l.staff_id)}</td>
                <td>{fmtDate(l.from_date)}{l.to_date !== l.from_date && ` → ${fmtDate(l.to_date)}`}</td>
                <td className="capitalize">{l.leave_type}</td>
                <td className="text-sm text-muted">{l.reason ?? "—"}</td>
                <td><Badge tone={l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "amber"}>{l.status}</Badge></td>
                <td className="whitespace-nowrap text-xs">
                  {l.status === "pending" && (
                    <>
                      <form action={decideLeaveAction.bind(null, l.id, "approved")} className="inline"><button className="text-emerald-700 hover:underline">Approve</button></form>
                      {" · "}
                      <form action={decideLeaveAction.bind(null, l.id, "rejected")} className="inline"><button className="text-brand hover:underline">Reject</button></form>
                    </>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={6}>
                <form action={addLeaveAction} className="flex flex-wrap items-center gap-2">
                  <select name="staff_id" required aria-label="Staff" className="input w-auto py-1.5">
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <input type="date" name="from_date" required defaultValue={today} aria-label="From" className="input w-auto py-1.5" />
                  <input type="date" name="to_date" required defaultValue={today} aria-label="To" className="input w-auto py-1.5" />
                  <select name="leave_type" aria-label="Leave type" className="input w-auto py-1.5">
                    <option value="casual">Casual</option><option value="sick">Sick</option><option value="earned">Earned</option><option value="unpaid">Unpaid</option>
                  </select>
                  <input name="reason" placeholder="Reason" aria-label="Reason" className="input min-w-40 flex-1 py-1.5" />
                  <Save label="+ Add leave" />
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card
        title={`Payroll · ${month}`}
        icon={<Wallet size={15} />}
        className="mt-5"
        bodyClass="p-0 overflow-x-auto"
        actions={
          <form action={generatePayrollAction} className="flex items-center gap-1">
            <input type="month" name="month" defaultValue={month} aria-label="Payroll month" className="input w-auto py-1 text-xs" />
            <button className="btn-primary py-1 text-xs">Generate</button>
          </form>
        }
      >
        <table className="table">
          <thead><tr><th>Staff</th><th>Working days</th><th>Paid days</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th><th /></tr></thead>
          <tbody>
            {payroll.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{name.get(p.staff_id)}</td>
                <td>{p.working_days}</td>
                <td>{p.paid_days}</td>
                <td className="tabular-nums">{inr(p.gross)}</td>
                <td className="tabular-nums text-brand">{Number(p.deductions) ? `− ${inr(p.deductions)}` : "—"}</td>
                <td className="tabular-nums font-semibold">{inr(p.net)}</td>
                <td><StatusBadge status={p.status} />{p.paid_at && <div className="text-[11px] text-muted">{fmtDate(p.paid_at)}</div>}</td>
                <td className="whitespace-nowrap text-xs">
                  {p.status === "pending" && <form action={markPayrollPaidAction.bind(null, p.id)} className="inline"><button className="text-emerald-700 hover:underline">Mark paid</button></form>}
                  {" · "}
                  <Link href={`/documents?template=payslip&subject=staff:${p.staff_id}`} className="hover:text-brand">Payslip</Link>
                </td>
              </tr>
            ))}
            {!payroll.length && <tr><td colSpan={8} className="text-center text-muted">No payroll for {month} yet. Pick the month and press Generate. Absent days are unpaid and half days count ½.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Staff records" icon={<UserRound size={15} />} className="mt-5">
        {staff.map((s) => (
          <Row key={s.id} action={saveStaffAction}>
            <input type="hidden" name="id" value={s.id} />
            <I name="employee_code" value={s.employee_code} w="w-24" required placeholder="Emp. code" />
            <I name="full_name" value={s.full_name} w="min-w-36 flex-1" required placeholder="Full name" />
            <I name="designation" value={s.designation} w="w-40" placeholder="Designation" />
            <I name="department" value={s.department} w="w-32" placeholder="Department" />
            <I name="joining_date" type="date" value={s.joining_date} w="w-40" placeholder="Joining date" />
            <I name="monthly_salary" type="number" value={s.monthly_salary} w="w-28" placeholder="Monthly ₹" />
            <I name="email" type="email" value={s.email} w="w-44" placeholder="Email" />
            <I name="phone" value={s.phone} w="w-32" placeholder="Phone" />
            <Save />
          </Row>
        ))}
        <Row action={saveStaffAction}>
          <I name="employee_code" w="w-24" required placeholder="Emp. code" />
          <I name="full_name" w="min-w-36 flex-1" required placeholder="Full name" />
          <I name="designation" w="w-40" placeholder="Designation" />
          <I name="department" w="w-32" placeholder="Department" />
          <I name="joining_date" type="date" w="w-40" placeholder="Joining date" />
          <I name="monthly_salary" type="number" w="w-28" placeholder="Monthly ₹" />
          <I name="email" type="email" w="w-44" placeholder="Email" />
          <I name="phone" w="w-32" placeholder="Phone" />
          <Save label="+ Add staff" />
        </Row>
      </Card>
    </>
  );
}
