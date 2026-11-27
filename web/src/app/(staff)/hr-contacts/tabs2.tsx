import Link from "next/link";
import { I, Save } from "@/components/form-bits";
import { Kpi } from "@/components/student360";
import { Badge, Card, Empty } from "@/components/ui";
import { company360, contributionFor, dailyReport, pipelineFor, SEQUENCE } from "@/lib/hr-drives";
import { companyRoster, excelRecipients } from "@/lib/hr";
import { fmtDate, istDateTime } from "@/lib/format";
import {
  CONFIRMATIONS,
  confirmationTone,
  SENTIMENTS,
  sentimentTone,
  SUBMISSION_STATUSES,
  submissionTone,
  type Drive,
} from "@/lib/types";
import type { HCtx } from "./tabs";
import { addFeedbackAction, approveSubmissionAction, closeFeedbackAction, completeTaskAction, prepareSubmissionAction, saveDriveConfigAction, syncSequenceAction } from "./actions";

const hLink = (id: string) => `/hr-contacts?tab=database&id=${id}`;
const dateOf = (iso?: string | null) => (iso ? iso.slice(0, 10) : null);

function HrOf({ c, id }: { c: HCtx; id?: string | null }) {
  const x = id ? c.contacts.find((h) => h.id === id) : undefined;
  return x ? <Link href={hLink(x.id)} className="text-navy hover:text-brand">{x.full_name}</Link> : <span className="text-muted">—</span>;
}

