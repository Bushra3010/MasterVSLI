import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card, PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/server";
import type { Branch, Client, College } from "@/lib/types";
import { updateProfileAction } from "../../../actions";

export const metadata = { title: "Edit student" };

const EDU_LEVELS = ["10th", "12th / Diploma", "B.Tech / B.E", "M.Tech / PG"];

function F({ label, name, value, type = "text", placeholder, wide }: { label: string; name: string; value?: string | number | null; type?: string; placeholder?: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} className="input" />
    </div>
  );
}
function S({ label, name, value, options }: { label: string; name: string; value?: string | null; options: (string | [string, string])[] }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="">—</option>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}
function C({ label, name, checked }: { label: string; name: string; checked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-[var(--color-brand)]" /> {label}
    </label>
  );
}
const Grid = ({ children }: { children: ReactNode }) => <div className="grid gap-3 sm:grid-cols-2">{children}</div>;

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const [p, courses, batches, branches, colleges, clients] = await Promise.all([repo.profile(id), repo.courses(), repo.batches(), repo.list<Branch>("branches"), repo.list<College>("colleges"), repo.list<Client>("clients")]);
  if (!p) notFound();
  const s = p.student;
  const pr = s.professional ?? {};
  const ref = (c: string) => p.access.find((a) => a.channel === c)?.external_ref ?? "";
  const edu = (level: string) => p.education.find((e) => e.level === level);

  return (
    <>
      <PageHeader
        title={`Edit — ${s.full_name}`}
        subtitle={`${s.enrollment_no} · fee and installments are managed under Fees`}
        actions={<Link href={`/students/${id}`} className="btn-ghost">Cancel</Link>}
      />
      <form action={updateProfileAction.bind(null, id)} className="grid gap-5 xl:grid-cols-2">
        <Card title="Personal information">
          <Grid>
            <F label="Full name *" name="full_name" value={s.full_name} wide />
            <F label="Date of birth" name="dob" type="date" value={s.dob} />
            <S label="Gender" name="gender" value={s.gender} options={["Female", "Male", "Other"]} />
            <S label="Marital status" name="marital_status" value={s.marital_status} options={["Single", "Married", "Other"]} />
            <S label="Blood group" name="blood_group" value={s.blood_group} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
            <F label="Nationality" name="nationality" value={s.nationality} />
            <F label="Native place" name="native_place" value={s.native_place} />
            <F label="Languages (comma separated)" name="languages" value={s.languages?.join(", ")} wide />
          </Grid>
        </Card>

        <Card title="Contact information">
          <Grid>
            <F label="Primary mobile" name="phone" value={s.phone} />
            <F label="Alternate mobile" name="alt_phone" value={s.alt_phone} />
            <F label="Email" name="email" type="email" value={s.email} />
            <F label="Alternate email" name="alt_email" type="email" value={s.alt_email} />
            <F label="LinkedIn" name="linkedin" value={s.linkedin} />
            <F label="Resume link" name="resume_url" type="url" value={s.resume_url} placeholder="https://…" />
          </Grid>
        </Card>

        <Card title="Address">
          <Grid>
            <F label="Address line" name="address.line" value={s.address?.line} wide />
            <F label="City" name="address.city" value={s.address?.city} />
            <F label="District" name="address.district" value={s.address?.district} />
            <F label="State" name="address.state" value={s.address?.state} />
            <F label="PIN code" name="address.pincode" value={s.address?.pincode} />
          </Grid>
        </Card>

        <Card title="Family & emergency">
          <Grid>
            <F label="Father's name" name="family.father_name" value={s.family?.father_name} />
            <F label="Father's occupation" name="family.father_occupation" value={s.family?.father_occupation} />
            <F label="Father's mobile" name="family.father_phone" value={s.family?.father_phone} />
            <F label="Mother's name" name="family.mother_name" value={s.family?.mother_name} />
            <F label="Mother's occupation" name="family.mother_occupation" value={s.family?.mother_occupation} />
            <F label="Mother's mobile" name="family.mother_phone" value={s.family?.mother_phone} />
            <F label="Emergency contact name" name="emergency.name" value={s.emergency?.name} />
            <F label="Relation" name="emergency.relation" value={s.emergency?.relation} />
            <F label="Emergency mobile" name="emergency.phone" value={s.emergency?.phone} />
          </Grid>
          <div className="mt-4 border-t border-line pt-3 text-xs font-medium text-muted">Spouse (if married)</div>
          <div className="mt-2"><Grid>
            <F label="Spouse name" name="spouse.name" value={s.spouse?.name} />
            <F label="Spouse occupation" name="spouse.occupation" value={s.spouse?.occupation} />
            <F label="Spouse mobile" name="spouse.phone" value={s.spouse?.phone} />
          </Grid></div>
        </Card>

        <Card title="Educational details" className="xl:col-span-2" bodyClass="overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead><tr><th>Qualification</th><th>Institution / college</th><th>Board / university</th><th>Stream</th><th className="w-24">Year</th><th className="w-28">Score</th><th>Location</th></tr></thead>
            <tbody>
              {EDU_LEVELS.map((level, i) => {
                const e = edu(level);
                return (
                  <tr key={level}>
                    <td className="font-medium whitespace-nowrap">{level}</td>
                    <td><input name={`edu.${i}.institution`} defaultValue={e?.institution ?? ""} className="input" /></td>
                    <td><input name={`edu.${i}.board`} defaultValue={e?.board ?? ""} className="input" /></td>
                    <td><input name={`edu.${i}.stream`} defaultValue={e?.stream ?? ""} className="input" /></td>
                    <td><input name={`edu.${i}.year`} type="number" min={1980} max={2100} defaultValue={e?.year_of_passing ?? ""} className="input" /></td>
                    <td><input name={`edu.${i}.score`} defaultValue={e?.score ?? ""} placeholder="86% / 8.4 CGPA" className="input" /></td>
                    <td><input name={`edu.${i}.location`} defaultValue={e?.location ?? ""} className="input" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Course & admission">
          <Grid>
            <S label="Student category" name="category" value={s.category ?? "normal"} options={[["normal", "Normal (retail / individual)"], ["college", "College student (via TPO)"], ["corporate", "Corporate student"]]} />
            <S label="Branch / domain" name="branch_id" value={s.branch_id} options={branches.map((b) => [b.id, b.name])} />
            <S label="College (college students)" name="college_id" value={s.college_id} options={colleges.map((c) => [c.id, c.name])} />
            <S label="Company (corporate students)" name="client_id" value={s.client_id} options={clients.map((c) => [c.id, c.name])} />
            <S label="Course" name="course_id" value={s.course_id} options={courses.map((c) => [c.id, c.name])} />
            <S label="Batch" name="batch_id" value={s.batch_id} options={batches.map((b) => [b.id, b.name])} />
            <S label="Training mode" name="training_mode" value={s.training_mode} options={[["online", "Online"], ["offline", "Offline"], ["hybrid", "Hybrid"]]} />
            <F label="Admission date" name="admission_date" type="date" value={s.admission_date} />
            <F label="Training valid until" name="validity_end" type="date" value={s.validity_end} />
            <F label="Payment plan" name="payment_plan" value={s.payment_plan} />
            <F label="Referred by" name="referred_by" value={s.referred_by} />
            <S label="Lead source" name="lead_source" value={s.lead_source} options={["Website", "Google", "Instagram", "LinkedIn", "Referral", "Walk-in"]} />
          </Grid>
        </Card>

        <Card title="Professional & placement">
          <Grid>
            <S label="Working status" name="pro.working_status" value={pr.working_status} options={["Fresher", "Working", "Not working"]} />
            <F label="Current company" name="pro.company" value={pr.company} />
            <F label="Total experience" name="pro.total_exp" value={pr.total_exp} placeholder="2 yrs" />
            <F label="Relevant experience" name="pro.relevant_exp" value={pr.relevant_exp} />
            <F label="Current CTC" name="pro.current_ctc" value={pr.current_ctc} placeholder="4 LPA" />
            <F label="Expected CTC" name="pro.expected_ctc" value={pr.expected_ctc} />
            <F label="Notice period" name="pro.notice_period" value={pr.notice_period} placeholder="Immediate / 30 days" />
            <F label="Preferred location" name="pro.preferred_location" value={pr.preferred_location} />
            <S label="Interview mode" name="pro.interview_mode" value={pr.interview_mode} options={["Online", "Offline", "Both"]} />
          </Grid>
          <div className="mt-4 space-y-2">
            <C label="Willing to relocate" name="pro.relocate" checked={pr.relocate} />
            <C label="Placement consent (wants placement support)" name="placement_consent" checked={s.placement_consent} />
            <C label="Placement eligible" name="placement_eligible" checked={s.placement_eligible} />
          </div>
        </Card>

        <Card title="Attendance IDs (matching for Zoom, TeamViewer, biometric)" className="xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Zoom email" name="ref.zoom" type="email" value={ref("zoom") || s.email} />
            <F label="TeamViewer / recordings ID" name="ref.teamviewer" value={ref("teamviewer")} placeholder="optional — enrollment no. also works" />
            <F label="Biometric user code" name="ref.biometric" value={ref("biometric") || s.enrollment_no} />
          </div>
        </Card>

        <div className="flex justify-end gap-2 xl:col-span-2">
          <Link href={`/students/${id}`} className="btn-ghost">Cancel</Link>
          <button className="btn-primary">Save changes</button>
        </div>
      </form>
    </>
  );
}
