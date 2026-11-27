import { Lock } from "lucide-react";
import { Flash } from "@/components/student360";
import { Card, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { requireStudent } from "@/lib/session";
import { getStudent360, isAlumni } from "@/lib/student360";
import { ALUMNI_PARTICIPATION } from "@/lib/types";
import { saveAlumniAction } from "../actions-360";

export const metadata = { title: "Alumni profile" };

export default async function PortalAlumni({ searchParams }: PageProps<"/portal/alumni">) {
  const sp = await searchParams;
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const st = d.p.student;
  if (!isAlumni(st))
    return (
      <div className="flex items-center gap-3 rounded-[5px] border border-line bg-slate-50 p-5 text-sm text-muted">
        <Lock size={18} /> The Alumni Profile opens after your training validity ends ({fmtDate(st.validity_end)}).
      </div>
    );
  const a = st.extra?.alumni ?? {};
  const placed = st.extra?.placement;
  const F = (name: string, label: string, value?: string, type = "text") => (
    <div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} type={type} defaultValue={value ?? ""} className="input" /></div>
  );

  return (
    <>
      <PageHeader title="Alumni Profile" subtitle={`Your training validity ended on ${fmtDate(st.validity_end)}. Stay connected with MasterVLSI — your Student ID ${st.enrollment_no} stays the same.`} />
      {sp.first && !a.updated_at && <div role="status" className="mb-4 rounded-[5px] border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">Welcome to the MasterVLSI alumni network! Please take a minute to update your career details.</div>}
      <Flash sp={sp} />
      <form action={saveAlumniAction} className="space-y-5">
        <Card title="Career information" bodyClass="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {F("company", "Current company", a.company ?? placed?.company)}
            {F("designation", "Designation", a.designation ?? placed?.designation)}
            {F("location", "Job location", a.location ?? placed?.location)}
            {F("package", "Package (CTC)", a.package ?? placed?.package)}
            {F("since", "Working here since", a.since ?? placed?.doj, "date")}
            {F("linkedin", "LinkedIn", a.linkedin ?? st.linkedin ?? undefined, "url")}
          </div>
        </Card>
        <Card title="Company changes" bodyClass="p-4">
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <input name={`chg.${i}.company`} defaultValue={a.changes?.[i]?.company ?? ""} placeholder="Previous company" aria-label={`Previous company ${i + 1}`} className="input" />
                <input name={`chg.${i}.designation`} defaultValue={a.changes?.[i]?.designation ?? ""} placeholder="Designation" aria-label={`Designation ${i + 1}`} className="input" />
                <input name={`chg.${i}.from`} type="month" defaultValue={a.changes?.[i]?.from ?? ""} aria-label={`From ${i + 1}`} className="input" />
              </div>
            ))}
          </div>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Hiring references" bodyClass="p-4">
            <label className="label" htmlFor="hiring">Openings at your company you can refer MasterVLSI students to</label>
            <textarea id="hiring" name="hiring" rows={4} defaultValue={a.hiring ?? ""} className="input" />
          </Card>
          <Card title="Alumni participation" bodyClass="p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {ALUMNI_PARTICIPATION.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" name="participation" value={p} defaultChecked={a.participation?.includes(p)} className="size-4" /> {p}</label>
              ))}
            </div>
          </Card>
        </div>
        <div className="flex items-center justify-end gap-3">
          {a.updated_at && <span className="text-xs text-muted">Last updated {fmtDate(a.updated_at)}</span>}
          <button className="btn-primary">Save alumni profile</button>
        </div>
      </form>
    </>
  );
}
