"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { MasterSelect } from "@/components/master-select";
import { addMonths } from "@/lib/format";
import type { Batch, Branch, Client, College, Course, Education, MasterCategory, Student, TpoContact } from "@/lib/types";
import { EDU_ALIASES, EDU_ROWS, INDIAN_STATES } from "@/lib/types-profile";

type Result = { ok: boolean; message: string } | null;

const Section = ({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: string }) => (
  <section id={id} className="scroll-mt-20 overflow-hidden rounded-[5px] border border-line bg-white shadow-sm">
    <header className="flex items-center justify-between gap-2 border-b border-line bg-slate-50 px-4 py-2.5">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      {note && <span className="text-[11px] text-muted">{note}</span>}
    </header>
    <div className="p-4">{children}</div>
  </section>
);
const F = ({ label, name, value, type = "text", placeholder, wide, required }: { label: string; name: string; value?: string | number | null; type?: string; placeholder?: string; wide?: boolean; required?: boolean }) => (
  <div className={wide ? "sm:col-span-2" : undefined}>
    <label className="label" htmlFor={name}>{label}</label>
    <input id={name} name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} required={required} className="input" />
  </div>
);
const S = ({ label, name, value, options, onChange }: { label: string; name: string; value?: string | null; options: (string | [string, string])[]; onChange?: (v: string) => void }) => (
  <div>
    <label className="label" htmlFor={name}>{label}</label>
    <select id={name} name={name} defaultValue={value ?? ""} onChange={(e) => onChange?.(e.target.value)} className="input">
      <option value="">—</option>
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  </div>
);
const C = ({ label, name, checked, onChange }: { label: string; name: string; checked?: boolean; onChange?: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" name={name} defaultChecked={checked} onChange={(e) => onChange?.(e.target.checked)} className="size-4" /> {label}
  </label>
);
const Grid = ({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) => (
  <div className={`grid gap-3 ${cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{children}</div>
);

export function ProfileForm({
  mode,
  action,
  student: s,
  education,
  refs,
  options,
  canRemove = false,
  courses = [],
  batches = [],
  branches = [],
  colleges = [],
  clients = [],
  contacts = [],
  cancelHref,
}: {
  mode: "staff" | "student";
  action: (prev: Result, form: FormData) => Promise<Result>;
  student: Student;
  education: Education[];
  refs: { zoom?: string | null; teamviewer?: string | null; biometric?: string | null };
  options: Record<MasterCategory, string[]>;
  canRemove?: boolean;
  courses?: Course[];
  batches?: Batch[];
  branches?: Branch[];
  colleges?: College[];
  clients?: Client[];
  contacts?: TpoContact[];
  cancelHref: string;
}) {
  const staff = mode === "staff";
  const [state, run, pending] = useActionState(action, null);
  const x = s.extra ?? {};
  const pr = s.professional ?? {};
  const [sameAddress, setSameAddress] = useState(x.current_same ?? true);
  const [category, setCategory] = useState(s.category ?? "normal");
  const [gender, setGender] = useState(s.gender ?? "");
  const [marital, setMarital] = useState(s.marital_status ?? "");
  const [courseId, setCourseId] = useState(s.course_id ?? "");
  const course = courses.find((c) => c.id === courseId);
  const [months, setMonths] = useState(String(course?.validity_months ?? ""));
  const [comp, setComp] = useState(String(x.complementary_months ?? 0));
  const [joined, setJoined] = useState(s.admission_date);
  const [validUntil, setValidUntil] = useState(s.validity_end ?? "");
  const recompute = (m = months, c = comp, j = joined) => {
    if (Number(m) > 0 && j) setValidUntil(addMonths(j, Number(m) + Number(c || 0)));
  };
  const edu = (key: string) => education.find((e) => e.level === key || EDU_ALIASES[e.level] === key);
  const courseBatches = useMemo(() => batches.filter((b) => !courseId || b.course_id === courseId), [batches, courseId]);
  const [rows, setRows] = useState(Math.max(3, contacts.length));
  const states = INDIAN_STATES as readonly string[];

  return (
    <form action={run} className="space-y-5">
      <Section id="personal" title="Personal information">
        <Grid cols={3}>
          <F label="Full name *" name="full_name" value={s.full_name} required />
          <F label="Date of birth" name="dob" type="date" value={s.dob} />
          <S label="Gender" name="gender" value={s.gender} options={["Female", "Male", "Other"]} onChange={setGender} />
          <S label="Marital status" name="marital_status" value={s.marital_status} options={["Single", "Married", "Other"]} onChange={setMarital} />
          <S label="Blood group" name="blood_group" value={s.blood_group} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
          <F label="Nationality" name="nationality" value={s.nationality ?? "Indian"} />
          <F label="Languages (comma separated)" name="languages" value={s.languages?.join(", ")} />
          <F label="Native place" name="native_place" value={s.native_place} />
        </Grid>
      </Section>

      <Section id="contact" title="Contact & access information" note={staff ? undefined : "Access IDs are managed by the office"}>
        <Grid cols={3}>
          <div>
            <F label="Primary mobile" name="phone" value={s.phone} />
            <div className="mt-1"><C label="On WhatsApp" name="extra.phone_whatsapp" checked={x.phone_whatsapp ?? true} /></div>
          </div>
          <div>
            <F label="Alternate mobile" name="alt_phone" value={s.alt_phone} />
            <div className="mt-1"><C label="On WhatsApp" name="extra.alt_whatsapp" checked={x.alt_whatsapp} /></div>
          </div>
          <F label="Email" name="email" type="email" value={s.email} />
          <F label="Alternate email" name="alt_email" type="email" value={s.alt_email} />
          <F label="LinkedIn" name="linkedin" value={s.linkedin} />
          {staff && <F label="Admin contact no." name="extra.admin_contact" value={x.admin_contact} />}
        </Grid>
        {staff && (
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 text-xs font-semibold text-muted uppercase">Access & tools (attendance matching)</div>
            <Grid cols={3}>
              <F label="Zoom email ID" name="ref.zoom" type="email" value={refs.zoom || s.email} />
              <F label="Biometric ID no." name="ref.biometric" value={refs.biometric || s.enrollment_no} />
              <F label="TeamViewer ID" name="ref.teamviewer" value={refs.teamviewer} placeholder="optional" />
            </Grid>
          </div>
        )}
      </Section>

      <Section id="address" title="Address information">
        <div className="mb-2 text-xs font-semibold text-muted uppercase">Permanent address</div>
        <Grid cols={3}>
          <F label="Address line" name="address.line" value={s.address?.line} />
          <F label="City" name="address.city" value={s.address?.city} />
          <F label="District" name="address.district" value={s.address?.district} />
          <S label="State" name="address.state" value={s.address?.state} options={[...states]} />
          <F label="PIN code" name="address.pincode" value={s.address?.pincode} />
        </Grid>
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted uppercase">Current address</span>
            <C label="Same as permanent" name="extra.current_same" checked={sameAddress} onChange={setSameAddress} />
          </div>
          {!sameAddress && (
            <Grid cols={3}>
              <F label="Address line" name="current.line" value={x.current_address?.line} />
              <F label="City" name="current.city" value={x.current_address?.city} />
              <F label="District" name="current.district" value={x.current_address?.district} />
              <S label="State" name="current.state" value={x.current_address?.state} options={[...states]} />
              <F label="PIN code" name="current.pincode" value={x.current_address?.pincode} />
            </Grid>
          )}
        </div>
      </Section>

      {staff && (
        <Section id="master" title="Master data" note="+ adds to a list · Course & batch lists are managed in Course & Batch Management">
          <Grid cols={4}>
            <S label="Branch / domain" name="branch_id" value={s.branch_id} options={branches.map((b) => [b.id, `${b.name}${b.domain ? ` · ${b.domain}` : ""}`])} />
            <div>
              <label className="label" htmlFor="course_id">Course</label>
              <select id="course_id" name="course_id" value={courseId} onChange={(e) => { setCourseId(e.target.value); const m = String(courses.find((c) => c.id === e.target.value)?.validity_months ?? ""); setMonths(m); recompute(m); }} className="input">
                <option value="">—</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <S label="Batch" name="batch_id" value={s.batch_id} options={courseBatches.map((b) => [b.id, b.name])} />
            <S label="Training mode" name="training_mode" value={s.training_mode} options={[["online", "Online"], ["offline", "Offline"], ["hybrid", "Hybrid"]]} />
            <MasterSelect name="validity_months" category="validity_months" label="Validity (months)" options={options.validity_months} defaultValue={months} canRemove={canRemove} onChange={(v) => { setMonths(v); recompute(v); }} />
            <S label="Student category" name="category" value={category} options={[["normal", "Normal"], ["college", "College"], ["corporate", "Corporate"]]} onChange={(v) => setCategory(v as typeof category)} />
            {category === "college" && <S label="College" name="college_id" value={s.college_id} options={colleges.map((c) => [c.id, `${c.name}${c.city ? ` — ${c.city}` : ""}`])} />}
            {category === "corporate" && <S label="Company (sponsor)" name="client_id" value={s.client_id} options={clients.map((c) => [c.id, c.name])} />}
            {category === "corporate" && <MasterSelect name="extra.company_designation" category="designation" label="Employee designation" options={options.designation} defaultValue={x.company_designation} canRemove={canRemove} />}
          </Grid>
        </Section>
      )}

      <Section id="family" title="Family & emergency information">
        <Grid cols={3}>
          <F label="Father's name" name="family.father_name" value={s.family?.father_name} />
          <F label="Father's occupation" name="family.father_occupation" value={s.family?.father_occupation} />
          <F label="Father's mobile" name="family.father_phone" value={s.family?.father_phone} />
          <F label="Mother's name" name="family.mother_name" value={s.family?.mother_name} />
          <F label="Mother's occupation" name="family.mother_occupation" value={s.family?.mother_occupation} />
          <F label="Mother's mobile" name="family.mother_phone" value={s.family?.mother_phone} />
        </Grid>
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 text-xs font-semibold text-muted uppercase">Emergency contact</div>
          <Grid cols={3}>
            <F label="Contact person" name="emergency.name" value={s.emergency?.name} />
            <F label="Mobile number" name="emergency.phone" value={s.emergency?.phone} />
            <S label="Relation" name="emergency.relation" value={s.emergency?.relation} options={["Father", "Mother", "Spouse", "Brother", "Sister", "Guardian", "Friend", "Other"]} />
          </Grid>
        </div>
        {gender === "Female" && marital === "Married" && (
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 text-xs font-semibold text-muted uppercase">Husband details</div>
            <Grid cols={3}>
              <F label="Husband's name" name="spouse.name" value={s.spouse?.name} />
              <F label="Occupation" name="spouse.occupation" value={s.spouse?.occupation} />
              <F label="Husband's mobile" name="spouse.phone" value={s.spouse?.phone} />
            </Grid>
          </div>
        )}
      </Section>

      <Section id="education" title="Educational details">
        <div className="space-y-4">
          {EDU_ROWS.map((r, i) => {
            const e = edu(r.key);
            return (
              <div key={r.key} className="rounded-[5px] border border-line p-3">
                <div className="mb-2 text-sm font-semibold text-navy">{r.label}</div>
                <Grid cols={4}>
                  <MasterSelect name={`edu.${i}.board`} category={r.list} label={r.list === "board" ? "Board" : "University"} options={options[r.list]} defaultValue={e?.board} editable={staff} canRemove={canRemove} />
                  <MasterSelect name={`edu.${i}.stream`} category="stream" label="Stream / course" options={options.stream} defaultValue={e?.stream} editable={staff} canRemove={canRemove} />
                  <F label="College / school" name={`edu.${i}.institution`} value={e?.institution} />
                  <S label="State" name={`edu.${i}.state`} value={e?.state ?? e?.location} options={[...states]} />
                  <F label="From (year)" name={`edu.${i}.start`} type="number" value={e?.start_year} placeholder="2018" />
                  <F label="To (year)" name={`edu.${i}.end`} type="number" value={e?.end_year} placeholder="2020" />
                  <F label="Year of passing" name={`edu.${i}.year`} type="number" value={e?.year_of_passing} />
                  <F label="% / CGPA" name={`edu.${i}.score`} value={e?.score} placeholder="86% / 8.4" />
                </Grid>
              </div>
            );
          })}
        </div>
      </Section>

      {category === "college" && (
        <Section id="college-info" title="College details">
          <Grid cols={3}>
            <F label="University roll number" name="ci.roll_no" value={x.college_info?.roll_no} />
            <F label="Department" name="ci.department" value={x.college_info?.department} />
            <F label="HOD name" name="ci.hod" value={x.college_info?.hod} />
            <F label="TPO name" name="ci.tpo" value={x.college_info?.tpo} />
            <F label="Faculty coordinator" name="ci.faculty" value={x.college_info?.faculty} />
          </Grid>
        </Section>
      )}

      {category === "corporate" && (
        <Section id="corporate" title="Corporate details">
          <Grid cols={3}>
            <F label="Employee ID" name="co.employee_id" value={x.corporate?.employee_id} />
            <F label="Department" name="co.department" value={x.corporate?.department} />
            <F label="HR name" name="co.hr_name" value={x.corporate?.hr_name} />
            <F label="HR contact" name="co.hr_contact" value={x.corporate?.hr_contact} />
            <F label="Reporting manager" name="co.manager_name" value={x.corporate?.manager_name} />
            <F label="Manager contact" name="co.manager_contact" value={x.corporate?.manager_contact} />
            {staff && <F label="Corporate billing (office only)" name="co.billing" value={x.corporate?.billing} wide />}
          </Grid>
        </Section>
      )}

      {staff && category === "college" && (
        <Section id="college" title="College details — key contacts" note="Saved to the college in College Management">
          {!s.college_id && <p className="mb-2 text-xs text-amber-700">Pick the college under Master data and save first; then add its contacts here.</p>}
          <div className="space-y-2">
            {Array.from({ length: rows }, (_, i) => {
              const c = contacts[i];
              return (
                <div key={i} className="grid items-end gap-2 sm:grid-cols-[10rem_1fr_9rem_1fr_auto]">
                  {c && <input type="hidden" name={`contact.${i}.id`} value={c.id} />}
                  <MasterSelect name={`contact.${i}.position`} category="contact_position" label={i === 0 ? "Position" : undefined} options={options.contact_position} defaultValue={c?.designation ?? ["TPO", "HOD", "Principal"][i]} canRemove={canRemove} />
                  <div><label className={i === 0 ? "label" : "sr-only"} htmlFor={`contact.${i}.name`}>Name</label><input id={`contact.${i}.name`} name={`contact.${i}.name`} defaultValue={c?.name ?? ""} placeholder="Name" className="input" /></div>
                  <div><label className={i === 0 ? "label" : "sr-only"} htmlFor={`contact.${i}.phone`}>Mobile</label><input id={`contact.${i}.phone`} name={`contact.${i}.phone`} defaultValue={c?.phone ?? ""} placeholder="Mobile" className="input" /></div>
                  <div><label className={i === 0 ? "label" : "sr-only"} htmlFor={`contact.${i}.email`}>Email</label><input id={`contact.${i}.email`} name={`contact.${i}.email`} type="email" defaultValue={c?.email ?? ""} placeholder="Email" className="input" /></div>
                  {c ? <label className="flex h-9 items-center gap-1 text-xs text-red-700"><input type="checkbox" name={`contact.${i}.remove`} /> Remove</label> : <span />}
                </div>
              );
            })}
          </div>
          {rows < 5 && <button type="button" onClick={() => setRows((r) => r + 1)} className="mt-2 text-xs font-medium text-navy underline">+ Add another contact</button>}
        </Section>
      )}

      {staff && (
        <Section id="course" title="Course & admission information">
          <Grid cols={4}>
            <div><label className="label">Course duration</label><div className="input bg-slate-50">{course ? `${course.duration_months} months` : "—"}</div></div>
            <S label="Complementary duration" name="extra.complementary_months" value={String(x.complementary_months ?? 0)} options={[["0", "None"], ["1", "1 month"], ["2", "2 months"], ["3", "3 months"], ["6", "6 months"]]} onChange={(v) => { setComp(v); recompute(months, v); }} />
            <div><label className="label">Total validity</label><div className="input bg-slate-50">{Number(months) ? `${Number(months) + Number(comp || 0)} months` : "—"}</div></div>
            <S label="Validity type" name="extra.validity_type" value={x.validity_type ?? "fixed"} options={[["fixed", "Fixed (months)"], ["extendable", "Extendable"]]} />
            <div>
              <label className="label" htmlFor="admission_date">Joining date</label>
              <input id="admission_date" name="admission_date" type="date" value={joined} onChange={(e) => { setJoined(e.target.value); recompute(months, comp, e.target.value); }} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="validity_end">Valid until</label>
              <input id="validity_end" name="validity_end" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input" />
            </div>
            <F label="Payment plan" name="payment_plan" value={s.payment_plan} />
            <F label="Referred by" name="referred_by" value={s.referred_by} />
            <S label="Lead source" name="lead_source" value={s.lead_source} options={["Website", "Google", "Instagram", "LinkedIn", "WhatsApp", "Referral", "Walk-in", "College"]} />
          </Grid>
          <p className="mt-2 text-[11px] text-muted">Valid until = joining date + validity + complementary months (you can still change it by hand).</p>
        </Section>
      )}

      <Section id="professional" title="Professional information">
        <div className="mb-2 text-xs font-semibold text-muted uppercase">(A) Before joining MasterVLSI</div>
        <Grid cols={4}>
          <S label="Working status" name="pro.working_status" value={pr.working_status} options={["Fresher", "Working", "Not working"]} />
          <F label="Company" name="pro.company" value={pr.company} />
          <F label="Designation" name="before.designation" value={x.before?.designation} />
          <F label="Total experience" name="pro.total_exp" value={pr.total_exp} placeholder="1.5 years" />
          <F label="Relevant experience" name="pro.relevant_exp" value={pr.relevant_exp} />
          <F label="From" name="before.from" type="month" value={x.before?.from} />
          <F label="To" name="before.to" type="month" value={x.before?.to} />
          <F label="Job location" name="before.location" value={x.before?.location} />
          <F label="Current CTC" name="pro.current_ctc" value={pr.current_ctc} />
          <F label="Expected CTC" name="pro.expected_ctc" value={pr.expected_ctc} />
          <F label="Notice period" name="pro.notice_period" value={pr.notice_period} />
          <F label="Preferred location" name="pro.preferred_location" value={pr.preferred_location} />
          <S label="Interview mode" name="pro.interview_mode" value={pr.interview_mode} options={["Online", "Offline", "Both"]} />
        </Grid>
        <div className="mt-3"><C label="Willing to relocate" name="pro.relocate" checked={pr.relocate} /></div>
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 text-xs font-semibold text-muted uppercase">Career gap &amp; objective</div>
          <Grid cols={4}>
            <F label="Gap from" name="gap.from" type="month" value={x.career_gap?.from} />
            <F label="Gap to" name="gap.to" type="month" value={x.career_gap?.to} />
            <F label="Reason for gap" name="gap.reason" value={x.career_gap?.reason} wide />
          </Grid>
          <div className="mt-3">
            <label className="label" htmlFor="career_objective">Career objective</label>
            <textarea id="career_objective" name="career_objective" rows={2} defaultValue={x.career_objective ?? ""} placeholder="e.g. Become a Design Verification engineer at a product semiconductor company" className="input" />
          </div>
        </div>
        {staff && (
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 text-xs font-semibold text-muted uppercase">(B) After joining MasterVLSI — placement</div>
            <Grid cols={4}>
              <S label="Working status" name="after.status" value={x.placement?.status} options={["Training", "Placed", "Working", "Looking"]} />
              <F label="Company" name="after.company" value={x.placement?.company} />
              <MasterSelect name="after.designation" category="designation" label="Designation" options={options.designation} defaultValue={x.placement?.designation} canRemove={canRemove} />
              <F label="Package (CTC)" name="after.package" value={x.placement?.package} placeholder="12 LPA" />
              <F label="Date of joining" name="after.doj" type="date" value={x.placement?.doj} />
              <F label="HR POC name" name="after.hr_name" value={x.placement?.hr_name} />
              <F label="HR POC email" name="after.hr_email" type="email" value={x.placement?.hr_email} />
              <F label="Job location" name="after.location" value={x.placement?.location} />
            </Grid>
            <div className="mt-3 flex flex-wrap gap-4">
              <C label="Placement consent" name="placement_consent" checked={s.placement_consent} />
              <C label="Placement eligible" name="placement_eligible" checked={s.placement_eligible} />
            </div>
          </div>
        )}
      </Section>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 p-3 backdrop-blur">
        {state && !state.ok && <span role="alert" className="text-sm text-red-600">{state.message}</span>}
        {state?.ok && <span role="status" className="text-sm text-emerald-700">{state.message}</span>}
        <a href={cancelHref} className="btn-ghost">Cancel</a>
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      </div>
    </form>
  );
}
