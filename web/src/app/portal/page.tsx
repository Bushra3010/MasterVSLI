import { AlertTriangle, Bell, Briefcase } from "lucide-react";
import { noticeText } from "@/lib/notify";
import { StudentProfileView } from "@/components/student-profile";
import { PayNow } from "./pay-now";
import { Badge, Card, StatusBadge } from "@/components/ui";
import { daysBetween, fmtDate, todayISO } from "@/lib/format";
import Link from "next/link";
import { getServiceRepo, getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "My dashboard" };

export default async function PortalHome({ searchParams }: PageProps<"/portal">) {
  const sp = await searchParams;
  const s = await requireStudent();
  const repo = await getStudentReadRepo();
  const svc = getServiceRepo();
  const [p, notices, general, placement, allDrives] = await Promise.all([repo.profile(s.studentId), repo.studentNotifications(s.studentId), svc.consentFor(s.studentId, "general"), svc.consentFor(s.studentId, "placement"), svc.drives()]);
  // Open and upcoming drives, soonest first (drives without a date last)
  const drives = allDrives.filter((d) => d.status !== "closed" && (!d.drive_date || d.drive_date >= todayISO())).sort((a, b) => (a.drive_date ?? "9999").localeCompare(b.drive_date ?? "9999")).slice(0, 6);
  if (!p) return <p>Profile not found.</p>;
  const st = p.student;
  const left = st.validity_end ? daysBetween(todayISO(), st.validity_end) : null;
  return (
    <>
      <div className="mb-5 rounded-[5px] bg-navy p-5 text-white">
        <div className="text-sm opacity-80">Welcome back,</div>
        <h1 className="text-2xl font-semibold">{st.full_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono opacity-90">{st.enrollment_no}</span>
          <StatusBadge status={st.status} />
          {left !== null && <Badge tone={left <= 30 ? "amber" : "slate"}>Access valid till {fmtDate(st.validity_end)}</Badge>}
        </div>
      </div>
      {general.required && (
        <Link href="/portal/terms" className="mb-5 flex items-center justify-between gap-3 rounded-[5px] border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <span><b>Action needed:</b> please read and accept the MasterVLSI Terms &amp; Conditions.</span><span className="btn-primary">Review &amp; accept</span>
        </Link>
      )}
      {placement.required && (
        <Link href="/portal/agreement" className="mb-5 flex items-center justify-between gap-3 rounded-[5px] border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          <span>Your <b>Placement Profile is not active</b>. Accept the placement terms to apply for company drives and join the placement group.</span><span className="btn bg-orange-500 text-white">Activate</span>
        </Link>
      )}
      {st.status !== "active" && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="shrink-0" size={18} />
          Your account is <b>{st.status.replace("_", " ")}</b>. Zoom, recorded classes, biometric entry, placement applications and
          training materials are paused until the institute re-activates or renews your access.
        </div>
      )}
      {left !== null && left >= 0 && left <= 30 && st.status === "active" && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your training access expires in <b>{left} days</b>. Contact the office to renew.
        </div>
      )}
      {notices.length > 0 && (
        <Card title="Notices" icon={<Bell size={15} />} className="mb-5">
          <ul className="space-y-2 text-sm">
            {notices.slice(0, 5).map((n) => (
              <li key={n.id} className="flex justify-between gap-3">
                <span>{noticeText(n.kind, st.full_name, st.validity_end).subject}</span>
                <span className="shrink-0 text-xs text-muted">{fmtDate(n.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {sp.paid && (
        <div className="mb-5 rounded-[5px] border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Thank you! Your payment is being confirmed. The receipt appears under Fee &amp; payment summary within a minute.
        </div>
      )}
      {drives.length > 0 && (
        <Card title="Upcoming company drives" icon={<Briefcase size={15} />} className="mb-5" bodyClass="p-0 overflow-x-auto" actions={<Link href="/portal/drives" className="text-xs underline">Respond to drives →</Link>}>
          <table className="table">
            <thead><tr><th>Date</th><th>Company</th><th>Role</th><th>Location · mode</th><th>Status</th><th>My answer</th></tr></thead>
            <tbody>
              {drives.map((d) => {
                const mine = p.responses.find((r) => r.drive_id === d.id);
                return (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap">{d.drive_date ? fmtDate(d.drive_date) : "Date TBA"}{d.drive_date && <div className="text-[11px] text-muted">in {daysBetween(todayISO(), d.drive_date)} days</div>}</td>
                    <td className="font-medium">{d.company}</td>
                    <td>{d.job_role}{d.ctc && <div className="text-[11px] text-muted">CTC {d.ctc}</div>}</td>
                    <td className="text-xs">{[d.location, d.interview_mode].filter(Boolean).join(" · ") || "—"}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td>{mine ? <StatusBadge status={mine.response} /> : d.status === "open" ? <Link href="/portal/drives" className="text-xs font-medium text-navy underline">Answer now</Link> : <span className="text-xs text-muted">Opens soon</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <StudentProfileView p={p} receiptBase="/portal/receipt/" paymentControl={(id) => <PayNow installmentId={id} />} />
    </>
  );
}
