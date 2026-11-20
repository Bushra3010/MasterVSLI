import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { templateMeta } from "@/lib/letters";
import { getRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "My documents" };

export default async function PortalDocuments() {
  const s = await requireStudent();
  const p = await (await getRepo()).profile(s.studentId);
  return (
    <>
      <PageHeader title="My documents" subtitle="Letters and certificates issued to you. Each carries a QR code anyone can scan to verify." />
      <Card bodyClass="p-0">
        <table className="table">
          <thead><tr><th>Document</th><th>Serial no.</th><th>Issued</th><th></th></tr></thead>
          <tbody>
            {p?.letters.map((l) => (
              <tr key={l.id}>
                <td>{templateMeta(l.template)?.title}</td>
                <td className="font-mono text-xs">{l.serial_no}</td>
                <td>{fmtDate(l.issued_at)}</td>
                <td><Link href={`/portal/documents/${l.serial_no}`} className="text-navy underline">View / download</Link></td>
              </tr>
            ))}
            {!p?.letters.length && <tr><td colSpan={4} className="text-center text-muted">Nothing issued yet</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
