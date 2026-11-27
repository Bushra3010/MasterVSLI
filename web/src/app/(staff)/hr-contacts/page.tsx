import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/student360";
import { nowMs } from "@/lib/calendar";
import { todayISO } from "@/lib/format";
import { createHrRepo } from "@/lib/hr";
import { getRepo } from "@/lib/server";
import { getStore, isAdmin, requireStaff } from "@/lib/session";
import { createHrDriveRepo } from "@/lib/hr-drives";
import {
  HIRING_STATUSES,
  HR_SOURCES,
  CONTACT_MODES,
  RELATIONSHIP_STATUSES,
  type Drive,
  type DriveResponse,
  type HrCall,
  type HrContact,
  type HrHistory,
  type HrRequirement,
  type Staff,
  type StudentApplication,
} from "@/lib/types";
import { saveRowAction } from "../crm-actions";
import { addHrAction } from "./actions";
import { Database, HR_TABS, HrProfile, type HCtx } from "./tabs";
import { activities, companyProfile, drives as drivesTab, feedback as feedbackTab, interest, placements, reports } from "./tabs2";

export const metadata = { title: "HR management" };

const TABS: [string, string][] = [
  ["dashboard", "Dashboard"], ["database", "HR Database"], ["pipeline", "Relationship Pipeline"],
  ["requirements", "Hiring Requirements"], ["drives", "Drives & Reminders"], ["interest", "Student Interest"],
  ["placements", "Placement Pipeline"], ["companies", "Company 360°"], ["activities", "Pending Activities"],
  ["feedback", "Feedback"], ["reports", "Staff Reports"], ["reminders", "Reminder Centre"],
];
/** The older per-HR page used these tab names. */
const ALIAS: Record<string, string> = { overview: "database", history: "database", calls: "database", opps: "database", notes: "database", edit: "database" };

export default async function HrContactsPage({ searchParams }: PageProps<"/hr-contacts">) {
  const sp = await searchParams;
  const raw = typeof sp.tab === "string" ? ALIAS[sp.tab] ?? sp.tab : "dashboard";
  const tab = TABS.some(([k]) => k === raw) ? raw : "dashboard";
  const session = await requireStaff();
  const repo = await getRepo();
  const db = await getStore();

  const [contacts, history, calls, drives, staff] = await Promise.all([
    repo.list<HrContact>("hr_contacts", { order: { column: "full_name" } }),
    repo.list<HrHistory>("hr_company_history", { order: { column: "from_date", ascending: false } }),
    repo.list<HrCall>("hr_calls", { order: { column: "call_date", ascending: false } }),
    repo.drives(),
    repo.staff(),
  ]);
  const dr = createHrDriveRepo(db);
  const [acts, reqs, tasks, subs, feedbackRows, responses, apps, students] = await Promise.all([
    createHrRepo(db).activities(),
    db.select<HrRequirement>("hr_requirements", { order: { column: "created_at", ascending: false } }),
    dr.tasks(),
    dr.submissions(),
    dr.feedback(),
    db.select<DriveResponse>("drive_responses"),
    db.select<StudentApplication>("student_applications"),
    repo.students({ status: "all" }),
  ]);

  const me = (await repo.staffForUser(session.userId, session.email))?.full_name ?? session.name;
  const c: HCtx = {
    sp, admin: isAdmin(session), me, now: nowMs(), today: todayISO(),
    contacts, history, calls, acts, reqs, drives: drives as Drive[], staff: staff as Staff[],
    tasks, subs, feedback: feedbackRows, responses, apps, students,
  };

  const adding = sp.add === "1";
  const selected = typeof sp.id === "string" ? contacts.find((h) => h.id === sp.id) : undefined;

  return (
    <>
      <PageHeader
        title="HR Management 360°"
        subtitle="HR database with permanent IDs, relationship pipeline, employment history, company-wise current and previous HRs, staff relationships and hiring requirements."
        actions={<Link href="/hr-contacts?tab=database&add=1" className="btn-primary"><Plus size={15} /> Add HR</Link>}
      />
      <Flash sp={sp} />

      <nav className="mb-5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/hr-contacts?tab=${k}`} className={`rounded-[5px] px-2.5 py-1.5 text-[13px] ${tab === k ? "bg-brand font-medium text-white" : "bg-slate-50 text-navy hover:bg-slate-100"}`}>{l}</Link>
        ))}
      </nav>

      {tab === "database" ? (
        adding ? <AddHrForm staff={staff as Staff[]} />
          : selected ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <Link href="/hr-contacts?tab=database" className="text-[13px] text-brand hover:underline">← Back to the HR database</Link>
                <Link href={`/hr-contacts?tab=database&id=${selected.id}&edit=1`} className="btn border border-violet-300 bg-violet-50 text-violet-800">Edit</Link>
              </div>
              {sp.edit === "1" ? <EditHrForm hr={selected} staff={staff as Staff[]} /> : <HrProfile c={c} hr={selected} />}
            </div>
          ) : <Database c={c} />
      ) : tab === "drives" ? drivesTab(c)
        : tab === "interest" ? interest(c)
        : tab === "placements" ? placements(c)
        : tab === "companies" ? companyProfile(c)
        : tab === "activities" ? activities(c)
        : tab === "feedback" ? feedbackTab(c)
        : tab === "reports" ? reports(c)
        : HR_TABS[tab]?.(c)}
    </>
  );
}

