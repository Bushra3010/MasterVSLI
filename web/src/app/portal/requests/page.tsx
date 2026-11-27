import { Flash } from "@/components/student360";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { requireStudent } from "@/lib/session";
import { getStudent360 } from "@/lib/student360";
import { CERTIFICATE_TYPES, REQUEST_KINDS, REQUEST_TONE, requestKindLabel } from "@/lib/types";
import { submitCollegeContactAction, submitRequestAction } from "../actions-360";

export const metadata = { title: "Requests & support" };

export default async function PortalRequests({ searchParams }: PageProps<"/portal/requests">) {
  const sp = await searchParams;
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const kind = typeof sp.kind === "string" && REQUEST_KINDS.some(([k]) => k === sp.kind) ? sp.kind : "support";

  return (
    <>
      <PageHeader title="Requests & Support" subtitle="Certificate applications, validity extensions, support tickets and feedback — tracked until the office closes them." />
      <Flash sp={sp} />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card title="New request" bodyClass="p-4">
          <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Request type">
            {REQUEST_KINDS.map(([k, l]) => (
              <a key={k} href={`/portal/requests?kind=${k}`} className={`rounded-[5px] border px-2 py-1 text-xs ${k === kind ? "border-brand bg-brand text-white" : "border-line text-navy hover:bg-slate-50"}`}>{l}</a>
            ))}
          </nav>
          <form action={submitRequestAction} className="grid gap-3">
            <input type="hidden" name="kind" value={kind} />
            {kind === "certificate" && (
              <div><label className="label" htmlFor="cert_type">Certificate</label><select id="cert_type" name="cert_type" className="input">{CERTIFICATE_TYPES.map((c) => <option key={c}>{c}</option>)}</select></div>
            )}
            {kind === "validity_extension" ? (
              <div>
                <label className="label" htmlFor="months">Extend by</label>
                <select id="months" name="months" className="input">{[1, 2, 3, 6].map((m) => <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>)}</select>
                <p className="mt-1 text-[11px] text-muted">Current validity: {fmtDate(d.p.student.validity_end)}. Approved extensions restore your training access.</p>
              </div>
            ) : (
              <div><label className="label" htmlFor="subject">Subject</label><input id="subject" name="subject" required={kind !== "certificate"} className="input" placeholder={kind === "certificate" ? "Optional" : "Short summary"} /></div>
            )}
            <div><label className="label" htmlFor="details">Details</label><textarea id="details" name="details" rows={4} className="input" /></div>
            <button className="btn-primary">Send {requestKindLabel(kind).toLowerCase()}</button>
          </form>
        </Card>
        <Card title={`Request tracker (${d.requests.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Raised</th><th>Type</th><th>Subject</th><th>Status</th><th>Office response</th></tr></thead>
            <tbody>
              {d.requests.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="text-xs">{requestKindLabel(r.kind)}</td>
                  <td className="font-medium">{r.subject}</td>
                  <td><Badge tone={REQUEST_TONE[r.status]}>{r.status.replace("_", " ")}</Badge></td>
                  <td className="text-xs">{r.response ?? "—"}</td>
                </tr>
              ))}
              {!d.requests.length && <tr><td colSpan={5} className="text-center text-muted">No requests yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
      <Card title="Share your college's TPO / HOD contact" className="mt-5" bodyClass="p-4">
        <form action={submitCollegeContactAction} className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><label className="label" htmlFor="college_name">College</label><input id="college_name" name="college_name" required className="input" /></div>
          <div><label className="label" htmlFor="c_city">City</label><input id="c_city" name="city" className="input" /></div>
          <div><label className="label" htmlFor="contact_name">Contact person</label><input id="contact_name" name="contact_name" required className="input" /></div>
          <div><label className="label" htmlFor="designation">Designation</label><select id="designation" name="designation" className="input"><option>TPO</option><option>HOD</option><option>Principal</option><option>Faculty</option></select></div>
          <div><label className="label" htmlFor="c_phone">Mobile</label><input id="c_phone" name="phone" type="tel" required className="input" /></div>
          <div><label className="label" htmlFor="department">Department</label><input id="department" name="department" placeholder="ECE" className="input" /></div>
          <div className="flex items-end sm:col-span-2"><button className="btn-primary">Share contact</button></div>
        </form>
      </Card>
    </>
  );
}
