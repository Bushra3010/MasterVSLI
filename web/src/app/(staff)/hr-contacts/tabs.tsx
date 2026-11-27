import { Building2, History, Link2, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { I, Save } from "@/components/form-bits";
import { Kpi } from "@/components/student360";
import { Badge, Card, Empty, Field } from "@/components/ui";
import { hrReminders, REMINDER_GROUPS, staffRelationships } from "@/lib/hr";
import { fmtDate, istDateTime } from "@/lib/format";
import {
  CONTACT_MODES,
  HR_SOURCES,
  HR_STAGES,
  hiringLabel,
  hrStageLabel,
  RELATIONSHIP_STATUSES,
  relationshipTone,
  REQUIREMENT_STATUSES,
  requirementTone,
  type Drive,
  type DriveResponse,
  type HrActivity,
  type HrCall,
  type HrContact,
  type HrDriveTask,
  type HrFeedback,
  type HrHistory,
  type HrRequirement,
  type HrSubmission,
  type Staff,
  type StudentApplication,
  type StudentListItem,
} from "@/lib/types";
import { deleteRowAction, saveRowAction } from "../crm-actions";
import { addRequirementAction, allocateHrAction, changeCompanyAction, logContactAction, moveHrStageAction, setRequirementStatusAction } from "./actions";

export interface HCtx {
  sp: Record<string, string | string[] | undefined>;
  admin: boolean;
  me: string;
  now: number;
  today: string;
  contacts: HrContact[];
  history: HrHistory[];
  calls: HrCall[];
  acts: HrActivity[];
  reqs: HrRequirement[];
  drives: Drive[];
  staff: Staff[];
  // Phase 2
  tasks: HrDriveTask[];
  subs: HrSubmission[];
  feedback: HrFeedback[];
  responses: DriveResponse[];
  apps: StudentApplication[];
  students: StudentListItem[];
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const hLink = (id: string) => `/hr-contacts?tab=database&id=${id}`;
const stageOf = (h: HrContact) => h.stage ?? "new_hr";
const outcomeTone = (o?: string | null) =>
  (o === "Interested" ? "green" : o === "Connected" ? "blue" : o === "Not interested" ? "red" : "amber") as "green" | "blue" | "red" | "amber";

function duration(from?: string | null, to?: string | null) {
  if (!from) return "—";
  const end = to ? new Date(to) : new Date();
  const months = Math.max(0, (end.getFullYear() - new Date(from).getFullYear()) * 12 + end.getMonth() - new Date(from).getMonth());
  return `${Math.floor(months / 12)} yr ${months % 12} mo`;
}

function HrName({ c, id }: { c: HCtx; id: string }) {
  const x = c.contacts.find((h) => h.id === id);
  return x ? <Link href={hLink(id)} className="font-medium text-navy hover:text-brand">{x.full_name}</Link> : <span className="text-muted">—</span>;
}

const staffFilter = (c: HCtx) => (typeof c.sp.staff === "string" ? c.sp.staff : "");
const hrSelect = (c: HCtx, name = "hr_id") => (
  <select name={name} required aria-label="HR" className="input py-1.5" defaultValue={typeof c.sp.id === "string" ? c.sp.id : ""}>
    <option value="">HR…</option>
    {c.contacts.map((h) => <option key={h.id} value={h.id}>{h.full_name}{h.current_company ? ` — ${h.current_company}` : ""}</option>)}
  </select>
);

/* -------------------------------------------------------------------------- */

/** §1 Control centre: the numbers a super admin opens the module to see. */
function dashboard(c: HCtx) {
  const companies = new Set(c.contacts.map((h) => h.current_company).filter(Boolean));
  const openStint = new Set(c.history.filter((h) => !h.to_date).map((h) => h.hr_id));
  const hasHistory = new Set(c.history.map((h) => h.hr_id));
  const currentIds = new Set(c.contacts.filter((h) => openStint.has(h.id) || (!hasHistory.has(h.id) && h.current_company)).map((h) => h.id));
  const previousOnly = c.contacts.filter((h) => !currentIds.has(h.id) && hasHistory.has(h.id));
  const strong = c.contacts.filter((h) => h.relationship_status === "strong");
  const future = c.contacts.filter((h) => h.hiring_status === "future_hiring");
  const active = c.contacts.filter((h) => h.hiring_status === "active_hiring");
  const rem = hrReminders({ contacts: c.contacts, calls: c.calls, history: c.history, drives: c.drives, reqs: c.reqs, subs: c.subs, feedback: c.feedback, apps: c.apps, today: c.today, nowMs: c.now });
  const overdue = rem.filter((r) => r.tone === "red");
  const noEmail = c.contacts.filter((h) => !(h.email ?? "").includes("@"));
  const vacancies = c.reqs.reduce((a, r) => a + Number(r.vacancies), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="HR contacts" value={c.contacts.length} />
        <Kpi label="Companies" value={companies.size} />
        <Kpi label="Current HRs" value={currentIds.size} />
        <Kpi label="Previous HRs" value={previousOnly.length} />
        <Kpi label="Strong relationships" value={strong.length} tone="green" />
        <Kpi label="Active hiring" value={active.length} tone="green" />
        <Kpi label="Future hiring" value={future.length} />
        <Kpi label="Hiring requirements" value={c.reqs.length} />
        <Kpi label="Expected vacancies" value={vacancies} />
        <Kpi label="Email missing" value={noEmail.length} tone={noEmail.length ? "red" : undefined} />
        <Kpi label="Overdue activities" value={overdue.length} tone={overdue.length ? "red" : undefined} />
        <Kpi label="Follow-ups due" value={rem.filter((r) => r.tone === "amber").length} tone="amber" />
      </div>

      <Card title="HR relationship pipeline" bodyClass="p-3">
        <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {HR_STAGES.map((s) => {
            const n = c.contacts.filter((h) => stageOf(h) === s.key).length;
            return (
              <Link key={s.key} href={`/hr-contacts?tab=pipeline#${s.key}`} className={`rounded-[5px] border border-t-4 border-line bg-white px-3 py-2 hover:bg-slate-50 ${s.bar}`}>
                <div className="text-[11px] text-muted">{s.label}</div>
                <div className="text-lg font-semibold tabular-nums text-navy">{n}</div>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card title={`Priority reminders (${rem.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>HR / activity</th><th>Owner</th><th>When</th></tr></thead>
          <tbody>
            {rem.slice(0, 12).map((r) => (
              <tr key={r.key}>
                <td><Link href={hLink(r.hr_id)} className="text-navy hover:text-brand">{r.title}</Link></td>
                <td className="text-xs">{r.owner ?? "Unassigned"}</td>
                <td className="text-xs"><Badge tone={r.tone === "red" ? "red" : r.tone === "amber" ? "amber" : "blue"}>{fmtDate(r.when)}</Badge></td>
              </tr>
            ))}
            {!rem.length && <tr><td colSpan={3}><Empty>Nothing pending. Every HR has been contacted and has a follow-up set.</Empty></td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/** §3 Stage-wise board with the owner and hiring signal on each card. */
function pipeline(c: HCtx) {
  const only = staffFilter(c);
  const shown = only ? c.contacts.filter((h) => (h.assigned_to ?? "") === only) : c.contacts;
  const owners = [...new Set(c.contacts.map((h) => h.assigned_to).filter(Boolean))] as string[];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link href="/hr-contacts?tab=pipeline" className={`rounded-[5px] px-2.5 py-1.5 ${!only ? "bg-brand text-white" : "bg-slate-50 text-navy hover:bg-slate-100"}`}>All staff</Link>
        {owners.map((o) => (
          <Link key={o} href={`/hr-contacts?tab=pipeline&staff=${encodeURIComponent(o)}`} className={`rounded-[5px] px-2.5 py-1.5 ${only === o ? "bg-brand text-white" : "bg-slate-50 text-navy hover:bg-slate-100"}`}>{o}</Link>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {HR_STAGES.map((s) => {
          const rows = shown.filter((h) => stageOf(h) === s.key);
          return (
            <section key={s.key} id={s.key} className={`rounded-[5px] border border-t-4 border-line bg-slate-50/60 ${s.bar}`}>
              <header className="flex items-center justify-between px-3 py-2">
                <span className="text-[13px] font-medium text-navy">{s.label}</span>
                <span className="text-xs tabular-nums text-muted">{rows.length}</span>
              </header>
              <ul className="space-y-2 p-2">
                {rows.map((h) => (
                  <li key={h.id} className="rounded-[5px] border border-line bg-white p-2.5">
                    <Link href={hLink(h.id)} className="text-[13px] font-medium text-navy hover:text-brand">{h.full_name}</Link>
                    <div className="truncate text-[11px] text-muted">{h.current_company ?? "—"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <Badge tone={relationshipTone(h.relationship_status)}>{RELATIONSHIP_STATUSES.find(([k]) => k === h.relationship_status)?.[1] ?? "New"}</Badge>
                      <span className="text-muted">{h.assigned_to ?? "Unassigned"}</span>
                    </div>
                  </li>
                ))}
                {!rows.length && <li className="px-1 py-2 text-[11px] text-muted">None</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** §8 Upcoming hiring requirements across every HR. */
function requirements(c: HCtx) {
  const total = c.reqs.reduce((a, r) => a + Number(r.vacancies), 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Requirements" value={c.reqs.length} />
        <Kpi label="Expected vacancies" value={total} />
        <Kpi label="Confirmed" value={c.reqs.filter((r) => r.status === "confirmed").length} tone="green" />
        <Kpi label="Pending" value={c.reqs.filter((r) => r.status === "pending").length} tone="amber" />
      </div>
      <Card title={`Upcoming hiring requirements (${c.reqs.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Company / HR</th><th>Role</th><th className="text-right">Vacancies</th><th>Expected</th><th>Owner</th><th>Status</th><th /></tr></thead>
          <tbody>
            {c.reqs.map((r) => (
              <tr key={r.id}>
                <td><div className="text-[13px] font-medium text-navy">{r.company}</div><div className="text-[11px] text-muted"><HrName c={c} id={r.hr_id} /></div></td>
                <td className="text-xs">{r.role}</td>
                <td className="text-right tabular-nums">{r.vacancies}</td>
                <td className="text-xs">{r.expected_period ?? fmtDate(r.expected_date)}</td>
                <td className="text-xs">{r.assigned_to ?? "—"}</td>
                <td><Badge tone={requirementTone(r.status)}>{REQUIREMENT_STATUSES.find(([k]) => k === r.status)?.[1] ?? r.status}</Badge></td>
                <td>
                  <form action={setRequirementStatusAction.bind(null, r.id, "confirmed")}>
                    <input type="hidden" name="back" value="/hr-contacts?tab=requirements" />
                    {r.status !== "confirmed" && <button className="text-xs text-muted hover:text-brand">Confirm</button>}
                  </form>
                </td>
              </tr>
            ))}
            {!c.reqs.length && <tr><td colSpan={7}><Empty>No hiring requirements recorded yet.</Empty></td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title="Add a hiring requirement" bodyClass="p-3">
        <form action={addRequirementAction} className="grid gap-2 text-xs sm:grid-cols-3">
          {hrSelect(c)}
          <I name="role" required placeholder="Role *" />
          <I name="vacancies" type="number" placeholder="Vacancies" />
          <I name="expected_period" placeholder="Expected period (e.g. December)" />
          <I name="expected_date" type="date" placeholder="Expected date" />
          <I name="qualification" placeholder="Qualification" />
          <I name="branches" placeholder="Branches" />
          <I name="package" placeholder="Package" />
          <I name="experience" placeholder="Experience" />
          <I name="location" placeholder="Location" />
          <select name="status" aria-label="Status" className="input py-1.5">{REQUIREMENT_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select name="assigned_to" aria-label="Owner" className="input py-1.5"><option value="">Owner…</option>{c.staff.filter((s) => s.active !== false).map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
          <div className="sm:col-span-3"><button className="btn-primary">Add requirement</button></div>
        </form>
      </Card>
    </div>
  );
}

/** §19 Reminder centre, grouped exactly as the spec lists them. */
function reminders(c: HCtx) {
  const rem = hrReminders({ contacts: c.contacts, calls: c.calls, history: c.history, drives: c.drives, reqs: c.reqs, subs: c.subs, feedback: c.feedback, apps: c.apps, today: c.today, nowMs: c.now });
  const groups = REMINDER_GROUPS.map((g) => [g, rem.filter((r) => r.group === g)] as const);
  const total = rem.length;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Total reminders" value={total} />
        <Kpi label="Urgent" value={rem.filter((r) => r.tone === "red").length} tone="red" />
        <Kpi label="Due soon" value={rem.filter((r) => r.tone === "amber").length} tone="amber" />
        <Kpi label="Groups active" value={groups.filter(([, rows]) => rows.length).length} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(([label, rows]) => (
          <Card key={label} title={`${label} (${rows.length})`} bodyClass="p-0">
            <ul className="divide-y divide-line">
              {rows.slice(0, 8).map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-2 px-3 py-2">
                  {r.hr_id
                    ? <Link href={hLink(r.hr_id)} className="text-[13px] text-navy hover:text-brand">{r.title}</Link>
                    : <span className="text-[13px] text-navy">{r.title}</span>}
                  <span className={`shrink-0 text-[11px] ${r.tone === "red" ? "text-red-600" : "text-muted"}`}>{r.owner ?? fmtDate(r.when)}</span>
                </li>
              ))}
              {rows.length > 8 && <li className="px-3 py-1.5 text-[11px] text-muted">+{rows.length - 8} more</li>}
              {!rows.length && <li className="px-3 py-3 text-xs text-muted">Nothing pending.</li>}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** §7 Every staff member who has worked this relationship, kept after they leave. */
export function Relationships({ c, hr }: { c: HCtx; hr: HrContact }) {
  const rows = staffRelationships(c.calls, hr.id);
  const active = new Set(c.staff.filter((s) => s.active !== false).map((s) => s.full_name));
  return (
    <Card title="MasterVLSI staff relationship" bodyClass="p-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => (
          <div key={r.staff} className="rounded-[5px] border border-line bg-white p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-navy">{r.staff}</span>
              <Badge tone={relationshipTone(r.strength)}>{RELATIONSHIP_STATUSES.find(([k]) => k === r.strength)?.[1]}</Badge>
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-navy">{r.interactions}</div>
            <div className="text-[11px] text-muted">interactions · {r.connected} connected</div>
            <div className="text-[11px] text-muted">Last contacted {fmtDate(r.last_contacted)}</div>
            {!active.has(r.staff) && <div className="mt-1 text-[10px] text-amber-700">Former staff — history retained</div>}
          </div>
        ))}
        {!rows.length && <div className="sm:col-span-4"><Empty>No one has logged a conversation with this HR yet.</Empty></div>}
      </div>
      <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
        <Field label="First introduced by" value={hr.introduced_by} />
        <Field label="Primary relationship owner" value={hr.assigned_to} />
        <Field label="Alternative owner" value={hr.alt_assigned_to} />
        <Field label="Last successful contact" value={fmtDate(rows[0]?.last_contacted)} />
        <Field label="Next follow-up" value={istDateTime(hr.next_follow_up)} />
        <Field label="Next action" value={hr.follow_up_note} />
      </dl>
    </Card>
  );
}

/** §5 Employment history: one row per stint, each keeping its own email. */
export function Employment({ c, hr }: { c: HCtx; hr: HrContact }) {
  const mine = c.history.filter((h) => h.hr_id === hr.id).sort((a, b) => (b.from_date ?? "").localeCompare(a.from_date ?? ""));
  return (
    <Card title="Employment & email history" icon={<History size={15} />} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>#</th><th>Company</th><th>Designation</th><th>Official email</th><th>From</th><th>To</th><th>Duration</th><th>Status</th><th /></tr></thead>
        <tbody>
          {mine.map((h, k) => (
            <tr key={h.id}>
              <td>{k + 1}</td>
              <td className="font-medium">{h.company}</td>
              <td className="text-xs">{h.designation ?? "—"}</td>
              <td className="text-xs">{h.official_email ?? "—"}</td>
              <td className="text-xs">{fmtDate(h.from_date)}</td>
              <td className="text-xs">{h.to_date ? fmtDate(h.to_date) : "Present"}</td>
              <td className="text-xs">{duration(h.from_date, h.to_date)}</td>
              <td><Badge tone={h.to_date ? "slate" : "green"}>{h.to_date ? "Previous" : "Current"}</Badge></td>
              <td><form action={deleteRowAction.bind(null, "hr_company_history", h.id)}><button className="text-xs text-muted hover:text-brand">Delete</button></form></td>
            </tr>
          ))}
          {!mine.length && <tr><td colSpan={9}><Empty>No employment history recorded.</Empty></td></tr>}
        </tbody>
      </table>
      <div className="border-t border-line p-3">
        <div className="mb-2 text-xs font-medium text-navy">Record a company change</div>
        <p className="mb-2 text-[11px] text-muted">The current stint is closed with this date and keeps its own email and designation. Nothing already recorded is overwritten.</p>
        <form action={changeCompanyAction.bind(null, hr.id)} className="grid gap-2 text-xs sm:grid-cols-3">
          <input type="hidden" name="back" value={`/hr-contacts?tab=database&id=${hr.id}`} />
          <I name="company" required placeholder="New company *" />
          <I name="designation" placeholder="New designation" />
          <I name="email" placeholder="New official email" />
          <I name="from_date" type="date" placeholder="Joined on *" required />
          <I name="location" placeholder="Location" />
          <select name="replacement_hr_id" aria-label="Replacement HR at the old company" className="input py-1.5">
            <option value="">Replacement HR at old company…</option>
            {c.contacts.filter((x) => x.id !== hr.id).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
          </select>
          <div className="sm:col-span-3"><Save label="Record company change" /></div>
        </form>
      </div>
    </Card>
  );
}

/** §7 Communication log plus the single form that logs a contact and sets the next step. */
export function Communication({ c, hr }: { c: HCtx; hr: HrContact }) {
  const mine = c.calls.filter((x) => x.hr_id === hr.id);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Card title={`Communication history (${mine.length})`} icon={<Phone size={15} />} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Staff</th><th>Mode</th><th>Outcome</th><th>Discussion</th></tr></thead>
          <tbody>
            {mine.map((x) => (
              <tr key={x.id}>
                <td className="whitespace-nowrap text-xs">{fmtDate(x.call_date)}</td>
                <td className="text-xs">{x.by_name ?? "—"}</td>
                <td className="text-xs capitalize">{x.mode ?? "call"}</td>
                <td><Badge tone={outcomeTone(x.outcome)}>{x.outcome ?? "—"}</Badge></td>
                <td className="text-xs">{x.remarks}</td>
              </tr>
            ))}
            {!mine.length && <tr><td colSpan={5}><Empty>No conversations logged yet.</Empty></td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title="Log a conversation" bodyClass="p-3">
        <form action={logContactAction.bind(null, hr.id)} className="grid gap-2 text-xs">
          <input type="hidden" name="back" value={`/hr-contacts?tab=database&id=${hr.id}`} />
          <div className="grid grid-cols-2 gap-2">
            <select name="mode" aria-label="Mode" className="input py-1.5">{CONTACT_MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select name="outcome" aria-label="Outcome" className="input py-1.5"><option>Connected</option><option>Interested</option><option>Replied</option><option>To follow up</option><option>Not connected</option><option>Not interested</option></select>
          </div>
          <select name="activity" aria-label="Activity" className="input py-1.5"><option>Introduction call</option><option>Placement discussion</option><option>Follow-up</option><option>Profiles shared</option><option>Interview scheduling</option><option>Drive confirmation</option></select>
          <textarea name="remarks" required rows={3} aria-label="Discussion" placeholder="What was discussed *" className="input" />
          <select name="stage" aria-label="Move to stage" className="input py-1.5"><option value="">Keep current stage</option>{HR_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <I name="next_date" type="date" placeholder="Next follow-up" />
            <I name="next_time" type="time" placeholder="Time" />
          </div>
          <I name="next_note" placeholder="Next action" />
          <button className="btn-primary">Save conversation</button>
        </form>
      </Card>
    </div>
  );
}

/** Drives already running at any company this HR has worked for. */
export function Opportunities({ c, hr }: { c: HCtx; hr: HrContact }) {
  const key = (v?: string | null) => (v ?? "").toLowerCase().split(" ")[0];
  const theirs = new Set([hr.current_company, ...c.history.filter((h) => h.hr_id === hr.id).map((h) => h.company)].map(key).filter(Boolean));
  const rows = c.drives.filter((d) => theirs.has(key(d.company)));
  return (
    <Card title={`Placement opportunities (${rows.length})`} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Company</th><th>Role</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((d) => <tr key={d.id}><td className="font-medium">{d.company}</td><td className="text-xs">{d.job_role}</td><td className="text-xs">{fmtDate(d.drive_date)}</td><td className="text-xs capitalize">{d.status}</td></tr>)}
          {!rows.length && <tr><td colSpan={4}><Empty>No drives yet at this HR&apos;s companies. <Link href="/placements" className="text-brand hover:underline">Create a drive</Link>.</Empty></td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

/** Free-text reference note. Hidden fields keep the rest of the row intact on save. */
export function ReferenceNote({ hr }: { hr: HrContact }) {
  const keep = ["id", "full_name", "designation", "department", "phone", "email", "linkedin", "city", "current_company", "company_type", "joined_on", "hr_code", "stage", "relationship_status", "hiring_status", "assigned_to", "alt_assigned_to", "introduced_by", "source", "personal_email", "previous_company", "preferred_contact"] as const;
  return (
    <Card title="Reference / hiring insight">
      <form action={saveRowAction.bind(null, "hr_contacts")} className="space-y-2">
        {keep.map((k) => <input key={k} type="hidden" name={k} value={(hr[k] as string) ?? ""} />)}
        <textarea name="reference_note" defaultValue={hr.reference_note ?? ""} rows={4} aria-label="Reference note" className="input" placeholder="How do we know this HR? Past hiring, batches, references…" />
        <Save />
      </form>
    </Card>
  );
}

/** The HR profile: identity, pipeline position and the stage control. */
export function HrProfile({ c, hr }: { c: HCtx; hr: HrContact }) {
  const acts = c.acts.filter((a) => a.hr_id === hr.id);
  return (
    <div className="space-y-5">
      <section className="rounded-[5px] border border-line bg-white p-4">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-navy-soft text-lg font-medium text-brand">{initials(hr.full_name)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-medium text-navy">{hr.full_name}</h2>
              <Badge tone="blue">{hr.hr_code ?? "—"}</Badge>
              <Badge tone={relationshipTone(hr.relationship_status)}>{RELATIONSHIP_STATUSES.find(([k]) => k === hr.relationship_status)?.[1] ?? "New"}</Badge>
              <Badge tone={hr.hiring_status === "active_hiring" ? "green" : hr.hiring_status === "future_hiring" ? "amber" : "slate"}>{hiringLabel(hr.hiring_status)}</Badge>
            </div>
            <div className="text-sm text-muted">{hr.designation}{hr.current_company ? ` · ${hr.current_company}` : ""}</div>
            <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-[#515b73]">
              {hr.phone && <a href={`tel:${hr.phone}`} className="flex items-center gap-1 hover:text-brand"><Phone size={13} /> {hr.phone}</a>}
              {hr.email && <a href={`mailto:${hr.email}`} className="flex items-center gap-1 hover:text-brand"><Mail size={13} /> {hr.email}</a>}
              {hr.linkedin && <a href={`https://${hr.linkedin.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-brand"><Link2 size={13} /> LinkedIn</a>}
              {hr.city && <span className="flex items-center gap-1"><MapPin size={13} /> {hr.city}</span>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {HR_STAGES.map((s) => (
            <form key={s.key} action={moveHrStageAction.bind(null, hr.id, s.key)}>
              <input type="hidden" name="back" value={`/hr-contacts?tab=database&id=${hr.id}`} />
              <button className={`rounded-[5px] px-2.5 py-1.5 text-[11px] ${stageOf(hr) === s.key ? "bg-brand font-medium text-white" : "bg-slate-50 text-navy hover:bg-slate-100"}`}>{s.label}</button>
            </form>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="HR details">
          <dl>
            <Field label="Permanent HR ID" value={hr.hr_code} />
            <Field label="Department" value={hr.department} />
            <Field label="Personal email" value={hr.personal_email} />
            <Field label="Preferred contact" value={hr.preferred_contact} />
            <Field label="Source" value={hr.source ? HR_SOURCES[hr.source] ?? hr.source : null} />
            <Field label="Introduced by" value={hr.introduced_by} />
            <Field label="Last verified" value={fmtDate(hr.last_verified)} />
          </dl>
        </Card>
        <Card title="Current organization" className="bg-navy-soft">
          <div className="mb-2 flex items-center gap-2 text-base font-medium text-navy"><Building2 size={18} className="text-brand" /> {hr.current_company ?? "—"}</div>
          <dl>
            <Field label="Joined on" value={fmtDate(hr.joined_on)} />
            <Field label="Previous company" value={hr.previous_company} />
            <Field label="Company type" value={hr.company_type} />
            <Field label="Stage" value={hrStageLabel(hr.stage)} />
          </dl>
        </Card>
      </div>

      <Relationships c={c} hr={hr} />
      <Employment c={c} hr={hr} />
      <Communication c={c} hr={hr} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Opportunities c={c} hr={hr} />
        <ReferenceNote hr={hr} />
      </div>

      <Card title={`Activity log (${acts.length})`} bodyClass="p-0">
        <ul className="divide-y divide-line">
          {acts.slice(0, 15).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <span className="text-navy">{a.summary}</span>
              <span className="shrink-0 text-muted">{a.by_name} · {fmtDate(a.created_at)}</span>
            </li>
          ))}
          {!acts.length && <li className="px-3 py-3 text-xs text-muted">Nothing logged yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

/** §4 The HR database: searchable list, allocation, and the registration form. */
export function Database({ c }: { c: HCtx }) {
  const q = typeof c.sp.q === "string" ? c.sp.q.trim().toLowerCase() : "";
  const shown = c.contacts.filter((h) => !q || [h.full_name, h.current_company, h.phone, h.email, h.hr_code].some((v) => v?.toLowerCase().includes(q)));
  return (
    <Card title={`HR database (${shown.length} of ${c.contacts.length})`} bodyClass="p-0">
      <form className="border-b border-line p-3">
        <input type="hidden" name="tab" value="database" />
        <input name="q" defaultValue={q} placeholder="Search by name, HR ID, company, phone or email" aria-label="Search HR" className="input" />
      </form>
      <form action={allocateHrAction} className="overflow-x-auto">
        <input type="hidden" name="back" value="/hr-contacts?tab=database" />
        <table className="table">
          <thead><tr><th /><th>HR</th><th>Company</th><th>Stage</th><th>Relationship</th><th>Hiring</th><th>Owner</th><th>Next follow-up</th></tr></thead>
          <tbody>
            {shown.map((h) => (
              <tr key={h.id}>
                <td><input type="checkbox" name="ids" value={h.id} aria-label={`Select ${h.full_name}`} /></td>
                <td><Link href={hLink(h.id)} className="font-medium text-navy hover:text-brand">{h.full_name}</Link><div className="text-[11px] text-muted">{h.hr_code} · {h.designation ?? "—"}</div></td>
                <td className="text-xs">{h.current_company ?? "—"}</td>
                <td className="text-xs">{hrStageLabel(h.stage)}</td>
                <td><Badge tone={relationshipTone(h.relationship_status)}>{RELATIONSHIP_STATUSES.find(([k]) => k === h.relationship_status)?.[1] ?? "New"}</Badge></td>
                <td className="text-xs">{hiringLabel(h.hiring_status)}</td>
                <td className="text-xs">{h.assigned_to ?? "Unassigned"}</td>
                <td className="text-xs">{h.next_follow_up ? istDateTime(h.next_follow_up) : "—"}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={8}><Empty>No HR matches that search.</Empty></td></tr>}
          </tbody>
        </table>
        {c.admin && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line p-3 text-xs">
            <span className="text-muted">Allocate selected to</span>
            <select name="to" aria-label="Allocate to" className="input w-auto py-1.5">
              {c.staff.filter((s) => s.active !== false).map((s) => <option key={s.id}>{s.full_name}</option>)}
            </select>
            <Save label="Allocate" />
          </div>
        )}
      </form>
    </Card>
  );
}

export const HR_TABS: Record<string, (c: HCtx) => ReactNode> = {
  dashboard, pipeline, requirements, reminders,
};
