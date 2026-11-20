"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { inr, todayISO } from "@/lib/format";
import type { Batch, Course, Vendor } from "@/lib/types";
import { createStudentAction } from "../../actions";

export function AdmissionForm({ courses, batches, vendors }: { courses: Course[]; batches: Batch[]; vendors: Vendor[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
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
      <Card title="Personal & contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Full name *</label>
            <input name="full_name" required className="input" />
          </div>
          <div><label className="label">Email</label><input name="email" type="email" className="input" /></div>
          <div><label className="label">Mobile</label><input name="phone" className="input" /></div>
          <div>
            <label className="label">Gender</label>
            <select name="gender" className="input"><option>Female</option><option>Male</option><option>Other</option></select>
          </div>
          <div><label className="label">Date of birth</label><input name="dob" type="date" className="input" /></div>
          <div><label className="label">City</label><input name="city" className="input" /></div>
          <div><label className="label">State</label><input name="state" className="input" /></div>
          <div>
            <label className="label">Lead source</label>
            <select name="lead_source" className="input">
              {["Website", "Google", "Instagram", "LinkedIn", "Referral", "Walk-in"].map((s) => <option key={s}>{s}</option>)}
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
            <div key={i} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-4">
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
