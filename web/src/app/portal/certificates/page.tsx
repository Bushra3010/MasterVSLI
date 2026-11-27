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

  // §2 One lifecycle row per document: the application and whatever it became.
  // An issued letter with no application still appears, so nothing is hidden.
  const claimed = new Set<string>();
  const lifecycle = apps.map((r) => {
    const match = issued.find((l) => !claimed.has(l.id) && (templateMeta(l.template)?.title ?? "").toLowerCase() === r.subject.toLowerCase());
    if (match) claimed.add(match.id);
    return {
      key: r.id,
      type: r.subject,
      applied: r.created_at,
      status: match ? "issued" : r.status,
      tone: match ? ("green" as const) : REQUEST_TONE[r.status],
      serial: match?.serial_no ?? null,
      issued_at: match?.issued_at ?? null,
      remarks: r.response ?? null,
    };
  });
  for (const l of issued.filter((x) => !claimed.has(x.id)))
    lifecycle.push({
      key: l.id, type: templateMeta(l.template)?.title ?? l.template, applied: l.issued_at,
      status: "issued", tone: "green" as const, serial: l.serial_no, issued_at: l.issued_at, remarks: null,
    });
  lifecycle.sort((a, b) => (b.applied ?? "").localeCompare(a.applied ?? ""));

  return (
    <>
      <PageHeader
        title="Certificates"
        subtitle="One row per document — application, office approval, certificate number and the issued file."
        actions={<Link href="/portal/requests?kind=certificate" className="btn-primary">Apply for a certificate</Link>}
      />
      <Card title={`Document lifecycle (${lifecycle.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Document type</th><th>Applied</th><th>Status</th><th>Certificate no.</th><th>Issued</th><th>Remarks</th><th /></tr></thead>
          <tbody>
            {lifecycle.map((r) => (
              <tr key={r.key}>
                <td className="font-medium">{r.type}</td>
                <td className="whitespace-nowrap text-xs">{fmtDate(r.applied)}</td>
                <td><Badge tone={r.tone}>{r.status.replace("_", " ")}</Badge></td>
                <td className="font-mono text-xs">{r.serial ?? "—"}</td>
                <td className="whitespace-nowrap text-xs">{r.issued_at ? fmtDate(r.issued_at) : "—"}</td>
                <td className="text-xs text-muted">{r.remarks ?? "—"}</td>
                <td>{r.serial ? <Link href={`/portal/documents/${r.serial}`} className="text-xs text-navy underline">Download</Link> : null}</td>
              </tr>
            ))}
            {!lifecycle.length && <tr><td colSpan={7} className="text-center text-muted">Nothing applied for or issued yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