/** §9 + §10 + §11: the drive calendar, one drive's configuration, and its reminder sequence. */
export function drives(c: HCtx) {
  const sel = typeof c.sp.drive === "string" ? c.drives.find((d) => d.id === c.sp.drive) : undefined;
  const upcoming = c.drives
    .filter((d) => (dateOf(d.drive_date) ?? "") >= c.today)
    .sort((a, b) => (a.drive_date ?? "").localeCompare(b.drive_date ?? ""));
  const lead = (d: Drive) => (d.drive_date ? new Date(Date.parse(d.drive_date.slice(0, 10) + "T00:00:00Z") - (d.reminder_lead_days ?? 7) * 86_400_000).toISOString().slice(0, 10) : null);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Upcoming drives" value={upcoming.length} />
        <Kpi label="Within 7 days" value={upcoming.filter((d) => (dateOf(d.drive_date) ?? "") <= new Date(c.now + 7 * 86_400_000).toISOString().slice(0, 10)).length} tone="amber" />
        <Kpi label="Confirmed" value={c.drives.filter((d) => d.confirmation === "confirmed").length} tone="green" />
        <Kpi label="Completed" value={c.drives.filter((d) => (dateOf(d.drive_date) ?? "") < c.today).length} />
      </div>

      <Card title={`All upcoming drives (${upcoming.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Company</th><th>HR</th><th>Interview</th><th>Reminder starts</th><th>Coordinator</th><th>Status</th><th /></tr></thead>
          <tbody>
            {upcoming.map((d) => (
              <tr key={d.id}>
                <td><div className="text-[13px] font-medium text-navy">{d.company}</div><div className="text-[11px] text-muted">{d.job_role}</div></td>
                <td className="text-xs"><HrOf c={c} id={d.hr_id} /></td>
                <td className="text-xs">{fmtDate(d.drive_date)}</td>
                <td className="text-xs">{fmtDate(lead(d))}</td>
                <td className="text-xs">{d.coordinator ?? "—"}</td>
                <td><Badge tone={confirmationTone(d.confirmation)}>{CONFIRMATIONS.find(([k]) => k === d.confirmation)?.[1] ?? "Pending"}</Badge></td>
                <td><Link href={`/hr-contacts?tab=drives&drive=${d.id}`} className="text-xs text-brand hover:underline">Configure</Link></td>
              </tr>
            ))}
            {!upcoming.length && <tr><td colSpan={7}><Empty>No upcoming drives. <Link href="/placements" className="text-brand hover:underline">Create one</Link>.</Empty></td></tr>}
          </tbody>
        </table>
      </Card>

      {sel && <DriveConfig c={c} d={sel} />}
      {sel && <DriveSequence c={c} d={sel} />}
    </div>
  );
}

/** §10 Everything the company needs agreed before the sheet goes out. */
function DriveConfig({ c, d }: { c: HCtx; d: Drive }) {
  const recipients = excelRecipients(c.contacts, c.history, d.company);
  return (
    <Card title={`${d.company} — drive configuration`} bodyClass="p-3">
      <form action={saveDriveConfigAction.bind(null, d.id)} className="grid gap-2 text-xs sm:grid-cols-3">
        <input type="hidden" name="back" value={`/hr-contacts?tab=drives&drive=${d.id}`} />
        <label className="text-muted">Current HR
          <select name="hr_id" defaultValue={d.hr_id ?? ""} className="input mt-1 py-1.5">
            <option value="">—</option>
            {c.contacts.map((h) => <option key={h.id} value={h.id}>{h.full_name}{h.current_company ? ` — ${h.current_company}` : ""}</option>)}
          </select>
        </label>
        <label className="text-muted">Assigned coordinator
          <select name="coordinator" defaultValue={d.coordinator ?? ""} className="input mt-1 py-1.5">
            <option value="">—</option>
            {c.staff.filter((s) => s.active !== false).map((s) => <option key={s.id}>{s.full_name}</option>)}
          </select>
        </label>
        <label className="text-muted">Drive status
          <select name="confirmation" defaultValue={d.confirmation ?? "pending"} className="input mt-1 py-1.5">{CONFIRMATIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="text-muted">Vacancies<input name="vacancies" type="number" defaultValue={d.vacancies ?? 0} className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Qualification<input name="qualification" defaultValue={d.qualification ?? ""} className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Branches<input name="branches" defaultValue={d.branches ?? ""} className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Passout<input name="passout" defaultValue={d.passout ?? ""} className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Experience<input name="experience" defaultValue={d.experience ?? ""} className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Excel format<input name="excel_format" defaultValue={d.excel_format ?? ""} className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Interest closes<input name="interest_close_date" type="date" defaultValue={dateOf(d.interest_close_at) ?? ""} className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Interest close time<input name="interest_close_time" type="time" defaultValue="10:00" className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Excel due<input name="excel_due_date" type="date" defaultValue={dateOf(d.excel_due_at) ?? ""} className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Excel due time<input name="excel_due_time" type="time" defaultValue="12:00" className="input mt-1 py-1.5" /></label>
        <label className="text-muted">Sending mode
          <select name="sending_mode" defaultValue={d.sending_mode ?? "after_approval"} className="input mt-1 py-1.5"><option value="after_approval">After approval</option><option value="automatic">Automatic</option></select>
        </label>
        <label className="text-muted">Reminder lead time (days)<input name="reminder_lead_days" type="number" min={1} max={60} defaultValue={d.reminder_lead_days ?? 7} className="input mt-1 py-1.5" /></label>
        <label className="text-muted sm:col-span-2">JD attachment link<input name="jd_url" defaultValue={d.jd_url ?? ""} className="input mt-1 py-1.5" /></label>
        <label className="flex items-end gap-2 text-muted"><input type="checkbox" name="consent_required" value="1" defaultChecked={d.consent_required !== false} /> Student consent mandatory</label>
        <div className="sm:col-span-3 flex items-center gap-3">
          <button className="btn-primary">Save configuration</button>
          <span className="text-[11px] text-muted">
            {recipients.length ? `Sheet will go to ${recipients.map((h) => h.email).join(", ")}` : `No current HR with a verified email at ${d.company}`}
          </span>
        </div>
      </form>
    </Card>
  );
}

/** §11 The generated sequence, with the company's own deadline flagged where it overrides. */
function DriveSequence({ c, d }: { c: HCtx; d: Drive }) {
  const mine = c.tasks.filter((t) => t.drive_id === d.id).sort((a, b) => a.due_on.localeCompare(b.due_on));
  const order = new Map(SEQUENCE.map((s, i) => [s.step, i]));
  return (
    <Card
      title={`Reminder sequence — ${d.company} (${mine.filter((t) => t.status === "done").length}/${mine.length} done)`}
      bodyClass="p-0"
      actions={<form action={syncSequenceAction.bind(null, d.id)}><input type="hidden" name="back" value={`/hr-contacts?tab=drives&drive=${d.id}`} /><button className="text-xs text-brand hover:underline">Regenerate</button></form>}
    >
      <ul className="divide-y divide-line">
        {mine.sort((a, b) => (order.get(a.step) ?? 0) - (order.get(b.step) ?? 0)).map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[13px] text-navy">{t.title}{t.hard_deadline && <Badge tone="red">Company deadline</Badge>}</div>
              <div className="text-[11px] text-muted">{t.detail}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs">
              <span className={t.due_on < c.today && t.status === "pending" ? "text-red-600" : "text-muted"}>{fmtDate(t.due_on)}</span>
              <span className="text-muted">{t.assigned_to ?? "—"}</span>
              {t.status === "done"
                ? <Badge tone="green">Done</Badge>
                : <form action={completeTaskAction.bind(null, t.id)}><input type="hidden" name="back" value={`/hr-contacts?tab=drives&drive=${d.id}`} /><button className="btn-navy py-1 text-[11px]">Mark done</button></form>}
            </div>
          </li>
        ))}
        {!mine.length && <li className="p-4"><Empty>No sequence yet — set the interview date and save the configuration.</Empty></li>}
      </ul>
    </Card>
  );
}

/** §12 Everything outstanding, by staff member. */
export function activities(c: HCtx) {
  const only = typeof c.sp.staff === "string" ? c.sp.staff : "";
  const rows = (only ? c.tasks.filter((t) => t.assigned_to === only) : c.tasks).filter((t) => t.status !== "skipped");
  const owners = [...new Set(c.tasks.map((t) => t.assigned_to).filter(Boolean))] as string[];
  const driveName = (id?: string | null) => c.drives.find((d) => d.id === id)?.company ?? "—";
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Allocated" value={rows.length} />
        <Kpi label="Completed" value={rows.filter((t) => t.status === "done").length} tone="green" />
        <Kpi label="Pending" value={rows.filter((t) => t.status === "pending").length} tone="amber" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link href="/hr-contacts?tab=activities" className={`rounded-[5px] px-2.5 py-1.5 ${!only ? "bg-brand text-white" : "bg-slate-50 text-navy hover:bg-slate-100"}`}>All staff</Link>
        {owners.map((o) => <Link key={o} href={`/hr-contacts?tab=activities&staff=${encodeURIComponent(o)}`} className={`rounded-[5px] px-2.5 py-1.5 ${only === o ? "bg-brand text-white" : "bg-slate-50 text-navy hover:bg-slate-100"}`}>{o}</Link>)}
      </div>
      <Card title={`Pending activities (${rows.filter((t) => t.status === "pending").length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Company — activity</th><th>Owner</th><th>Due</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.sort((a, b) => a.due_on.localeCompare(b.due_on)).map((t) => (
              <tr key={t.id}>
                <td><span className="font-medium text-navy">{driveName(t.drive_id)}</span> — {t.title}</td>
                <td className="text-xs">{t.assigned_to ?? "—"}</td>
                <td className="text-xs"><span className={t.due_on < c.today && t.status === "pending" ? "text-red-600" : ""}>{fmtDate(t.due_on)}</span></td>
                <td><Badge tone={t.status === "done" ? "green" : t.due_on < c.today ? "red" : "amber"}>{t.status === "done" ? "Done" : t.due_on < c.today ? "Overdue" : "Pending"}</Badge></td>
                <td>{t.status === "pending" && <form action={completeTaskAction.bind(null, t.id)}><input type="hidden" name="back" value="/hr-contacts?tab=activities" /><button className="text-xs text-muted hover:text-brand">Mark done</button></form>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5}><Empty>Nothing allocated. Configure a drive to generate its reminder sequence.</Empty></td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/** §13 Student interest per drive and the Excel sheet sent to the company. */
export function interest(c: HCtx) {
  const open = c.drives.filter((d) => (dateOf(d.drive_date) ?? "") >= c.today);
  const sel = typeof c.sp.drive === "string" ? c.drives.find((d) => d.id === c.sp.drive) : open[0];
  const yes = sel ? c.responses.filter((r) => r.drive_id === sel.id && r.response === "yes") : [];
  const subs = sel ? c.subs.filter((s) => s.drive_id === sel.id) : [];
  const recipients = sel ? excelRecipients(c.contacts, c.history, sel.company) : [];
  const student = (id: string) => c.students.find((s) => s.id === id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-xs">
        {open.map((d) => (
          <Link key={d.id} href={`/hr-contacts?tab=interest&drive=${d.id}`} className={`rounded-[5px] px-2.5 py-1.5 ${sel?.id === d.id ? "bg-brand text-white" : "bg-slate-50 text-navy hover:bg-slate-100"}`}>{d.company}</Link>
        ))}
        {!open.length && <Empty>No upcoming drives.</Empty>}
      </div>

      {sel && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi label="Interested students" value={yes.length} />
            <Kpi label="Interest closes" value={sel.interest_close_at ? istDateTime(sel.interest_close_at) : "—"} />
            <Kpi label="Excel due" value={sel.excel_due_at ? istDateTime(sel.excel_due_at) : "—"} />
            <Kpi label="Sending mode" value={sel.sending_mode === "automatic" ? "Automatic" : "After approval"} />
          </div>

          <Card title={`Automatically generated Excel preview — ${sel.company} (${yes.length})`} bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Student ID</th><th>Name</th><th>Course</th><th>Attendance</th><th>Consent</th></tr></thead>
              <tbody>
                {yes.slice(0, 25).map((r) => {
                  const s = student(r.student_id);
                  return (
                    <tr key={r.student_id}>
                      <td className="font-mono text-xs">{s?.enrollment_no ?? r.student_id.slice(0, 8)}</td>
                      <td className="text-[13px]">{s?.full_name ?? "—"}</td>
                      <td className="text-xs">{s?.course_name ?? "—"}</td>
                      <td className="text-xs">{s ? `${s.attendance_pct}%` : "—"}</td>
                      <td><Badge tone={s?.placement_consent ? "green" : "red"}>{s?.placement_consent ? "Accepted" : "Missing"}</Badge></td>
                    </tr>
                  );
                })}
                {!yes.length && <tr><td colSpan={5}><Empty>No student has registered interest yet.</Empty></td></tr>}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <Card title={`Submissions (${subs.length})`} bodyClass="p-0 overflow-x-auto">
              <table className="table">
                <thead><tr><th>Recipient</th><th className="text-right">Students</th><th>Scheduled</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id}>
                      <td className="text-xs">{s.recipient_email}<div className="text-[11px] text-muted">{s.file_name}</div></td>
                      <td className="text-right tabular-nums">{s.student_count}</td>
                      <td className="text-xs">{s.scheduled_at ? istDateTime(s.scheduled_at) : "—"}</td>
                      <td><Badge tone={submissionTone(s.status)}>{SUBMISSION_STATUSES.find(([k]) => k === s.status)?.[1] ?? s.status}</Badge></td>
                      <td>{s.status === "awaiting_approval" && (
                        <form action={approveSubmissionAction.bind(null, s.id)}>
                          <input type="hidden" name="back" value={`/hr-contacts?tab=interest&drive=${sel.id}`} />
                          <button className="text-xs text-brand hover:underline">Approve</button>
                        </form>
                      )}</td>
                    </tr>
                  ))}
                  {!subs.length && <tr><td colSpan={5}><Empty>No sheet prepared for this drive yet.</Empty></td></tr>}
                </tbody>
              </table>
            </Card>
            <Card title="Prepare the student sheet" bodyClass="p-3">
              <p className="mb-2 text-[11px] text-muted">Only a current HR at {sel.company} with a verified official email can receive it.</p>
              <form action={prepareSubmissionAction.bind(null, sel.id)} className="grid gap-2 text-xs">
                <input type="hidden" name="back" value={`/hr-contacts?tab=interest&drive=${sel.id}`} />
                <select name="hr_id" aria-label="Recipient" className="input py-1.5">
                  {recipients.map((h) => <option key={h.id} value={h.id}>{h.full_name} — {h.email}</option>)}
                  {!recipients.length && <option value="">No eligible recipient</option>}
                </select>
                <button className="btn-primary" disabled={!recipients.length}>Prepare sheet</button>
              </form>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/** §14 + §15: the funnel overall, and what each HR has delivered over time. */
export function placements(c: HCtx) {
  const all = new Set(c.drives.map((d) => d.id));
  const p = pipelineFor(all, c.responses, c.apps);
  const stages: [string, number, ("green" | "amber" | "red" | undefined)?][] = [
    ["Interested", p.interested], ["Profiles shared", p.profiles_shared], ["Shortlisted", p.shortlisted],
    ["Call letters", p.call_letters], ["Attended", p.attended], ["Selected", p.selected, "green"],
    ["Offered", p.offered, "green"], ["Joined", p.joined, "green"],
  ];
  const drops: [string, number][] = [
    ["Profiles not shared", p.not_shared], ["Call-letter no-show", p.no_show],
    ["Not selected", p.not_selected], ["Offer not joined", p.not_joined],
  ];
  const withDrives = c.contacts.filter((h) => c.drives.some((d) => d.hr_id === h.id));

  return (
    <div className="space-y-5">
      <Card title="Complete placement pipeline" bodyClass="p-3">
        <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {stages.map(([l, v, tone]) => <Kpi key={l} label={l} value={v} tone={tone} />)}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {drops.map(([l, v]) => <Kpi key={l} label={l} value={v} tone={v ? "red" : undefined} />)}
        </div>
      </Card>

      <Card title={`HR-wise lifetime contribution (${withDrives.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>HR</th><th className="text-right">Drives</th><th className="text-right">Interested</th><th className="text-right">Shared</th><th className="text-right">Shortlisted</th><th className="text-right">Attended</th><th className="text-right">Selected</th><th className="text-right">Joined</th></tr></thead>
          <tbody>
            {withDrives.map((h) => {
              const k = contributionFor(h.id, c.drives, c.responses, c.apps);
              return (
                <tr key={h.id}>
                  <td><Link href={hLink(h.id)} className="font-medium text-navy hover:text-brand">{h.full_name}</Link><div className="text-[11px] text-muted">{h.hr_code}</div></td>
                  <td className="text-right tabular-nums">{k.drives}</td>
                  <td className="text-right tabular-nums">{k.interested}</td>
                  <td className="text-right tabular-nums">{k.shared}</td>
                  <td className="text-right tabular-nums">{k.shortlisted}</td>
                  <td className="text-right tabular-nums">{k.attended}</td>
                  <td className="text-right tabular-nums">{k.selected}</td>
                  <td className="text-right tabular-nums">{k.joined}</td>
                </tr>
              );
            })}
            {!withDrives.length && <tr><td colSpan={8}><Empty>No drive is linked to an HR yet. Set the HR on a drive under Drives.</Empty></td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/** §16 Company 360°: current and previous HRs, drives, funnel and our alumni inside. */
export function companyProfile(c: HCtx) {
  const q = typeof c.sp.company === "string" ? c.sp.company : "";
  const all = [...new Set([...c.contacts.map((h) => h.current_company), ...c.history.map((h) => h.company), ...c.drives.map((d) => d.company)].filter(Boolean))] as string[];
  const { current, previous } = companyRoster(c.contacts, c.history, q);
  const recipients = excelRecipients(c.contacts, c.history, q);
  const v = q ? company360(q, { contacts: c.contacts, drives: c.drives, responses: c.responses, apps: c.apps }) : null;

  return (
    <div className="space-y-5">
      <Card title="Company 360°" bodyClass="p-3">
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value="companies" />
          <select name="company" defaultValue={q} aria-label="Company" className="input w-auto min-w-56 py-1.5">
            <option value="">Choose a company…</option>
            {all.sort().map((x) => <option key={x}>{x}</option>)}
          </select>
          <Save label="Open" />
        </form>
      </Card>

      {!q && <Empty>Pick a company to see its HRs, drives and alumni.</Empty>}

      {q && v && (
        <>
          <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-8">
            <Kpi label="Current HRs" value={current.length} tone="green" />
            <Kpi label="Previous HRs" value={previous.length} />
            <Kpi label="Completed drives" value={v.completed} />
            <Kpi label="Upcoming drives" value={v.upcoming} />
            <Kpi label="Student interests" value={v.pipeline.interested} />
            <Kpi label="Selected" value={v.pipeline.selected} tone="green" />
            <Kpi label="Joined" value={v.pipeline.joined} tone="green" />
            <Kpi label="Alumni working" value={v.alumni.length} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <Card title="HRs at this company" bodyClass="p-0 overflow-x-auto">
              <table className="table">
                <thead><tr><th>HR name</th><th>Current company</th><th>Latest email</th><th>Owner</th><th>Status</th></tr></thead>
                <tbody>
                  {[...current.map((h) => [h, "Current HR"] as const), ...previous.map((h) => [h, "Previous HR"] as const)].map(([h, label]) => (
                    <tr key={h.id}>
                      <td><Link href={hLink(h.id)} className="font-medium text-navy hover:text-brand">{h.full_name}</Link><div className="text-[11px] text-muted">{h.hr_code}</div></td>
                      <td className="text-xs">{h.current_company ?? "—"}</td>
                      <td className="text-xs">{h.email ?? <span className="text-red-600">missing</span>}</td>
                      <td className="text-xs">{[h.assigned_to, h.alt_assigned_to].filter(Boolean).join(", ") || "—"}</td>
                      <td><Badge tone={label === "Current HR" ? "green" : "slate"}>{label}</Badge></td>
                    </tr>
                  ))}
                  {!current.length && !previous.length && <tr><td colSpan={5}><Empty>No HR on file for this company.</Empty></td></tr>}
                </tbody>
              </table>
            </Card>
            <Card title="Placement Excel recipient" bodyClass="p-3">
              <p className="mb-3 text-xs text-muted">Only a current HR with a verified official email receives the student sheet. Previous HRs stay reachable for references, never for submissions.</p>
              {recipients.map((h) => (
                <div key={h.id} className="mb-2 rounded-[5px] border border-emerald-200 bg-emerald-50 p-2.5">
                  <div className="text-[13px] font-medium text-navy">{h.full_name}</div>
                  <div className="text-xs text-emerald-800">{h.email}</div>
                </div>
              ))}
              {!recipients.length && <div className="rounded-[5px] border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">No current HR with a verified email — the sheet cannot be sent for this company.</div>}
            </Card>
          </div>

          <Card title={`MasterVLSI alumni working at ${q} (${v.alumni.length})`} bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Student</th><th>Role</th><th>Joined</th><th>Recruited through</th></tr></thead>
              <tbody>
                {v.alumni.map((a) => {
                  const s = c.students.find((x) => x.id === a.student_id);
                  return (
                    <tr key={a.id}>
                      <td><Link href={`/students/${a.student_id}`} className="font-medium text-navy hover:text-brand">{s?.full_name ?? a.student_id.slice(0, 8)}</Link></td>
                      <td className="text-xs">{a.role ?? "—"}</td>
                      <td className="text-xs">{fmtDate(a.doj)}</td>
                      <td className="text-xs">{a.hr_name ?? "—"}</td>
                    </tr>
                  );
                })}
                {!v.alumni.length && <tr><td colSpan={4}><Empty>No alumni placed here yet. They become references for future hiring.</Empty></td></tr>}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

/** §17 Feedback with the action taken and who owns it. */
export function feedback(c: HCtx) {
  const open = c.feedback.filter((f) => f.status !== "closed");
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Feedback records" value={c.feedback.length} />
        <Kpi label="Open actions" value={open.length} tone={open.length ? "amber" : undefined} />
        <Kpi label="Concerns" value={c.feedback.filter((f) => f.sentiment === "concern").length} tone="red" />
        <Kpi label="Positive" value={c.feedback.filter((f) => f.sentiment === "positive").length} tone="green" />
      </div>
      <Card title={`HR feedback and corrective action (${c.feedback.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Company</th><th>HR</th><th>Feedback</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th /></tr></thead>
          <tbody>
            {c.feedback.map((f) => (
              <tr key={f.id}>
                <td className="text-xs">{f.company ?? "—"}</td>
                <td className="text-xs"><HrOf c={c} id={f.hr_id} /></td>
                <td className="text-xs"><Badge tone={sentimentTone(f.sentiment)}>{SENTIMENTS.find(([k]) => k === f.sentiment)?.[1]}</Badge> {f.feedback}</td>
                <td className="text-xs">{f.action ?? "—"}</td>
                <td className="text-xs">{f.assigned_to ?? "—"}</td>
                <td className="text-xs">{fmtDate(f.due_on)}</td>
                <td><Badge tone={f.status === "closed" ? "green" : f.status === "in_progress" ? "blue" : "amber"}>{f.status === "in_progress" ? "In progress" : f.status === "closed" ? "Closed" : "Open"}</Badge></td>
                <td>{f.status !== "closed" && <form action={closeFeedbackAction.bind(null, f.id)}><input type="hidden" name="back" value="/hr-contacts?tab=feedback" /><button className="text-xs text-muted hover:text-brand">Close</button></form>}</td>
              </tr>
            ))}
            {!c.feedback.length && <tr><td colSpan={8}><Empty>No feedback recorded yet.</Empty></td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title="Record feedback" bodyClass="p-3">
        <form action={addFeedbackAction} className="grid gap-2 text-xs sm:grid-cols-3">
          <select name="hr_id" required aria-label="HR" className="input py-1.5">
            <option value="">HR…</option>
            {c.contacts.map((h) => <option key={h.id} value={h.id}>{h.full_name}{h.current_company ? ` — ${h.current_company}` : ""}</option>)}
          </select>
          <select name="drive_id" aria-label="Drive" className="input py-1.5"><option value="">Drive (optional)…</option>{c.drives.map((d) => <option key={d.id} value={d.id}>{d.company} — {fmtDate(d.drive_date)}</option>)}</select>
          <select name="sentiment" aria-label="Sentiment" className="input py-1.5">{SENTIMENTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <I name="feedback" required placeholder="What the HR said *" w="sm:col-span-2" />
          <I name="action" placeholder="Action to take" />
          <select name="assigned_to" aria-label="Owner" className="input py-1.5"><option value="">Owner…</option>{c.staff.filter((s) => s.active !== false).map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
          <I name="due_on" type="date" placeholder="Due" />
          <div><button className="btn-primary">Record feedback</button></div>
        </form>
      </Card>
    </div>
  );
}

/** §18 The staff-wise activity report over any period. */
export function reports(c: HCtx) {
  const period = typeof c.sp.period === "string" ? c.sp.period : "day";
  const pick = (k: string) => (typeof c.sp[k] === "string" ? (c.sp[k] as string) : "");
  const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const shiftDays = (n: number) => new Date(c.now - n * 86_400_000).toISOString().slice(0, 10);

  // Custom takes the two dates given; the named periods end today.
  let from = c.today, to = c.today;
  if (period === "week") from = shiftDays(6);
  else if (period === "month") from = shiftDays(29);
  else if (period === "year") from = shiftDays(364);
  else if (period === "custom") {
    from = valid(pick("from")) ? pick("from") : shiftDays(6);
    to = valid(pick("to")) ? pick("to") : c.today;
  } else if (valid(pick("date"))) { from = pick("date"); to = pick("date"); }
  if (from > to) [from, to] = [to, from];

  const rows = dailyReport(from, to, { contacts: c.contacts, calls: c.calls, acts: c.acts, reqs: c.reqs, drives: c.drives, tasks: c.tasks });
  const metrics: [string, keyof (typeof rows)[number]][] = [
    ["HRs allocated", "allocated"], ["HRs contacted", "contacted"], ["Connected", "connected"], ["Not connected", "not_connected"],
    ["New HR contacts", "new_hrs"], ["Follow-ups completed", "follow_ups"], ["Hiring requirements", "requirements"],
    ["Drives confirmed", "drives_confirmed"], ["Activities completed", "tasks_done"], ["Activities pending", "tasks_pending"],
  ];
  const periods: [string, string][] = [["day", "Today"], ["week", "Last 7 days"], ["month", "Last 30 days"], ["year", "Last year"], ["custom", "Custom"]];

  return (
    <div className="space-y-5">
      <Card title="Staff activity report" bodyClass="p-3">
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {periods.map(([k, l]) => (
            <Link key={k} href={`/hr-contacts?tab=reports&period=${k}`} className={`rounded-[5px] px-2.5 py-1.5 ${period === k ? "bg-brand text-white" : "bg-slate-50 text-navy hover:bg-slate-100"}`}>{l}</Link>
          ))}
        </div>
        {period === "custom" ? (
          <form className="flex flex-wrap items-center gap-2 text-xs">
            <input type="hidden" name="tab" value="reports" />
            <input type="hidden" name="period" value="custom" />
            <input type="date" name="from" defaultValue={from} aria-label="From" className="input w-auto py-1.5" />
            <span className="text-muted">to</span>
            <input type="date" name="to" defaultValue={to} aria-label="To" className="input w-auto py-1.5" />
            <Save label="Show" />
          </form>
        ) : (
          <form className="flex flex-wrap items-center gap-2 text-xs">
            <input type="hidden" name="tab" value="reports" />
            <input type="date" name="date" defaultValue={to} aria-label="Report date" className="input w-auto py-1.5" />
            <Save label="Show a single day" />
          </form>
        )}
      </Card>
      <Card title={from === to ? `Activity on ${fmtDate(from)}` : `Activity from ${fmtDate(from)} to ${fmtDate(to)}`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Activity</th>{rows.map((r) => <th key={r.staff} className="text-right">{r.staff}</th>)}<th className="text-right">Total</th></tr></thead>
          <tbody>
            {metrics.map(([label, key]) => {
              const total = rows.reduce((a, r) => a + Number(r[key]), 0);
              return (
                <tr key={label}>
                  <td className="text-xs">{label}</td>
                  {rows.map((r) => <td key={r.staff} className="text-right tabular-nums">{String(r[key])}</td>)}
                  <td className="text-right font-medium tabular-nums">{total}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={2}><Empty>No staff activity in this period.</Empty></td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
