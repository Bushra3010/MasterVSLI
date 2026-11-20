import Link from "next/link";
import { UploadForm } from "@/components/documents-card";
import { Badge, Card, PageHeader } from "@/components/ui";
import { DOC_KINDS, docFileName } from "@/lib/types";
import { portalUploadAction } from "../actions";
import { fmtDate } from "@/lib/format";
import { templateMeta } from "@/lib/letters";
import { getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "My documents" };

export default async function PortalDocuments() {
  const s = await requireStudent();
  const p = await (await getStudentReadRepo()).profile(s.studentId);
  return (
    <>
      <PageHeader title="My documents" subtitle="Letters issued by the institute, and the files you upload for verification." />
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

      <Card title="My uploads" className="mt-5 max-w-2xl">
        <ul className="space-y-2 text-sm">
          {p?.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <a href={`/api/documents/${d.id}`} target="_blank" className="font-medium text-navy hover:text-brand">{DOC_KINDS[d.kind] ?? d.kind}</a>
                <span className="block truncate text-xs text-muted">{docFileName(d.storage_path)}</span>
              </span>
              <Badge tone={d.verified ? "green" : "amber"}>{d.verified ? "Verified" : "Awaiting verification"}</Badge>
            </li>
          ))}
          {!p?.documents.length && <li className="text-muted">Upload your resume, photo, ID proof and certificates here.</li>}
        </ul>
        <UploadForm action={portalUploadAction} kinds={["resume", "photo", "id_proof", "certificate"]} />
      </Card>
    </>
  );
}
