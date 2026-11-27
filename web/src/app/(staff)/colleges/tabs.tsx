import Link from "next/link";
import type { ReactNode } from "react";
import { Kpi } from "@/components/student360";
import { Badge, Card, Empty } from "@/components/ui";
import { collegeReminders, matchCollege } from "@/lib/colleges";
import { fmtDate, inr, istDate, istDateTime } from "@/lib/format";
import {
  COLLEGE_ACTIVITY_KINDS,
  COLLEGE_STAGES,
  collegeStageLabel,
  OPPORTUNITY_KINDS,
  REFERENCE_TYPES,
  stageLabel,
  SUBMISSION_SOURCES,
  type CampusDrive,
  type College,
  type CollegeActivity,
  type CollegeDocument,
  type CollegeEvent,
  type CollegeFeedback,
  type CollegeFinance,
  type CollegeOpportunity,
  type CollegeReference,
  type CollegeSubmission,
  type Course,
  type Lead,
  type Letter,
  type Mou,
  type Staff,
  type StudentApplication,
  type StudentListItem,
  type TpoContact,
} from "@/lib/types";
import { deleteRowAction, saveRowAction } from "../crm-actions";
import { addCollegeLeadAction, allocateCollegesAction, collegeFollowUpAction, moveCollegeStageAction, rejectSubmissionAction, uploadCollegeDocAction, verifySubmissionAction } from "./actions";

export interface CCtx {
  sp: Record<string, string | string[] | undefined>;
  admin: boolean;
  me: string;
  now: number;
  today: string;
  colleges: College[];
  tpos: TpoContact[];
  mous: Mou[];
  drives: CampusDrive[];
  students: StudentListItem[];
  leads: Lead[];
  acts: CollegeActivity[];
  subs: CollegeSubmission[];
  refs: CollegeReference[];
  opps: CollegeOpportunity[];
  events: CollegeEvent[];
  feedback: CollegeFeedback[];
  finance: CollegeFinance[];
  docs: CollegeDocument[];
  staff: Staff[];
  courses: Course[];
  letters: Letter[];
  applications: StudentApplication[];
}