/** §4 Individual HR registration. Duplicates are refused unless the user ticks the override. */
function AddHrForm({ staff }: { staff: Staff[] }) {
  const active = staff.filter((s) => s.active !== false);
  const text: [string, string, boolean?][] = [
    ["full_name", "Full name *", true], ["designation", "Designation"], ["current_company", "Current company"],
    ["department", "Department"], ["city", "Location"], ["phone", "Mobile number"],
    ["email", "Official email"], ["personal_email", "Personal email"], ["linkedin", "LinkedIn profile"],
    ["previous_company", "Previous company"], ["introduced_by", "Introduced by"], ["company_type", "Company type"],
  ];
  return (
    <section className="rounded-[5px] border border-line bg-white p-4">
      <div className="mb-1 text-base font-medium text-navy">HR registration</div>
      <p className="mb-4 text-xs text-muted">A permanent HR ID is issued on save. Mobile, email and LinkedIn are checked against every HR on file, including the companies they used to work at.</p>
      <form action={addHrAction} className="grid gap-3 sm:grid-cols-3">
        {text.map(([k, l, req]) => (
          <label key={k} className="text-xs text-muted">{l}
            <input name={k} required={req} className="input mt-1" />
          </label>
        ))}
        <label className="text-xs text-muted">Joining date<input name="joined_on" type="date" className="input mt-1" /></label>
        <label className="text-xs text-muted">Contact source
          <select name="source" className="input mt-1"><option value="">—</option>{Object.entries(HR_SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Preferred contact
          <select name="preferred_contact" className="input mt-1"><option value="">—</option>{CONTACT_MODES.map(([, l]) => <option key={l}>{l}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Assigned staff
          <select name="assigned_to" className="input mt-1"><option value="">Unassigned</option>{active.map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Alternative staff
          <select name="alt_assigned_to" className="input mt-1"><option value="">—</option>{active.map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Relationship status
          <select name="relationship_status" className="input mt-1">{RELATIONSHIP_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Hiring status
          <select name="hiring_status" className="input mt-1">{HIRING_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="text-xs text-muted sm:col-span-3">Reference / hiring insight
          <textarea name="reference_note" rows={3} className="input mt-1" placeholder="How do we know this HR? Past hiring, batches, references…" />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted sm:col-span-3">
          <input type="checkbox" name="confirm_duplicate" value="1" /> Add anyway even if an HR with these details already exists
        </label>
        <div className="flex gap-2 sm:col-span-3">
          <button className="btn-primary">Add HR</button>
          <Link href="/hr-contacts?tab=database" className="btn border border-line">Cancel</Link>
        </div>
      </form>
    </section>
  );
}

/** Edit an HR already on file. The permanent HR ID and employment history are not editable here. */
function EditHrForm({ hr, staff }: { hr: HrContact; staff: Staff[] }) {
  const active = staff.filter((s) => s.active !== false);
  const f = (k: keyof HrContact) => (hr[k] as string) ?? "";
  const text: [keyof HrContact, string][] = [
    ["full_name", "Full name *"], ["designation", "Designation"], ["current_company", "Current company"],
    ["department", "Department"], ["city", "Location"], ["phone", "Mobile number"],
    ["email", "Official email"], ["personal_email", "Personal email"], ["linkedin", "LinkedIn profile"],
    ["previous_company", "Previous company"], ["introduced_by", "Introduced by"], ["company_type", "Company type"],
  ];
  return (
    <section className="rounded-[5px] border border-line bg-white p-4">
      <div className="mb-1 text-base font-medium text-navy">Edit {hr.full_name}</div>
      <p className="mb-4 text-xs text-muted">{hr.hr_code} · changing the current company here does not create a history entry — use “Record a company change” on the profile for that.</p>
      <form action={saveRowAction.bind(null, "hr_contacts")} className="grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="id" value={hr.id} />
        <input type="hidden" name="hr_code" value={f("hr_code")} />
        <input type="hidden" name="stage" value={f("stage")} />
        <input type="hidden" name="reference_note" value={f("reference_note")} />
        {text.map(([k, l]) => (
          <label key={k} className="text-xs text-muted">{l}
            <input name={k} defaultValue={f(k)} required={k === "full_name"} className="input mt-1" />
          </label>
        ))}
        <label className="text-xs text-muted">Joining date<input name="joined_on" type="date" defaultValue={f("joined_on")} className="input mt-1" /></label>
        <label className="text-xs text-muted">Contact source
          <select name="source" defaultValue={f("source")} className="input mt-1"><option value="">—</option>{Object.entries(HR_SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Preferred contact
          <select name="preferred_contact" defaultValue={f("preferred_contact")} className="input mt-1"><option value="">—</option>{CONTACT_MODES.map(([, l]) => <option key={l}>{l}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Assigned staff
          <select name="assigned_to" defaultValue={f("assigned_to")} className="input mt-1"><option value="">Unassigned</option>{active.map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Alternative staff
          <select name="alt_assigned_to" defaultValue={f("alt_assigned_to")} className="input mt-1"><option value="">—</option>{active.map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Relationship status
          <select name="relationship_status" defaultValue={f("relationship_status")} className="input mt-1">{RELATIONSHIP_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="text-xs text-muted">Hiring status
          <select name="hiring_status" defaultValue={f("hiring_status")} className="input mt-1">{HIRING_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <div className="flex gap-2 sm:col-span-3">
          <button className="btn-primary">Save changes</button>
          <Link href={`/hr-contacts?tab=database&id=${hr.id}`} className="btn border border-line">Cancel</Link>
        </div>
      </form>
    </section>
  );
}
