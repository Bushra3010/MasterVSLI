import Link from "next/link";
import { MasterSelect } from "@/components/master-select";
import type { Batch, Branch, Course, Student } from "@/lib/types";
import { saveMasterDataAction } from "../profile-actions";

/** Green "+/−" button that opens the master list where entries are added or removed. */
const PlusMinus = ({ href, label }: { href: string; label: string }) => (
  <Link href={href} title={`Add / remove ${label}`} aria-label={`Add or remove ${label}`} className="grid h-9 shrink-0 place-items-center rounded-[5px] bg-emerald-600 px-2.5 text-xs font-bold text-white hover:bg-emerald-700">
    +/−
  </Link>
);

/** Inline Master Data editor on the profile (admin): pick from the dropdowns, add/remove entries, save. */
export function MasterDataForm({ s, branches, courses, batches, validityOptions, validity, canRemove }: { s: Student; branches: Branch[]; courses: Course[]; batches: Batch[]; validityOptions: string[]; validity: number | null; canRemove: boolean }) {
  const label = "mb-1 block text-[13px] font-semibold text-[#1d3c8f]";
  return (
    <form action={saveMasterDataAction.bind(null, s.id)} className="grid items-end gap-3 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
      <div>
        <label className={label} htmlFor="md-branch">Branch / Domain</label>
        <div className="flex gap-1">
          <select id="md-branch" name="branch_id" defaultValue={s.branch_id ?? ""} className="input min-w-0 flex-1">
            <option value="">—</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <PlusMinus href="/settings" label="branches" />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="md-course">Course</label>
        <div className="flex gap-1">
          <select id="md-course" name="course_id" defaultValue={s.course_id ?? ""} className="input min-w-0 flex-1">
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <PlusMinus href="/courses" label="courses" />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="md-batch">Batch</label>
        <div className="flex gap-1">
          <select id="md-batch" name="batch_id" defaultValue={s.batch_id ?? ""} className="input min-w-0 flex-1">
            <option value="">—</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <PlusMinus href="/courses" label="batches" />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="md-mode">Training Mode</label>
        <select id="md-mode" name="training_mode" defaultValue={s.training_mode} className="input">
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>
      <div>
        <span className={label}>Validity (Months)</span>
        <MasterSelect name="validity_months" category="validity_months" options={validityOptions} defaultValue={validity ? String(validity) : ""} placeholder="Select…" canRemove={canRemove} />
      </div>
      <button className="btn-primary h-9">Save</button>
    </form>
  );
}