const stageOf = (c: College) => c.stage ?? (c.status === "partner" ? "mou_signed" : "new");
const isAlumni = (s: StudentListItem, today: string) => s.status === "completed" || s.status === "expired" || Boolean(s.validity_end && s.validity_end < today);
const isPlaced = (s: StudentListItem, apps: StudentApplication[]) => s.extra?.placement?.status === "Placed" || apps.some((a) => a.student_id === s.id && a.status === "placed");
const cLink = (id: string) => `/colleges?tab=colleges&id=${id}`;
const sel = (c: CCtx, name = "college_id", required = true) => (
  <select name={name} required={required} aria-label="College" className="input py-1.5" defaultValue={typeof c.sp.id === "string" ? c.sp.id : ""}>
    <option value="">College…</option>
    {c.colleges.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
  </select>
);
const staffFilter = (c: CCtx) => (typeof c.sp.staff === "string" ? c.sp.staff : "");

function CollegeName({ c, id }: { c: CCtx; id: string }) {
  const x = c.colleges.find((k) => k.id === id);
  return x ? <Link href={cLink(id)} className="font-medium text-navy hover:text-brand">{x.name}</Link> : <span className="text-muted">—</span>;
}

/** Stage-wise board of colleges with the allocated staff, target and reference network. */
function Pipeline({ c }: { c: CCtx }) {
  const who = staffFilter(c);
  const list = c.colleges.filter((x) => !who || x.assigned_to === who);
  return (
    <>
      <form className="mb-2 flex items-center gap-2 text-xs">
        <input type="hidden" name="tab" value={typeof c.sp.tab === "string" ? c.sp.tab : "dashboard"} />
        <select name="staff" defaultValue={who} aria-label="Staff" className="input w-auto py-1"><option value="">All Staff</option>{c.staff.filter((s) => s.active !== false).map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
        <button className="btn-ghost py-1">Show</button>
        <span className="text-muted">{list.length} colleges</span>
      </form>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1100px] grid-cols-6 gap-2">
          {COLLEGE_STAGES.map((s) => {
            const col = list.filter((x) => stageOf(x) === s.key);
            return (
              <div key={s.key} className={`rounded-[5px] border border-t-4 border-line bg-slate-100/70 ${s.bar}`}>
                <div className="flex justify-between px-2 py-1.5 text-[12px] font-semibold text-navy"><span>{s.label}</span><span>{col.length}</span></div>
                <div className="max-h-72 space-y-1.5 overflow-y-auto px-1.5 pb-1.5">
                  {col.map((x) => (
                    <Link key={x.id} href={cLink(x.id)} className="block rounded-[5px] border border-line bg-white p-2 text-[11px] hover:border-brand">
                      <div className="text-[13px] font-semibold text-navy">{x.name}</div>
                      <div className="text-muted">{x.assigned_to ?? <span className="text-amber-700">Unassigned</span>}</div>
                      <div>Target: {x.target_students ?? 0}</div>
                      <div className="text-emerald-700">Network: {c.refs.filter((r) => r.college_id === x.id).length}</div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          <Link href="/colleges?tab=incoming" className="rounded-[5px] border border-line bg-white p-2 text-[12px] hover:border-brand">
            <div className="font-semibold text-muted">New Data Verification</div>
            <div className="mt-1 text-2xl font-semibold text-navy">{c.subs.filter((x) => x.status === "pending").length}</div>
            <div className="text-muted">Review incoming data</div>
          </Link>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- 360 panel ----
/** Stage, allocation, follow-up and conversation history for one college (shown in the Colleges tab). */
export function College360({ c, x }: { c: CCtx; x: College }) {
  const acts = c.acts.filter((a) => a.college_id === x.id);
  const back = `/colleges?tab=colleges&id=${x.id}`;
  return (
    <Card title="College 360°" bodyClass="p-3 space-y-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="blue">{collegeStageLabel(stageOf(x))}</Badge>
        <span>Staff: <b>{x.assigned_to ?? "Unassigned"}</b></span>
        <span>Strength {x.student_strength ?? 0} · Target {x.target_students ?? 0} · Enrolled {c.students.filter((s) => s.college_id === x.id).length}</span>
        {x.next_follow_up && <span className={Date.parse(x.next_follow_up) < c.now ? "font-medium text-red-600" : "text-orange-700"}>Next: {istDateTime(x.next_follow_up)} — {x.follow_up_note}</span>}
      </div>
      <form action={collegeFollowUpAction.bind(null, x.id)} className="grid gap-2 rounded-[5px] border border-line bg-slate-50 p-2.5 text-xs sm:grid-cols-4">
        <input type="hidden" name="back" value={back} />
        <label className="text-muted">Activity<select name="kind" className="input mt-0.5 py-1">{COLLEGE_ACTIVITY_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="text-muted">Move to stage<select name="stage" defaultValue="" className="input mt-0.5 py-1"><option value="">(no change)</option>{COLLEGE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
        <label className="text-muted">Next date *<input name="next_date" type="date" min={c.today} className="input mt-0.5 py-1" /></label>
        <label className="text-muted">Time<input name="next_time" type="time" defaultValue="11:00" className="input mt-0.5 py-1" /></label>
        <label className="text-muted sm:col-span-2">Remarks *<textarea name="remarks" required minLength={5} rows={2} className="input mt-0.5" /></label>
        <label className="text-muted sm:col-span-2">Next action *<input name="next_action" placeholder="e.g. Send proposal to Dean" className="input mt-0.5 py-1" /></label>
        <button className="btn-primary py-1.5 sm:col-span-4">Save follow-up</button>
      </form>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted">Move stage directly</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COLLEGE_STAGES.filter((s) => s.key !== stageOf(x)).map((s) => (
            <form key={s.key} action={moveCollegeStageAction.bind(null, x.id, s.key)}><input type="hidden" name="back" value={back} /><button className="rounded-[5px] border border-line bg-white px-2 py-1 hover:bg-slate-50">Mark {s.label}</button></form>
          ))}
        </div>
      </details>
      {c.admin && (
        <form action={allocateCollegesAction} className="flex flex-wrap items-center gap-2 text-xs">
          <input type="hidden" name="ids" value={x.id} />
          <input type="hidden" name="back" value={back} />
          <select name="to" required aria-label="Allocate to" className="input w-auto py-1"><option value="">Allocate to…</option>{c.staff.filter((s) => s.active !== false).map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
          <button className="btn-navy px-2 py-1">{x.assigned_to ? "Reallocate" : "Allocate"}</button>
        </form>
      )}
      <div>
        <div className="mb-1 text-xs font-semibold text-navy">Conversation history ({acts.length})</div>
        <ul className="max-h-60 space-y-1.5 overflow-y-auto">
          {acts.map((a) => <li key={a.id} className="rounded border border-line px-2 py-1 text-xs"><div className="flex justify-between gap-2"><b className="capitalize">{a.kind}</b><span className="text-muted">{istDateTime(a.created_at)} · {a.by_name ?? "System"}</span></div>{a.summary}</li>)}
          {!acts.length && <li className="text-xs text-muted">No activity yet.</li>}
        </ul>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- views ----
function dashboard(c: CCtx) {
  const enrolled = c.students.filter((s) => s.college_id);
  const alumni = enrolled.filter((s) => isAlumni(s, c.today));
  const reminders = collegeReminders(c.colleges, c.tpos, c.mous, c.events, c.today, c.now);
  const k: [string, ReactNode, string, ("red" | "amber" | "green")?][] = [
    ["Total Colleges", c.colleges.length, "colleges"],
    ["Student Strength", c.colleges.reduce((a, x) => a + (x.student_strength ?? 0), 0).toLocaleString("en-IN"), "targets"],
    ["Target Students", c.colleges.reduce((a, x) => a + (x.target_students ?? 0), 0).toLocaleString("en-IN"), "targets"],
    ["Contacts", c.tpos.length, "contacts"],
    ["Numbers Available", c.tpos.filter((t) => t.phone).length, "contacts"],
    ["Numbers Missing", c.tpos.filter((t) => !t.phone).length, "contacts", "red"],
    ["Connected Contacts", c.tpos.filter((t) => t.call_status === "connected").length, "contacts", "green"],
    ["Incoming Leads", c.subs.filter((x) => x.status === "pending").length, "incoming", "amber"],
    ["Existing Students", enrolled.length - alumni.length, "students"],
    ["Total Alumni", alumni.length, "students"],
    ["Placed Alumni", alumni.filter((s) => isPlaced(s, c.applications)).length, "students", "green"],
    ["Reference Network", c.refs.length, "references"],
    ["MoUs", c.mous.filter((m) => m.status === "active").length, "mou"],
    ["Seminars", c.events.length, "seminars"],
    ["Admissions", enrolled.length, "admissions"],
    ["Pending Activities", reminders.length, "reminders", reminders.length ? "red" : undefined],
  ];
  const by = new Map<string, number>();
  for (const x of c.colleges) if (x.assigned_to) by.set(x.assigned_to, (by.get(x.assigned_to) ?? 0) + 1);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{k.map(([l, v, tab, tone]) => <Link key={l} href={`/colleges?tab=${tab}`}><Kpi label={l} value={v} tone={tone} /></Link>)}</div>
      <Card title="Complete College Pipeline" bodyClass="p-2"><Pipeline c={c} /></Card>
      <Card title="Staff Allocation" bodyClass="p-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[...by.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => <div key={n} className="rounded-[5px] border border-line p-3"><div className="text-xs text-muted">{n}</div><div className="text-2xl font-semibold text-navy">{v}</div><div className="text-[11px] text-muted">Allocated colleges</div></div>)}
          <div className="rounded-[5px] border border-dashed border-line p-3"><div className="text-xs text-muted">Unassigned</div><div className="text-2xl font-semibold text-amber-600">{c.colleges.filter((x) => !x.assigned_to).length}</div><Link href="/colleges?tab=colleges#allocate" className="text-[11px] text-brand underline">Allocate</Link></div>
        </div>
      </Card>
    </div>
  );
}

function pipeline(c: CCtx) {
  return <Pipeline c={c} />;
}

function students(c: CCtx) {
  const f = typeof c.sp.show === "string" ? c.sp.show : "all";
  const rows = c.students.filter((s) => s.college_id).filter((s) => {
    const alum = isAlumni(s, c.today);
    if (f === "active") return !alum;
    if (f === "alumni") return alum;
    if (f === "placed") return alum && isPlaced(s, c.applications);
    if (f === "not_placed") return alum && !isPlaced(s, c.applications);
    return true;
  });
  return (
    <Card title={`Students & Alumni (${rows.length})`} bodyClass="p-0 overflow-x-auto">
      <nav className="flex flex-wrap gap-1.5 border-b border-line p-2 text-xs">
        {[["all", "All"], ["active", "Active Students"], ["alumni", "All Alumni"], ["placed", "Placed Alumni"], ["not_placed", "Non-Placed Alumni"]].map(([k, l]) => <Link key={k} href={`/colleges?tab=students&show=${k}`} className={`rounded-full border px-2.5 py-1 ${k === f ? "border-navy bg-navy text-white" : "border-line"}`}>{l}</Link>)}
      </nav>
      <table className="table">
        <thead><tr><th>Student</th><th>College</th><th>Course</th><th>Status</th><th>Placement</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td><Link href={`/students/${s.id}`} className="font-medium text-navy hover:text-brand">{s.full_name}</Link><div className="font-mono text-[11px] text-muted">{s.enrollment_no}</div></td>
              <td><CollegeName c={c} id={s.college_id!} /></td>
              <td className="text-xs">{s.course_name ?? "—"}</td>
              <td>{isAlumni(s, c.today) ? <Badge tone="slate">Alumni</Badge> : <Badge tone="green">Active student</Badge>}</td>
              <td className="text-xs">{isPlaced(s, c.applications) ? <Badge tone="green">Placed{s.extra?.placement?.company ? ` · ${s.extra.placement.company}` : ""}</Badge> : "—"}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="text-center text-muted">No students in this view.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function references(c: CCtx) {
  const f = typeof c.sp.show === "string" ? c.sp.show : "all";
  const q = typeof c.sp.q === "string" ? c.sp.q.toLowerCase() : "";
  const rows = c.refs.filter((r) => (f === "all" || r.person_type === f) && (!q || [r.person_name, r.department, r.reference_to, c.colleges.find((x) => x.id === r.college_id)?.name].some((v) => v?.toLowerCase().includes(q))));
  return (
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <Card title={`All Colleges – References (${rows.length})`} bodyClass="p-0 overflow-x-auto">
        <nav className="flex flex-wrap gap-1.5 border-b border-line p-2 text-xs">
          {[["all", "All"], ...REFERENCE_TYPES].map(([k, l]) => <Link key={k} href={`/colleges?tab=references&show=${k}`} className={`rounded-full border px-2.5 py-1 ${k === f ? "border-navy bg-navy text-white" : "border-line"}`}>{l}</Link>)}
          <form className="ml-auto"><input type="hidden" name="tab" value="references" /><input name="q" defaultValue={q} placeholder="Search student, college, department" aria-label="Search references" className="input py-1 text-xs" /></form>
        </nav>
        <table className="table">
          <thead><tr><th>Person</th><th>College</th><th>Dept · batch</th><th>Reference to</th><th>Type</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.student_id ? <Link href={`/students/${r.student_id}`} className="text-navy hover:text-brand">{r.person_name}</Link> : r.person_name}<div className="text-[11px] text-muted">{r.phone}</div></td>
                <td><CollegeName c={c} id={r.college_id} /></td>
                <td className="text-xs">{[r.department, r.batch].filter(Boolean).join(" · ") || "—"}</td>
                <td className="text-xs text-emerald-700">{r.reference_to ?? "—"}</td>
                <td><Badge tone={r.person_type === "placed_alumni" ? "green" : r.person_type === "active_student" ? "blue" : "slate"}>{REFERENCE_TYPES.find(([k]) => k === r.person_type)?.[1]}</Badge></td>
                <td><form action={deleteRowAction.bind(null, "college_references", r.id)}><button className="text-[11px] text-muted hover:text-red-600">Remove</button></form></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="text-center text-muted">No references.</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title="Add a reference" bodyClass="p-3">
        <form action={saveRowAction.bind(null, "college_references")} className="grid gap-2 text-xs">
          {sel(c)}
          <select name="student_id" aria-label="Student (optional)" className="input py-1.5"><option value="">Not a registered student</option>{c.students.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.enrollment_no}</option>)}</select>
          <input name="person_name" required placeholder="Person's name *" aria-label="Person's name" className="input py-1.5" />
          <div className="grid grid-cols-2 gap-2">
            <select name="person_type" aria-label="Type" className="input py-1.5">{REFERENCE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select name="reference_to" aria-label="Reference to" className="input py-1.5"><option>TPO</option><option>HOD</option><option>Principal</option><option>Faculty</option><option>Classmates</option></select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input name="department" placeholder="Dept" aria-label="Department" className="input py-1.5" />
            <input name="batch" placeholder="Batch" aria-label="Batch" className="input py-1.5" />
            <input name="phone" placeholder="Mobile" aria-label="Mobile" className="input py-1.5" />
          </div>
          <button className="btn-primary">Add reference</button>
        </form>
      </Card>
    </div>
  );
}

function incoming(c: CCtx) {
  const pending = c.subs.filter((s) => s.status === "pending");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3"><Kpi label="Received" value={c.subs.length} /><Kpi label="Pending" value={pending.length} tone={pending.length ? "amber" : undefined} /><Kpi label="Verified" value={c.subs.filter((s) => s.status === "verified").length} tone="green" /></div>
      <Card title="Automatic College Data Collection" actions={<Link href="/college-register" target="_blank" className="text-xs underline">Public registration link ↗</Link>} bodyClass="p-3">
        <ul className="space-y-3">
          {pending.map((s) => {
            const m = matchCollege(c.colleges, s.college_name, s.city);
            return (
              <li key={s.id} className="rounded-[5px] border border-line p-3 text-[13px]">
                <div className="font-semibold text-navy">{s.college_name} <Badge tone="amber">Pending</Badge></div>
                <div className="text-xs text-muted">{[s.city, s.state].filter(Boolean).join(", ")} · Source: {SUBMISSION_SOURCES[s.source] ?? s.source}{s.submitted_by ? ` — ${s.submitted_by}` : ""} · {fmtDate(s.created_at)}</div>
                <div className="text-xs">Contact: <b>{s.contact_name ?? "—"}</b>{s.designation ? ` · ${s.designation}` : ""}{s.department ? ` – ${s.department}` : ""} · {s.phone ?? s.email ?? "—"}</div>
                <div className="mt-1 text-xs text-muted">{m ? <>Existing college found: <b>{m.name}</b> — merge contact</> : "New college — create master record"}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <form action={verifySubmissionAction.bind(null, s.id)} className="flex items-center gap-1">
                    <select name="college_id" defaultValue={m?.id ?? "__new"} aria-label="Merge into" className="input w-auto py-1 text-xs"><option value="__new">Create new college</option>{c.colleges.map((x) => <option key={x.id} value={x.id}>Merge into {x.name}</option>)}</select>
                    <button className="btn bg-navy px-2.5 py-1 text-xs text-white">Verify &amp; Merge</button>
                  </form>
                  <form action={rejectSubmissionAction.bind(null, s.id)} className="flex items-center gap-1"><input name="note" placeholder="Reason" aria-label="Reject reason" className="input w-32 py-1 text-xs" /><button className="btn-ghost py-1 text-xs">Reject</button></form>
                </div>
              </li>
            );
          })}
          {!pending.length && <Empty>No incoming data waiting for verification.</Empty>}
        </ul>
      </Card>
      <Card title="Processed" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>College</th><th>Contact</th><th>Source</th><th>Result</th><th>By</th></tr></thead>
          <tbody>{c.subs.filter((s) => s.status !== "pending").slice(0, 30).map((s) => <tr key={s.id}><td>{s.college_id ? <CollegeName c={c} id={s.college_id} /> : s.college_name}</td><td className="text-xs">{s.contact_name}</td><td className="text-xs">{SUBMISSION_SOURCES[s.source] ?? s.source}</td><td><Badge tone={s.status === "verified" ? "green" : "red"}>{s.status}</Badge>{s.note && <div className="text-[11px] text-muted">{s.note}</div>}</td><td className="text-xs">{s.decided_by}</td></tr>)}</tbody>
        </table>
      </Card>
    </div>
  );
}

function targets(c: CCtx) {
  return (
    <Card title="Student Strength & Target Planning" bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>College</th><th>Staff</th><th>Strength</th><th>Target</th><th className="text-right">Students</th><th className="text-right">Alumni</th><th className="text-right">Achieved</th><th>Update</th></tr></thead>
        <tbody>
          {c.colleges.map((x) => {
            const st = c.students.filter((s) => s.college_id === x.id);
            const achieved = x.target_students ? Math.round((st.length / x.target_students) * 1000) / 10 : 0;
            return (
              <tr key={x.id}>
                <td><CollegeName c={c} id={x.id} /><div className="text-[11px] text-muted">{x.city}</div></td>
                <td className="text-xs">{x.assigned_to ?? "—"}</td>
                <td className="tabular-nums">{(x.student_strength ?? 0).toLocaleString("en-IN")}</td>
                <td className="tabular-nums">{(x.target_students ?? 0).toLocaleString("en-IN")}</td>
                <td className="text-right tabular-nums">{st.filter((s) => !isAlumni(s, c.today)).length}</td>
                <td className="text-right tabular-nums">{st.filter((s) => isAlumni(s, c.today)).length}</td>
                <td className="text-right tabular-nums">{achieved}%</td>
                <td>
                  <form action={saveRowAction.bind(null, "colleges")} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="name" value={x.name} />
                    {(["code", "city", "state", "affiliation", "college_type", "since", "status", "departments", "website"] as const).map((k) => <input key={k} type="hidden" name={k} value={(x[k] as string) ?? ""} />)}
                    <input name="student_strength" type="number" min={0} defaultValue={x.student_strength ?? 0} aria-label="Strength" className="input w-20 py-1 text-xs" />
                    <input name="target_students" type="number" min={0} defaultValue={x.target_students ?? 0} aria-label="Target" className="input w-20 py-1 text-xs" />
                    <button className="btn-navy px-2 py-1 text-xs">Save</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function opportunities(c: CCtx) {
  const tone = { open: "blue", proposed: "amber", won: "green", lost: "red" } as const;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Open" value={c.opps.filter((o) => o.status === "open" || o.status === "proposed").length} />
        <Kpi label="Won" value={c.opps.filter((o) => o.status === "won").length} tone="green" />
        <Kpi label="Students covered" value={c.opps.filter((o) => o.status !== "lost").reduce((a, o) => a + o.students, 0)} />
        <Kpi label="Pipeline value" value={inr(c.opps.filter((o) => o.status !== "lost").reduce((a, o) => a + Number(o.value), 0))} />
      </div>
      <Card title="Opportunities" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>College</th><th>Opportunity</th><th className="text-right">Students</th><th className="text-right">Value</th><th>Expected</th><th>Owner</th><th>Status</th></tr></thead>
          <tbody>
            {c.opps.map((o) => (
              <tr key={o.id}>
                <td><CollegeName c={c} id={o.college_id} /></td>
                <td><div className="font-medium">{o.title}</div><div className="text-[11px] text-muted">{o.kind}</div></td>
                <td className="text-right">{o.students}</td>
                <td className="text-right">{inr(Number(o.value))}</td>
                <td className="text-xs">{fmtDate(o.expected_date)}</td>
                <td className="text-xs">{o.owner ?? "—"}</td>
                <td>
                  <form action={saveRowAction.bind(null, "college_opportunities")} className="flex items-center gap-1">
                    {(["college_id", "kind", "title", "expected_date", "owner", "notes"] as const).map((k) => <input key={k} type="hidden" name={k} value={(o[k] as string) ?? ""} />)}
                    <input type="hidden" name="id" value={o.id} /><input type="hidden" name="students" value={o.students} /><input type="hidden" name="value" value={o.value} />
                    <select name="status" defaultValue={o.status} aria-label="Status" className="input w-auto py-1 text-xs">{Object.keys(tone).map((s) => <option key={s}>{s}</option>)}</select>
                    <button className="text-[11px] text-navy underline">Save</button>
                  </form>
                  <Badge tone={tone[o.status]}>{o.status}</Badge>
                </td>
              </tr>
            ))}
            {!c.opps.length && <tr><td colSpan={7} className="text-center text-muted">No opportunities yet.</td></tr>}
          </tbody>
        </table>
        <form action={saveRowAction.bind(null, "college_opportunities")} className="grid gap-2 border-t border-line p-3 text-xs sm:grid-cols-4 lg:grid-cols-8">
          {sel(c)}
          <select name="kind" aria-label="Kind" className="input py-1.5">{OPPORTUNITY_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          <input name="title" required placeholder="Opportunity *" aria-label="Opportunity" className="input py-1.5 lg:col-span-2" />
          <input name="students" type="number" min={0} placeholder="Students" aria-label="Students" className="input py-1.5" />
          <input name="value" type="number" min={0} placeholder="Value ₹" aria-label="Value" className="input py-1.5" />
          <input name="expected_date" type="date" aria-label="Expected date" className="input py-1.5" />
          <input type="hidden" name="status" value="open" /><input type="hidden" name="owner" value={c.me} />
          <button className="btn-primary py-1.5">+ Add opportunity</button>
        </form>
      </Card>
    </div>
  );
}

function seminars(c: CCtx) {
  return (
    <Card title={`Seminars & workshops (${c.events.length})`} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Date</th><th>College</th><th>Event</th><th>Speaker</th><th className="text-right">Attendees</th><th className="text-right">Leads</th><th>Status</th></tr></thead>
        <tbody>
          {c.events.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap">{fmtDate(e.event_date)}</td>
              <td><CollegeName c={c} id={e.college_id} /></td>
              <td><div className="font-medium">{e.title}</div><div className="text-[11px] capitalize text-muted">{e.kind}</div></td>
              <td className="text-xs">{e.speaker ?? "—"}</td>
              <td className="text-right">{e.attendees}</td>
              <td className="text-right">{e.leads_generated}</td>
              <td>
                <form action={saveRowAction.bind(null, "college_events")} className="flex flex-wrap items-center gap-1">
                  {(["college_id", "kind", "title", "event_date", "speaker", "notes"] as const).map((k) => <input key={k} type="hidden" name={k} value={(e[k] as string) ?? ""} />)}
                  <input type="hidden" name="id" value={e.id} />
                  <input name="attendees" type="number" min={0} defaultValue={e.attendees} aria-label="Attendees" className="input w-16 py-1 text-xs" />
                  <input name="leads_generated" type="number" min={0} defaultValue={e.leads_generated} aria-label="Leads generated" className="input w-14 py-1 text-xs" />
                  <select name="status" defaultValue={e.status} aria-label="Status" className="input w-auto py-1 text-xs"><option value="planned">Planned</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select>
                  <button className="text-[11px] text-navy underline">Save</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={saveRowAction.bind(null, "college_events")} className="grid gap-2 border-t border-line p-3 text-xs sm:grid-cols-3 lg:grid-cols-7">
        {sel(c)}
        <select name="kind" aria-label="Kind" className="input py-1.5"><option value="seminar">Seminar</option><option value="workshop">Workshop</option><option value="fdp">Faculty development</option><option value="webinar">Webinar</option></select>
        <input name="title" required placeholder="Title *" aria-label="Title" className="input py-1.5 lg:col-span-2" />
        <input name="event_date" type="date" aria-label="Date" className="input py-1.5" />
        <input name="speaker" placeholder="Speaker" aria-label="Speaker" className="input py-1.5" />
        <input type="hidden" name="status" value="planned" />
        <button className="btn-primary py-1.5">+ Plan event</button>
      </form>
    </Card>
  );
}

function studentLeads(c: CCtx) {
  const rows = c.leads.filter((l) => l.college_id);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <Card title={`Student leads from colleges (${rows.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Student</th><th>College</th><th>Stage</th><th>Counsellor</th><th>Added</th></tr></thead>
          <tbody>
            {rows.map((l) => <tr key={l.id}><td><Link href={`/leads?id=${l.id}`} className="font-medium text-navy hover:text-brand">{l.full_name}</Link><div className="text-[11px] text-muted">{l.phone}</div></td><td><CollegeName c={c} id={l.college_id!} /></td><td className="text-xs">{stageLabel(l.stage)}</td><td className="text-xs">{l.assigned_to ?? "—"}</td><td className="text-xs">{fmtDate(l.created_at)}</td></tr>)}
            {!rows.length && <tr><td colSpan={5} className="text-center text-muted">No student leads from colleges yet.</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title="Add a student lead from a college" bodyClass="p-3">
        <form action={addCollegeLeadAction} className="grid gap-2 text-xs">
          {sel(c)}
          <input name="full_name" required placeholder="Student name *" aria-label="Student name" className="input py-1.5" />
          <div className="grid grid-cols-2 gap-2"><input name="phone" required placeholder="Mobile *" aria-label="Mobile" className="input py-1.5" /><input name="email" type="email" placeholder="Email" aria-label="Email" className="input py-1.5" /></div>
          <div className="grid grid-cols-2 gap-2">
            <select name="course_code" aria-label="Course" className="input py-1.5"><option value="">Course?</option>{c.courses.map((x) => <option key={x.id}>{x.code}</option>)}</select>
            <select name="assigned_to" aria-label="Counsellor" className="input py-1.5"><option value="">Unassigned</option>{c.staff.filter((s) => s.active !== false).map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
          </div>
          <input name="remarks" placeholder="Remarks (e.g. from seminar)" aria-label="Remarks" className="input py-1.5" />
          <button className="btn-primary">Add to Lead Management</button>
        </form>
      </Card>
    </div>
  );
}

function admissions(c: CCtx) {
  return (
    <Card title="College-wise admissions" bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>College</th><th className="text-right">Student leads</th><th className="text-right">Converted</th><th className="text-right">Admissions</th><th className="text-right">Fee collected</th><th className="text-right">Balance</th></tr></thead>
        <tbody>
          {c.colleges.map((x) => {
            const st = c.students.filter((s) => s.college_id === x.id);
            const ls = c.leads.filter((l) => l.college_id === x.id);
            return <tr key={x.id}><td><CollegeName c={c} id={x.id} /></td><td className="text-right">{ls.length}</td><td className="text-right">{ls.filter((l) => l.stage === "enrolled").length}</td><td className="text-right">{st.length}</td><td className="text-right">{inr(st.reduce((a, s) => a + Number(s.paid), 0))}</td><td className="text-right">{inr(st.reduce((a, s) => a + Number(s.balance), 0))}</td></tr>;
          })}
        </tbody>
      </table>
    </Card>
  );
}

function training(c: CCtx) {
  return (
    <Card title="Training by college" bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>College</th><th className="text-right">In training</th><th className="text-right">Completed</th><th className="text-right">On hold</th><th>Courses</th></tr></thead>
        <tbody>
          {c.colleges.map((x) => {
            const st = c.students.filter((s) => s.college_id === x.id);
            const courses = [...new Set(st.map((s) => s.course_name).filter(Boolean))].join(", ");
            return <tr key={x.id}><td><CollegeName c={c} id={x.id} /></td><td className="text-right">{st.filter((s) => s.status === "active").length}</td><td className="text-right">{st.filter((s) => s.status === "completed").length}</td><td className="text-right">{st.filter((s) => s.status === "on_hold").length}</td><td className="text-xs">{courses || "—"}</td></tr>;
          })}
        </tbody>
      </table>
    </Card>
  );
}

function attendance(c: CCtx) {
  return (
    <Card title="Attendance by college (last 30 days)" bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>College</th><th className="text-right">Active students</th><th className="text-right">Average attendance</th><th className="text-right">Below 60%</th></tr></thead>
        <tbody>
          {c.colleges.map((x) => {
            const st = c.students.filter((s) => s.college_id === x.id && s.status === "active");
            const avg = st.length ? Math.round(st.reduce((a, s) => a + s.attendance_pct, 0) / st.length) : 0;
            return <tr key={x.id}><td><CollegeName c={c} id={x.id} /></td><td className="text-right">{st.length}</td><td className="text-right">{st.length ? `${avg}%` : "—"}</td><td className="text-right">{st.filter((s) => s.attendance_pct < 60).length}</td></tr>;
          })}
        </tbody>
      </table>
    </Card>
  );
}

function internships(c: CCtx) {
  const ids = new Set(c.students.filter((s) => s.college_id).map((s) => s.id));
  const rows = c.letters.filter((l) => l.student_id && ids.has(l.student_id) && (l.template === "internship_offer" || l.template === "internship_completion"));
  return (
    <Card title={`Internships for college students (${rows.length})`} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Student</th><th>College</th><th>Letter</th><th>Serial</th><th>Issued</th></tr></thead>
        <tbody>
          {rows.map((l) => { const s = c.students.find((x) => x.id === l.student_id)!; return <tr key={l.id}><td><Link href={`/students/${s.id}`} className="font-medium text-navy">{s.full_name}</Link></td><td><CollegeName c={c} id={s.college_id!} /></td><td className="text-xs">{l.template === "internship_offer" ? "Internship offer" : "Internship completion"}</td><td className="font-mono text-xs">{l.serial_no}</td><td className="text-xs">{fmtDate(l.issued_at)}</td></tr>; })}
          {!rows.length && <tr><td colSpan={5} className="text-center text-muted">No internship letters issued to college students yet. <Link href="/documents" className="underline">Issue one</Link>.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function finance(c: CCtx) {
  return (
    <Card title="College finance" bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>College</th><th className="text-right">Invoiced</th><th className="text-right">Received</th><th className="text-right">Outstanding</th></tr></thead>
        <tbody>
          {c.colleges.filter((x) => c.finance.some((f) => f.college_id === x.id)).map((x) => {
            const inv = c.finance.filter((f) => f.college_id === x.id && f.kind === "invoice").reduce((a, f) => a + Number(f.amount), 0);
            const rec = c.finance.filter((f) => f.college_id === x.id && f.kind === "payment").reduce((a, f) => a + Number(f.amount), 0);
            return <tr key={x.id}><td><CollegeName c={c} id={x.id} /></td><td className="text-right">{inr(inv)}</td><td className="text-right">{inr(rec)}</td><td className={`text-right ${inv - rec > 0 ? "font-medium text-red-600" : ""}`}>{inr(inv - rec)}</td></tr>;
          })}
        </tbody>
      </table>
      <div className="border-t border-line p-3 text-xs font-semibold text-navy">Entries</div>
      <table className="table">
        <thead><tr><th>Date</th><th>College</th><th>Description</th><th>Type</th><th className="text-right">Amount</th><th>Reference</th></tr></thead>
        <tbody>{c.finance.map((f) => <tr key={f.id}><td className="text-xs">{fmtDate(f.paid_on ?? f.due_date ?? f.created_at)}</td><td><CollegeName c={c} id={f.college_id} /></td><td className="text-xs">{f.description}</td><td><Badge tone={f.kind === "payment" ? "green" : "blue"}>{f.kind}</Badge></td><td className="text-right">{inr(Number(f.amount))}</td><td className="text-xs">{f.reference ?? "—"}</td></tr>)}</tbody>
      </table>
      {c.admin && (
        <form action={saveRowAction.bind(null, "college_finance")} className="grid gap-2 border-t border-line p-3 text-xs sm:grid-cols-4 lg:grid-cols-8">
          {sel(c)}
          <input name="description" required placeholder="Description *" aria-label="Description" className="input py-1.5 lg:col-span-2" />
          <select name="kind" aria-label="Type" className="input py-1.5"><option value="invoice">Invoice</option><option value="payment">Payment received</option></select>
          <input name="amount" type="number" min={1} required placeholder="Amount ₹ *" aria-label="Amount" className="input py-1.5" />
          <input name="due_date" type="date" aria-label="Due date" className="input py-1.5" />
          <input name="reference" placeholder="Reference" aria-label="Reference" className="input py-1.5" />
          <button className="btn-primary py-1.5">+ Add entry</button>
        </form>
      )}
    </Card>
  );
}

function documents(c: CCtx) {
  return (
    <Card title={`College documents (${c.docs.length})`} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>College</th><th>Document</th><th>Type</th><th>Added</th><th /></tr></thead>
        <tbody>
          {c.docs.map((d) => <tr key={d.id}><td><CollegeName c={c} id={d.college_id} /></td><td className="font-medium">{d.title}</td><td className="text-xs capitalize">{d.kind}</td><td className="text-xs">{fmtDate(d.created_at)} · {d.uploaded_by}</td><td><a href={`/api/college-docs/${d.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand underline">Open</a></td></tr>)}
          {!c.docs.length && <tr><td colSpan={5} className="text-center text-muted">No documents yet.</td></tr>}
        </tbody>
      </table>
      <form action={uploadCollegeDocAction} className="grid gap-2 border-t border-line p-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
        {sel(c)}
        <input name="title" required placeholder="Title *" aria-label="Title" className="input py-1.5" />
        <select name="kind" aria-label="Type" className="input py-1.5"><option value="mou">MoU</option><option value="proposal">Proposal</option><option value="brochure">Brochure</option><option value="invoice">Invoice</option><option value="other">Other</option></select>
        <input name="file" type="file" aria-label="File" className="input py-1" />
        <input name="url" type="url" placeholder="…or https:// link" aria-label="Link" className="input py-1.5" />
        <button className="btn-primary py-1.5">Save document</button>
      </form>
    </Card>
  );
}

function staffReports(c: CCtx) {
  const week = new Date(c.now - 7 * 86_400_000).toISOString();
  const names = [...new Set([...c.staff.filter((s) => s.active !== false).map((s) => s.full_name), ...c.colleges.map((x) => x.assigned_to).filter(Boolean)])] as string[];
  return (
    <Card title="Staff reports — college relations" bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Staff</th><th className="text-right">Colleges</th><th className="text-right">Activities (7 days)</th><th className="text-right">Today</th><th className="text-right">Meetings</th><th className="text-right">Proposals</th><th className="text-right">MoUs signed</th><th className="text-right">Overdue follow-ups</th></tr></thead>
        <tbody>
          {names.map((n) => {
            const mine = c.colleges.filter((x) => x.assigned_to === n);
            const acts = c.acts.filter((a) => a.by_name === n);
            if (!mine.length && !acts.length) return null;
            return (
              <tr key={n}>
                <td className="font-medium">{n}</td>
                <td className="text-right">{mine.length}</td>
                <td className="text-right">{acts.filter((a) => a.created_at >= week).length}</td>
                <td className="text-right">{acts.filter((a) => istDate(a.created_at) === c.today).length}</td>
                <td className="text-right">{mine.filter((x) => ["meeting_scheduled", "meeting_completed"].includes(stageOf(x))).length}</td>
                <td className="text-right">{mine.filter((x) => stageOf(x) === "proposal_sent").length}</td>
                <td className="text-right">{mine.filter((x) => stageOf(x) === "mou_signed").length}</td>
                <td className="text-right">{mine.filter((x) => x.next_follow_up && Date.parse(x.next_follow_up) < c.now).length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function reminders(c: CCtx) {
  const list = collegeReminders(c.colleges, c.tpos, c.mous, c.events, c.today, c.now).filter((r) => c.admin || r.owner === c.me);
  return (
    <Card title={`Reminders (${list.length})`} bodyClass="p-3">
      {list.length ? (
        <ul className="space-y-1.5">
          {list.map((r) => <li key={r.key} className={`flex justify-between gap-2 rounded-r-[5px] border-l-4 px-2 py-1.5 text-[13px] ${r.tone === "red" ? "border-red-600 bg-red-50" : r.tone === "amber" ? "border-amber-500 bg-amber-50" : "border-sky-600 bg-sky-50"}`}><Link href={cLink(r.college_id)} className="hover:underline">{r.title}</Link><span className="shrink-0 text-xs text-muted">{r.when.length > 10 ? istDateTime(r.when) : fmtDate(r.when)} · {r.owner ?? "—"}</span></li>)}
        </ul>
      ) : <Empty>No pending college activities.</Empty>}
    </Card>
  );
}

function feedback(c: CCtx) {
  const avg = c.feedback.length ? (c.feedback.reduce((a, f) => a + f.rating, 0) / c.feedback.length).toFixed(1) : "—";
  return (
    <Card title={`College feedback · average ${avg} / 5`} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Date</th><th>College</th><th>Given by</th><th>Rating</th><th>Comments</th></tr></thead>
        <tbody>{c.feedback.map((f) => <tr key={f.id}><td className="text-xs">{fmtDate(f.on_date)}</td><td><CollegeName c={c} id={f.college_id} /></td><td className="text-xs">{f.given_by ?? "—"}</td><td className="text-amber-500">{"★".repeat(f.rating)}<span className="text-slate-300">{"★".repeat(5 - f.rating)}</span></td><td className="text-xs">{f.comments}</td></tr>)}</tbody>
      </table>
      <form action={saveRowAction.bind(null, "college_feedback")} className="grid gap-2 border-t border-line p-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
        {sel(c)}
        <input name="given_by" placeholder="Given by (TPO / HOD)" aria-label="Given by" className="input py-1.5" />
        <select name="rating" aria-label="Rating" className="input py-1.5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select>
        <input name="comments" placeholder="Comments" aria-label="Comments" className="input py-1.5 lg:col-span-2" />
        <input type="hidden" name="on_date" value={c.today} />
        <button className="btn-primary py-1.5">+ Add feedback</button>
      </form>
    </Card>
  );
}

function settings() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Public college registration" bodyClass="p-4 text-sm">
        <p>Share this link with colleges, or put it on the website. Entries arrive under <Link href="/colleges?tab=incoming" className="underline">Incoming Leads</Link> for verification before anything is added.</p>
        <div className="mt-2 rounded-[5px] border border-line bg-slate-50 px-3 py-2 font-mono text-xs">/college-register</div>
        <p className="mt-2 text-xs text-muted">Students and alumni can also share their college&apos;s TPO / HOD contact from the student portal (Requests &amp; Support).</p>
      </Card>
      <Card title="Pipeline stages" bodyClass="p-4">
        <ol className="list-decimal space-y-0.5 pl-5 text-[13px]">{COLLEGE_STAGES.map((s) => <li key={s.key}>{s.label}</li>)}</ol>
        <p className="mt-2 text-xs text-muted">Moving a college to “MoU Signed” marks it as a partner college. Allocate colleges to staff from the Colleges tab; staff log every call and meeting with remarks and a next action.</p>
      </Card>
    </div>
  );
}

export const COLLEGE_TABS: Record<string, (c: CCtx) => ReactNode> = {
  dashboard, pipeline, students, references, incoming, targets, opportunities, seminars, "student-leads": studentLeads, admissions, training, attendance, internships, finance, documents, "staff-reports": staffReports, reminders, feedback, settings,
};
