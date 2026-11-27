import { Flash } from "@/components/student360";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { requireStudent } from "@/lib/session";
import { getStudent360 } from "@/lib/student360";
import { RESUME_DOMAINS } from "@/lib/types";
import { addResumeAction, removeResumeAction, setDefaultResumeAction } from "../actions-360";

export const metadata = { title: "Resume library" };

export default async function PortalResumes({ searchParams }: PageProps<"/portal/resumes">) {
  const sp = await searchParams;
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const { resumes } = d;

  return (
    <>
      <PageHeader title="Resume Library" subtitle="Keep a resume for each domain. When you say Yes to a company drive, choose the resume to send." />
      <Flash sp={sp} />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card title={`My resumes (${resumes.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Resume</th><th>Domain</th><th>Version</th><th>Added</th><th /></tr></thead>
            <tbody>
              {resumes.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.title} {r.is_default && <Badge tone="green">Default</Badge>}</td>
                  <td>{r.domain ?? "—"}</td>
                  <td>{r.version}</td>
                  <td className="whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-2 text-xs">
                      {r.document_id && <a href={`/api/documents/${r.document_id}`} target="_blank" className="font-medium text-brand underline">Open</a>}
                      {!r.is_default && <form action={setDefaultResumeAction.bind(null, r.id)}><button className="text-navy underline">Make default</button></form>}
                      <form action={removeResumeAction.bind(null, r.id)}><button className="text-muted underline hover:text-red-600">Remove</button></form>
                    </div>
                  </td>
                </tr>
              ))}
              {!resumes.length && <tr><td colSpan={5} className="text-center text-muted">No resumes yet. Add your first one.</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title="Add a resume" bodyClass="p-4">
          <form action={addResumeAction} className="grid gap-3">
            <div><label className="label" htmlFor="title">Resume name</label><input id="title" name="title" required placeholder="DV Resume" className="input" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="domain">Domain</label><select id="domain" name="domain" className="input">{RESUME_DOMAINS.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label className="label" htmlFor="version">Version</label><input id="version" name="version" defaultValue="v1" className="input" /></div>
            </div>
            <div><label className="label" htmlFor="file">File (PDF or Word, max 5 MB)</label><input id="file" name="file" type="file" required accept=".pdf,.doc,.docx" className="input" /></div>
            <button className="btn-primary">Add resume</button>
          </form>
        </Card>
      </div>
    </>
  );
}
