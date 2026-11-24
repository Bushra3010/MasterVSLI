import Link from "next/link";
import { Badge, Card, PageHeader, Progress, StatusBadge } from "@/components/ui";
import { inr } from "@/lib/format";
import { getRepo } from "@/lib/server";
import type { Branch, Client, College, StudentStatus } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { setEnquiryStatusAction } from "../module-actions";

export const metadata = { title: "Students" };

const STATUSES: (StudentStatus | "all")[] = ["all", "active", "on_hold", "expired", "completed"];

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (typeof sp.status === "string" ? sp.status : "all") as StudentStatus | "all";
  const batch = typeof sp.batch === "string" ? sp.batch : "";
  const repo = await getRepo();
  const category = typeof sp.category === "string" ? sp.category : "";
  const branch = typeof sp.branch === "string" ? sp.branch : "";
  const [all, batches, enquiries, branches, colleges, clients] = await Promise.all([
    repo.students({ q, status, batch: batch || undefined }), repo.batches(), repo.enquiries(),
    repo.list<Branch>("branches"), repo.list<College>("colleges"), repo.list<Client>("clients"),
  ]);
  const students = all.filter((s) => (!category || (s.category ?? "normal") === category) && (!branch || s.branch_id === branch));
  const orgName = new Map([...colleges.map((c) => [c.id, c.name] as const), ...clients.map((c) => [c.id, c.name] as const)]);
  const openEnquiries = enquiries.filter((e) => e.status === "new" || e.status === "contacted");

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${students.length} students`}
        actions={<><Link href="/leads" className="btn-soft">Lead pipeline</Link><Link href="/apply" target="_blank" className="btn-ghost">Public admission form ↗</Link><Link href="/students/new" className="btn-primary">+ New admission</Link></>}
      />
      {openEnquiries.length > 0 && (
        <Card title={<>Website admission enquiries <Badge tone="amber">{openEnquiries.length}</Badge></>} className="mb-5" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Received</th><th>Name</th><th>Contact</th><th>Course</th><th>Message</th><th>Status</th><th /></tr></thead>
            <tbody>
              {openEnquiries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{fmtDate(e.created_at)}<div className="text-[11px] text-muted">{e.source}</div></td>
                  <td className="font-medium">{e.full_name}<div className="text-[11px] text-muted">{e.city}</div></td>
                  <td className="text-xs">{e.phone}<div>{e.email}</div></td>
                  <td>{e.course_code ?? "—"}</td>
                  <td className="max-w-64 text-xs text-muted">{e.message ?? "—"}</td>
                  <td><Badge tone={e.status === "new" ? "blue" : "amber"}>{e.status}</Badge></td>
                  <td className="whitespace-nowrap text-xs">
                    <Link href={`/students/new?enquiry=${e.id}`} className="font-medium text-brand hover:underline">Admit</Link>
                    {e.status === "new" && <>{" · "}<form action={setEnquiryStatusAction.bind(null, e.id, "contacted")} className="inline"><button className="hover:text-brand">Contacted</button></form></>}
                    {" · "}<form action={setEnquiryStatusAction.bind(null, e.id, "closed")} className="inline"><button className="text-muted hover:text-brand">Close</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
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
          <select name="category" defaultValue={category} aria-label="Category" className="input w-auto">
            <option value="">All categories</option><option value="normal">Normal (retail)</option><option value="college">College / TPO</option><option value="corporate">Corporate</option>
          </select>
          <select name="branch" defaultValue={branch} aria-label="Branch" className="input w-auto">
            <option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/students/${s.id}`} className="font-medium text-navy hover:text-brand">{s.full_name}</Link>
                    <div className="text-xs text-muted">{s.enrollment_no} · {s.phone}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <Badge tone={s.category === "college" ? "blue" : s.category === "corporate" ? "green" : "amber"}>{s.category === "college" ? "College" : s.category === "corporate" ? "Corporate" : "Normal"}</Badge>
                      {(s.college_id || s.client_id) && <span className="text-[11px] text-muted">{orgName.get(s.college_id ?? s.client_id ?? "")}</span>}
                    </div>
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
                  <td><Link href={`/students/${s.id}/report`} className="text-xs font-medium text-navy underline hover:text-brand" title={`Download ${s.full_name}'s report`}>Download</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
