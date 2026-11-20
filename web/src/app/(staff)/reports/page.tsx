import { BarChart3, Briefcase, CalendarDays, Download, IndianRupee, Users } from "lucide-react";
import { Card, PageHeader, Progress, Stat } from "@/components/ui";
import { addDays, inr, titleCase, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";

export const metadata = { title: "Reports" };

function Bars({ rows, format = (n: number) => String(n), tone = "bg-navy" }: { rows: [string, number][]; format?: (n: number) => string; tone?: string }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div className="space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-2 text-sm">
          <span className="truncate text-muted">{k}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${(100 * v) / max}%` }} /></div>
          <span className="text-right tabular-nums">{format(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage() {
  const repo = await getRepo();
  const today = todayISO();
  const [students, courses, { installments, payments }, att, drives, responses, stats] = await Promise.all([
    repo.students(),
    repo.courses(),
    repo.ledger(),
    repo.attendance(addDays(today, -29), today),
    repo.drives(),
    repo.responses(),
    repo.dashboard(),
  ]);

  const byStatus = Object.entries(students.reduce<Record<string, number>>((a, s) => ((a[s.status] = (a[s.status] ?? 0) + 1), a), {})).map(([k, v]) => [titleCase(k), v] as [string, number]);
  const byCourse = courses.map((c) => [c.code, students.filter((s) => s.course_id === c.id).length] as [string, number]);

  const months = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - (5 - k));
    return d.toISOString().slice(0, 7);
  });
  const collection = months.map((m) => [m, payments.filter((p) => p.paid_at.startsWith(m)).reduce((a, p) => a + Number(p.amount), 0)] as [string, number]);
  const dueByMonth = months.map((m) => [m, installments.filter((i) => i.due_date.startsWith(m)).reduce((a, i) => a + Number(i.amount), 0)] as [string, number]);

  const days = Array.from({ length: 14 }, (_, k) => addDays(today, -13 + k));
  const daily = days.map((d) => [d.slice(5), new Set(att.filter((r) => r.session_date === d).map((r) => r.student_id)).size] as [string, number]);
  const bySource = (["zoom", "teamviewer", "biometric", "manual"] as const).map((src) => [titleCase(src), att.filter((r) => r.source === src).length] as [string, number]);
  const avgMinutes = att.length ? Math.round(att.reduce((a, r) => a + r.duration_minutes, 0) / att.length) : 0;

  const placement = drives.map((d) => {
    const rs = responses.filter((r) => r.drive_id === d.id);
    return { d, yes: rs.filter((r) => r.response === "yes").length, offered: rs.filter((r) => r.stage === "Offered").length, total: rs.length };
  });

  const exports = [
    { href: "/api/export/students", label: "Students" },
    { href: "/api/export/fees", label: "Fees & installments" },
    { href: `/api/export/attendance?from=${addDays(today, -30)}&to=${today}`, label: "Attendance (30 days)" },
    { href: "/api/export/placements", label: "Placements" },
    { href: "/api/export/finance", label: "Accounts cash book" },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Students, fees, attendance and placements at a glance, with Excel (CSV) exports."
        actions={exports.map((e) => (
          <a key={e.href} href={e.href} className="btn-ghost text-xs"><Download size={14} /> {e.label}</a>
        ))}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Students" value={stats.total} hint={`${stats.active} active · ${stats.on_hold} on hold`} icon={<Users size={16} />} />
        <Stat label="Fees collected" value={inr(stats.collected)} tone="green" hint={`${inr(stats.pending_fees)} pending`} icon={<IndianRupee size={16} />} />
        <Stat label="Avg session length" value={`${avgMinutes} min`} tone="blue" hint={`${stats.irregular} irregular students`} icon={<CalendarDays size={16} />} />
        <Stat label="Interested in drives" value={stats.interested} tone="amber" hint={`${stats.open_drives} open drives`} icon={<Briefcase size={16} />} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Students by status" icon={<Users size={15} />}><Bars rows={byStatus} /></Card>
        <Card title="Students by course" icon={<BarChart3 size={15} />}><Bars rows={byCourse} tone="bg-blue-500" /></Card>
        <Card title="Fee collection (last 6 months)" icon={<IndianRupee size={15} />}><Bars rows={collection} format={inr} tone="bg-emerald-500" /></Card>
        <Card title="Installments falling due (last 6 months)" icon={<IndianRupee size={15} />}><Bars rows={dueByMonth} format={inr} tone="bg-amber-500" /></Card>
        <Card title="Students present per day (14 days)" icon={<CalendarDays size={15} />}><Bars rows={daily} /></Card>
        <Card title="Attendance by source (30 days)" icon={<CalendarDays size={15} />}><Bars rows={bySource} tone="bg-violet-500" /></Card>
      </div>

      <Card title="Placement drives" icon={<Briefcase size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Responses</th><th>Interested</th><th className="w-48">Interest rate</th><th>Offers</th></tr></thead>
          <tbody>
            {placement.map(({ d, yes, offered, total }) => (
              <tr key={d.id}>
                <td className="font-medium">{d.company}</td>
                <td>{d.job_role}</td>
                <td className="capitalize">{d.status}</td>
                <td>{total}</td>
                <td>{yes}</td>
                <td><div className="flex items-center gap-2"><Progress value={total ? (100 * yes) / total : 0} /><span className="text-xs tabular-nums">{total ? Math.round((100 * yes) / total) : 0}%</span></div></td>
                <td>{offered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
