import { BookOpen, Building2, Layers, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Card, PageHeader } from "@/components/ui";
import { inr } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { saveBatchAction, saveCourseAction, saveStaffAction, saveVendorAction } from "../actions";

export const metadata = { title: "Settings" };

const I = ({ name, value, placeholder, type = "text", w = "", required }: { name: string; value?: string | number | null; placeholder?: string; type?: string; w?: string; required?: boolean }) => (
  <input name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} required={required} aria-label={placeholder ?? name} className={`input py-1.5 ${w}`} />
);
const Save = ({ label = "Save" }: { label?: string }) => <button className="btn-navy py-1.5 text-xs whitespace-nowrap">{label}</button>;
const Row = ({ children, action }: { children: ReactNode; action: (f: FormData) => Promise<void> }) => (
  <form action={action} className="flex flex-wrap items-center gap-2 border-b border-line py-2 last:border-0">{children}</form>
);

export default async function SettingsPage() {
  const repo = await getRepo();
  const [courses, batches, vendors, staff] = await Promise.all([repo.courses(), repo.batches(), repo.vendors(), repo.staff()]);
  const parents = vendors.filter((v) => !v.parent_id);
  const modeSel = (v?: string) => (
    <select name="mode" defaultValue={v ?? "hybrid"} aria-label="Mode" className="input w-auto py-1.5">
      <option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option>
    </select>
  );
  const courseSel = (v?: string) => (
    <select name="course_id" defaultValue={v ?? courses[0]?.id} aria-label="Course" required className="input w-auto py-1.5">
      {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
    </select>
  );

  return (
    <>
      <PageHeader title="Settings" subtitle="Courses, batches, vendors and staff used across admissions, fees and letters." />
      <div className="grid gap-5 2xl:grid-cols-2">
        <Card title="Courses" icon={<BookOpen size={15} />}>
          <div className="mb-1 grid grid-cols-[5rem_1fr_5rem_5rem_7rem_auto] gap-2 text-[11px] font-medium text-muted max-sm:hidden">
            <span>Code</span><span>Name</span><span>Months</span><span>Valid (m)</span><span>Fee (₹)</span><span />
          </div>
          {courses.map((c) => (
            <Row key={c.id} action={saveCourseAction}>
              <input type="hidden" name="id" value={c.id} />
              <I name="code" value={c.code} w="w-20" required placeholder="Code" />
              <I name="name" value={c.name} w="min-w-40 flex-1" required placeholder="Course name" />
              <I name="duration_months" type="number" value={c.duration_months} w="w-20" placeholder="Months" />
              <I name="validity_months" type="number" value={c.validity_months} w="w-20" placeholder="Valid months" />
              <I name="fee" type="number" value={c.fee} w="w-28" placeholder="Fee" />
              <Save />
            </Row>
          ))}
          <Row action={saveCourseAction}>
            <I name="code" w="w-20" required placeholder="Code" />
            <I name="name" w="min-w-40 flex-1" required placeholder="New course name" />
            <I name="duration_months" type="number" value={6} w="w-20" placeholder="Months" />
            <I name="validity_months" type="number" value={12} w="w-20" placeholder="Valid months" />
            <I name="fee" type="number" w="w-28" required placeholder="Fee" />
            <Save label="+ Add" />
          </Row>
        </Card>

        <Card title="Batches" icon={<Layers size={15} />}>
          {batches.map((b) => (
            <Row key={b.id} action={saveBatchAction}>
              <input type="hidden" name="id" value={b.id} />
              {courseSel(b.course_id)}
              <I name="name" value={b.name} w="min-w-40 flex-1" required placeholder="Batch name" />
              {modeSel(b.mode)}
              <I name="start_date" type="date" value={b.start_date} w="w-40" placeholder="Start date" />
              <Save />
            </Row>
          ))}
          <Row action={saveBatchAction}>
            {courseSel()}
            <I name="name" w="min-w-40 flex-1" required placeholder="New batch, e.g. DV-Online-Mar26" />
            {modeSel()}
            <I name="start_date" type="date" w="w-40" placeholder="Start date" />
            <Save label="+ Add" />
          </Row>
        </Card>

        <Card title="Vendors & sub-vendors" icon={<Building2 size={15} />}>
          {parents.map((v) => (
            <div key={v.id} className="mb-3 rounded-lg border border-line p-2">
              <Row action={saveVendorAction}>
                <input type="hidden" name="id" value={v.id} />
                <I name="name" value={v.name} w="min-w-36 flex-1 font-medium" required placeholder="Vendor name" />
                <I name="contact_person" value={v.contact_person} w="w-36" placeholder="Contact person" />
                <I name="phone" value={v.phone} w="w-32" placeholder="Phone" />
                <I name="email" type="email" value={v.email} w="w-44" placeholder="Email" />
                <Save />
              </Row>
              <div className="ml-4 border-l-2 border-line pl-3">
                {vendors.filter((s) => s.parent_id === v.id).map((s) => (
                  <Row key={s.id} action={saveVendorAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="parent_id" value={v.id} />
                    <I name="name" value={s.name} w="min-w-32 flex-1" required placeholder="Sub-vendor name" />
                    <I name="contact_person" value={s.contact_person} w="w-36" placeholder="Contact person" />
                    <I name="phone" value={s.phone} w="w-32" placeholder="Phone" />
                    <Save />
                  </Row>
                ))}
                <Row action={saveVendorAction}>
                  <input type="hidden" name="parent_id" value={v.id} />
                  <I name="name" w="min-w-32 flex-1" required placeholder={`New sub-vendor under ${v.name}`} />
                  <I name="contact_person" w="w-36" placeholder="Contact person" />
                  <I name="phone" w="w-32" placeholder="Phone" />
                  <Save label="+ Add" />
                </Row>
              </div>
            </div>
          ))}
          <Row action={saveVendorAction}>
            <I name="name" w="min-w-36 flex-1" required placeholder="New vendor name" />
            <I name="contact_person" w="w-36" placeholder="Contact person" />
            <I name="phone" w="w-32" placeholder="Phone" />
            <Save label="+ Add vendor" />
          </Row>
        </Card>

        <Card title="Staff (for offer letters, payslips, agreements, experience letters)" icon={<UserRound size={15} />}>
          {staff.map((s) => (
            <Row key={s.id} action={saveStaffAction}>
              <input type="hidden" name="id" value={s.id} />
              <I name="employee_code" value={s.employee_code} w="w-24" required placeholder="Emp. code" />
              <I name="full_name" value={s.full_name} w="min-w-36 flex-1" required placeholder="Full name" />
              <I name="designation" value={s.designation} w="w-40" placeholder="Designation" />
              <I name="department" value={s.department} w="w-32" placeholder="Department" />
              <I name="joining_date" type="date" value={s.joining_date} w="w-40" placeholder="Joining date" />
              <I name="monthly_salary" type="number" value={s.monthly_salary} w="w-28" placeholder="Monthly ₹" />
              <I name="email" type="email" value={s.email} w="w-44" placeholder="Email" />
              <I name="phone" value={s.phone} w="w-32" placeholder="Phone" />
              <Save />
            </Row>
          ))}
          <Row action={saveStaffAction}>
            <I name="employee_code" w="w-24" required placeholder="Emp. code" />
            <I name="full_name" w="min-w-36 flex-1" required placeholder="Full name" />
            <I name="designation" w="w-40" placeholder="Designation" />
            <I name="department" w="w-32" placeholder="Department" />
            <I name="joining_date" type="date" w="w-40" placeholder="Joining date" />
            <I name="monthly_salary" type="number" w="w-28" placeholder="Monthly ₹" />
            <I name="email" type="email" w="w-44" placeholder="Email" />
            <I name="phone" w="w-32" placeholder="Phone" />
            <Save label="+ Add staff" />
          </Row>
          {!staff.length && <p className="mt-2 text-xs text-muted">Add staff here to issue offer letters, payslips, service agreements and experience letters.</p>}
          {staff.length > 0 && <p className="mt-2 text-xs text-muted">{staff.length} staff · total monthly payroll {inr(staff.reduce((a, s) => a + Number(s.monthly_salary ?? 0), 0))}</p>}
        </Card>
      </div>
    </>
  );
}
