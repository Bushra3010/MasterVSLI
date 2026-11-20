import Link from "next/link";
import { Badge, Card, PageHeader, Progress, StatusBadge } from "@/components/ui";
import { inr } from "@/lib/format";
import { getRepo } from "@/lib/server";
import type { StudentStatus } from "@/lib/types";

export const metadata = { title: "Students" };

const STATUSES: (StudentStatus | "all")[] = ["all", "active", "on_hold", "expired", "completed"];

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (typeof sp.status === "string" ? sp.status : "all") as StudentStatus | "all";
  const batch = typeof sp.batch === "string" ? sp.batch : "";
  const repo = await getRepo();
  const [students, batches] = await Promise.all([repo.students({ q, status, batch: batch || undefined }), repo.batches()]);

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${students.length} students`}
        actions={<Link href="/students/new" className="btn-primary">+ New admission</Link>}
      />
      <Card bodyClass="p-0">
        <form className="flex flex-wrap gap-2 border-b border-line p-3">
          <input name="q" defaultValue={q} placeholder="Search name, enrollment no, email, phone" className="input max-w-xs" />
          <select name="status" defaultValue={status} className="input w-auto">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All statuses" : s.replace("_", " ")}</option>
            ))}
          </select>
          <select name="batch" defaultValue={batch} className="input w-auto">
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button className="btn-navy">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course / batch</th>
                <th>Mode</th>
                <th className="w-36">Attendance</th>
                <th>Fees</th>
                <th>Validity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/students/${s.id}`} className="font-medium text-navy hover:text-brand">{s.full_name}</Link>
                    <div className="text-xs text-muted">{s.enrollment_no} · {s.phone}</div>
                  </td>
                  <td>
                    <div className="max-w-56 truncate">{s.course_name}</div>
                    <div className="text-xs text-muted">{s.batch_name}</div>
                  </td>
                  <td className="capitalize">{s.training_mode}</td>
                  <td>
                    <div className="mb-1 text-xs tabular-nums">{s.attendance_pct}%</div>
                    <Progress value={s.attendance_pct} />
                  </td>
                  <td className="tabular-nums">
                    <div>{inr(s.paid)}</div>
                    {s.balance > 0 ? <div className="text-xs text-brand">Due {inr(s.balance)}</div> : <div className="text-xs text-emerald-600">Fully paid</div>}
                  </td>
                  <td>
                    {s.days_left === null ? "—" : s.days_left < 0 ? (
                      <Badge tone="red">Expired</Badge>
                    ) : (
                      <Badge tone={s.days_left <= 7 ? "red" : s.days_left <= 30 ? "amber" : "slate"}>{s.days_left} days</Badge>
                    )}
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
