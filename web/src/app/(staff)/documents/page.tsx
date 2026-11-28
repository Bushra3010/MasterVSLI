import { FileText, GraduationCap, UserRound } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { TEMPLATES, templateMeta } from "@/lib/letters";
import { getRepo } from "@/lib/server";
import { issueLetterAction } from "../actions";
import { AddStaffForm } from "@/components/add-staff-form";
import { Flash } from "@/components/student360";

export const metadata = { title: "Letters & certificates" };

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const sp = await searchParams;
  const repo = await getRepo();
  const [letters, students, staff] = await Promise.all([repo.letters(), repo.students(), repo.staff()]);
  const tpl = templateMeta(typeof sp.template === "string" ? sp.template : "") ?? TEMPLATES[0];
  // A staff member just added from this page is picked automatically.
  const subject = typeof sp.subject === "string" ? sp.subject : typeof sp.staff_added === "string" ? `staff:${sp.staff_added}` : "";
  const holder = (l: (typeof letters)[number]) =>
    l.student_id ? students.find((s) => s.id === l.student_id)?.full_name : staff.find((s) => s.id === l.staff_id)?.full_name;

  return (
    <>
      <PageHeader title="Letters & certificates" subtitle="Generated with institute branding, a unique serial number and a QR code that anyone can scan to verify." />
      <Flash sp={sp} />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {(["student", "staff"] as const).map((aud) => (
            <Card key={aud} title={aud === "student" ? "For students" : "For staff"} icon={aud === "student" ? <GraduationCap size={15} /> : <UserRound size={15} />}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {TEMPLATES.filter((t) => t.audience === aud).map((t) => (
                  <Link
                    key={t.id}
                    href={`/documents?template=${t.id}${subject ? `&subject=${subject}` : ""}`}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-sm ${t.id === tpl.id ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-navy"}`}
                  >
                    <FileText size={22} />
                    {t.title}
                  </Link>
                ))}
              </div>
            </Card>
          ))}

          <Card title="Issued documents" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Serial no.</th><th>Document</th><th>Issued to</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {letters.map((l) => (
                  <tr key={l.id}>
                    <td className="font-mono text-xs">{l.serial_no}</td>
                    <td>{templateMeta(l.template)?.title}</td>
                    <td>{holder(l)}</td>
                    <td>{fmtDate(l.issued_at)}</td>
                    <td><Link href={`/documents/${l.serial_no}`} className="text-navy underline hover:text-brand">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <Card title={`Generate: ${tpl.title}`} icon={<FileText size={15} />}>
          <form action={issueLetterAction} className="space-y-3">
            <input type="hidden" name="template" value={tpl.id} />
            <div>
              <label className="label">{tpl.audience === "student" ? "Student" : "Staff member"}</label>
              <select name="subject" defaultValue={subject} required className="input">
                <option value="">Select…</option>
                {tpl.audience === "student"
                  ? students.map((s) => <option key={s.id} value={`student:${s.id}`}>{s.full_name} ({s.enrollment_no})</option>)
                  : staff.map((s) => <option key={s.id} value={`staff:${s.id}`}>{s.full_name} — {s.designation}</option>)}
              </select>
            </div>
            {tpl.fields.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input name={`d_${f.key}`} type={f.type ?? "text"} placeholder={f.placeholder} {...(f.type === "date" ? { min: "1990-01-01", max: "2100-12-31" } : {})} className="input" />
              </div>
            ))}
            {tpl.audience === "staff" && !staff.length && (
              <p className="text-xs text-brand">No staff yet — add the staff member below, then generate the letter.</p>
            )}
            <button className="btn-primary w-full">Generate with QR & serial no.</button>
          </form>
          {tpl.audience === "staff" && (
            <details open={!staff.length} className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand">+ Add a new staff member</summary>
              <div className="mt-2"><AddStaffForm back={`/documents?template=${tpl.id}`} compact /></div>
              <p className="mt-2 text-[11px] text-muted">All staff details can be edited later in <Link href="/hr" className="underline">Staff &amp; HR</Link>.</p>
            </details>
          )}
        </Card>
      </div>
    </>
  );
}
