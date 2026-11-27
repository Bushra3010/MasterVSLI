import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { templateMeta } from "@/lib/letters";
import { requireStudent } from "@/lib/session";
import { getStudent360 } from "@/lib/student360";
import { REQUEST_TONE } from "@/lib/types";

export const metadata = { title: "Certificates" };

export default async function PortalCertificates() {
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const apps = d.requests.filter((r) => r.kind === "certificate" || r.kind === "document");
  const issued = d.p.letters.filter((l) => !l.revoked);

  return (
    <>
      <PageHeader title="Certificates" subtitle="Apply for a certificate, follow the office approval, and download issued documents." actions={<Link href="/portal/requests?kind=certificate" className="btn-primary">Apply for a certificate</Link>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Applications & office approvals (${apps.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Applied</th><th>Certificate</th><th>Office approval</th></tr></thead>
            <tbody>
              {apps.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="font-medium">{r.subject}</td>
                  <td><Badge tone={REQUEST_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>{r.response && <div className="text-[11px] text-muted">{r.response}</div>}</td>
                </tr>
              ))}
              {!apps.length && <tr><td colSpan={3} className="text-center text-muted">No applications yet.</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title={`Issued documents (${issued.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Document</th><th>Serial no.</th><th>Issued</th><th /></tr></thead>
            <tbody>
              {issued.map((l) => (
                <tr key={l.id}>
                  <td>{templateMeta(l.template)?.title}</td>
                  <td className="font-mono text-xs">{l.serial_no}</td>
                  <td>{fmtDate(l.issued_at)}</td>
                  <td><Link href={`/portal/documents/${l.serial_no}`} className="text-navy underline">View / download</Link></td>
                </tr>
              ))}
              {!issued.length && <tr><td colSpan={4} className="text-center text-muted">Nothing issued yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
