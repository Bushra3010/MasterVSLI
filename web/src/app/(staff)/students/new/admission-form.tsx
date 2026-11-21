"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { inr, todayISO } from "@/lib/format";
import type {
  Branch,
  Client,
  College, Batch, Course, Vendor } from "@/lib/types";
import { createStudentAction } from "../../actions";

export type AdmissionDefaults = { enquiry_id?: string; lead_id?: string; source?: string; full_name?: string; email?: string; phone?: string; city?: string; course_code?: string };

export function AdmissionForm({ courses, batches, vendors, defaults = {}, branches = [], colleges = [], clients = [], kacha = false }: {
  courses: Course[]; batches: Batch[]; vendors: Vendor[]; defaults?: AdmissionDefaults;
  branches?: Branch[]; colleges?: College[]; clients?: Client[]; kacha?: boolean;
}) {
  const [category, setCategory] = useState<"normal" | "college" | "corporate">("normal");
  const [courseId, setCourseId] = useState(courses.find((c) => c.code === defaults.course_code)?.id ?? courses[0]?.id ?? "");
  const course = courses.find((c) => c.id === courseId);
  const [fee, setFee] = useState(course?.fee ?? 0);
  const parents = vendors.filter((v) => !v.parent_id);
  const [alloc, setAlloc] = useState(() =>
    parents.slice(0, 2).map((v, i) => ({ vendor: v.id, sub: "", amount: i === 0 ? Math.round((fee * 2) / 3) : fee - Math.round((fee * 2) / 3), n: i === 0 ? 3 : 2 })),
  );
  const allocated = alloc.reduce((a, x) => a + Number(x.amount || 0), 0);
  const courseBatches = useMemo(() => batches.filter((b) => b.course_id === courseId), [batches, courseId]);

  function changeCourse(id: string) {
    setCourseId(id);
    const f = courses.find((c) => c.id === id)?.fee ?? 0;
    setFee(f);
    setAlloc((a) => a.map((x, i) => ({ ...x, amount: i === 0 ? Math.round((f * 2) / 3) : f - Math.round((f * 2) / 3) })));
  }

  return (
    <form action={createStudentAction} className="grid gap-5 xl:grid-cols-2">
      {defaults.enquiry_id && <input type="hidden" name="enquiry_id" value={defaults.enquiry_id} />}
      {defaults.lead_id && <input type="hidden" name="lead_id" value={defaults.lead_id} />}
      <Card title="Student category *" className="xl:col-span-2">
        <div className="grid gap-3 sm:grid-cols-3">
          {([["normal", "Normal student", "Retail / individual: direct admission, individual fee, regular batches"], ["college", "College student", "Through college / TPO: MoU & campus drives, batch-wise training"], ["corporate", "Corporate student", "Company-sponsored training: corporate batch, company-wise billing"]] as const).map(([k, t, d]) => (
            <label key={k} className={`cursor-pointer rounded-[5px] border p-3 ${category === k ? "border-brand bg-brand-soft" : "border-line"}`}>
              <input type="radio" name="category" value={k} checked={category === k} onChange={() => setCategory(k)} className="mr-2" />
              <span className="font-medium text-navy">{t}</span>
              <div className="mt-1 text-xs text-muted">{d}</div>
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Branch / domain</label>
            <select name="branch_id" className="input" defaultValue={branches[0]?.id ?? ""}>
              <option value="">—</option>
              {branches.filter((b) => b.company === "mastervlsi").map((b) => <option key={b.id} value={b.id}>{b.name}{b.domain ? ` · ${b.domain}` : ""}</option>)}
            </select>
          </div>
          {category === "college" && (
            <div>
              <label className="label">College *</label>
              <select name="college_id" required className="input"><option value="">Pick college</option>{colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
          )}
          {category === "corporate" && (
            <div>
              <label className="label">Company (sponsor) *</label>
              <select name="client_id" required className="input"><option value="">Pick company</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
          )}
        </div>
      </Card>
      <Card title="Personal & contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Full name *</label>
            <input name="full_name" required defaultValue={defaults.full_name} className="input" />
          </div>
          <div><label className="label">Email</label><input name="email" type="email" defaultValue={defaults.email} className="input" /></div>
          <div><label className="label">Mobile</label><input name="phone" defaultValue={defaults.phone} className="input" /></div>
          <div>
            <label className="label">Gender</label>
            <select name="gender" className="input"><option>Female</option><option>Male</option><option>Other</option></select>
          </div>
          <div><label className="label">Date of birth</label><input name="dob" type="date" className="input" /></div>
          <div><label className="label">City</label><input name="city" defaultValue={defaults.city} className="input" /></div>
          <div><label className="label">State</label><input name="state" className="input" /></div>
          <div>
            <label className="label">Lead source</label>
            <select name="lead_source" defaultValue={defaults.source ?? undefined} className="input">
              {[...new Set([...(defaults.source ? [defaults.source] : []), "Website", "WhatsApp", "Google", "Instagram", "LinkedIn", "Referral", "Walk-in", "College / TPO"])].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="label">Referred by</label><input name="referred_by" className="input" /></div>
        </div>
      </Card>

      <Card title="Course & admission">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Course *</label>
            <select name="course_id" value={courseId} onChange={(e) => changeCourse(e.target.value)} className="input">
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name} — {inr(c.fee)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Batch</label>
            <select name="batch_id" className="input">
              <option value="">—</option>
              {courseBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Training mode</label>
            <select name="training_mode" className="input" defaultValue="hybrid">
              <option value="online">Online (Zoom + recordings)</option>
              <option value="offline">Offline (biometric)</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div><label className="label">Admission date</label><input name="admission_date" type="date" defaultValue={todayISO()} className="input" /></div>
          <div>
            <label className="label">Total fee (₹)</label>
            <input name="total_fee" type="number" value={fee} onChange={(e) => setFee(Number(e.target.value))} className="input" />
          </div>
          <p className="text-xs text-muted sm:col-span-2">
            Validity: {course?.validity_months ?? "—"} months from admission. Expiry reminders go out 30, 15, 7 and 1 day before.
          </p>
        </div>
      </Card>

      <Card title="Fee split — vendors, sub-vendors & installments" className="xl:col-span-2">
        <div className="space-y-3">
          {alloc.map((a, i) => (
            <div key={i} className={`grid gap-3 rounded-lg border border-line p-3 ${kacha ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
              <div>
                <label className="label">Vendor {i + 1}</label>
                <select name={`alloc_vendor_${i}`} value={a.vendor} onChange={(e) => setAlloc((s) => s.map((x, k) => (k === i ? { ...x, vendor: e.target.value, sub: "" } : x)))} className="input">
                  {parents.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Paid via sub-vendor</label>
                <select name={`alloc_sub_${i}`} value={a.sub} onChange={(e) => setAlloc((s) => s.map((x, k) => (k === i ? { ...x, sub: e.target.value } : x)))} className="input">
                  <option value="">Direct</option>
                  {vendors.filter((v) => v.parent_id === a.vendor).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Allocation (₹)</label>
                <input name={`alloc_amount_${i}`} type="number" value={a.amount} onChange={(e) => setAlloc((s) => s.map((x, k) => (k === i ? { ...x, amount: Number(e.target.value) } : x)))} className="input" />
              </div>
              {kacha && (
                <div>
                  <label className="label">Account</label>
                  <select name={`alloc_account_${i}`} defaultValue="paka" className="input">
                    <option value="paka">Paka (institute)</option>
                    <option value="kacha">Kacha (other)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">Installments</label>
                <input name={`alloc_n_${i}`} type="number" min={1} max={12} value={a.n} onChange={(e) => setAlloc((s) => s.map((x, k) => (k === i ? { ...x, n: Number(e.target.value) } : x)))} className="input" />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={allocated === fee ? "text-sm text-emerald-700" : "text-sm text-brand"}>
              Allocated {inr(allocated)} of {inr(fee)} {allocated !== fee && "— allocations should add up to the total fee"}
            </span>
            <button className="btn-primary" disabled={allocated !== fee}>Create admission</button>
          </div>
        </div>
      </Card>
    </form>
  );
}
