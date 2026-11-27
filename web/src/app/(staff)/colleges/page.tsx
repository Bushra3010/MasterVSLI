import { FileText, Mail, MessageCircle, Phone, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { I, Save } from "@/components/form-bits";
import { Badge, Card, Empty, Field, PageHeader, Stat } from "@/components/ui";
import { daysBetween, fmtDate, todayISO } from "@/lib/format";
import { waNumber } from "@/lib/messaging";
import { getRepo } from "@/lib/server";
import { nowMs } from "@/lib/calendar";
import { createCollegeRepo } from "@/lib/colleges";
import { getStore, isAdmin, requireStaff } from "@/lib/session";
import type { CampusDrive, College, CollegeDocument, CollegeEvent, CollegeFeedback, CollegeFinance, CollegeOpportunity, CollegeReference, CollegeSubmission, Lead, Letter, Mou, StudentApplication, TpoContact, TpoInteraction } from "@/lib/types";
import { College360, COLLEGE_TABS, type CCtx } from "./tabs";
import { collegeStageLabel } from "@/lib/types";
import { allocateCollegesAction, setContactStatusAction } from "./actions";
import { CollegeLoginButton } from "./college-login";
import { Flash } from "@/components/student360";
import { deleteRowAction, saveRowAction, uploadMouAction } from "../crm-actions";

export const metadata = { title: "College management" };

const TABS: [string, string][] = [
  ["dashboard", "Dashboard"], ["colleges", "Colleges"], ["pipeline", "Pipeline"], ["contacts", "Contacts"], ["students", "Students & Alumni"], ["references", "References"],
  ["incoming", "Incoming Leads"], ["targets", "Target Planning"], ["opportunities", "Opportunities"], ["mou", "MoU"], ["seminars", "Seminars"], ["student-leads", "Student Leads"],
  ["admissions", "Admissions"], ["training", "Training"], ["attendance", "Attendance"], ["internships", "Internships"], ["placements", "Placements"], ["finance", "Finance"],
  ["documents", "Documents"], ["portal", "College Portal"], ["staff-reports", "Staff Reports"], ["reminders", "Reminders"], ["feedback", "Feedback"], ["settings", "Settings"],
];
/** Older links used these tab names. */
const ALIAS: Record<string, string> = { master: "colleges", tpo: "contacts", drives: "placements" };
const mouTone = (s: string, end?: string | null) => {
  if (s === "expired" || (end && end < todayISO())) return ["red", "Expired"] as const;
  if (s === "active" && end && daysBetween(todayISO(), end) <= 90) return ["amber", "Expiring"] as const;
  return [s === "active" ? "green" : "slate", s[0].toUpperCase() + s.slice(1)] as const;
};
const driveTone = (s: string) => (s === "completed" ? "green" : s === "ongoing" ? "blue" : s === "upcoming" ? "amber" : "slate") as "green" | "blue" | "amber" | "slate";

export default async function CollegesPage({ searchParams }: PageProps<"/colleges">) {
  const sp = await searchParams;
  const raw = typeof sp.tab === "string" ? ALIAS[sp.tab] ?? sp.tab : "dashboard";
  const tab = TABS.some(([k]) => k === raw) ? raw : "dashboard";
  const session = await requireStaff();
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const repo = await getRepo();
  const interactions = await repo.list<TpoInteraction>("tpo_interactions", { order: { column: "on_date", ascending: false } });
  const [colleges, tpos, mous, drives, students] = await Promise.all([
    repo.list<College>("colleges", { order: { column: "name" } }),
    repo.list<TpoContact>("tpo_contacts", { order: { column: "name" } }),
    repo.list<Mou>("mous", { order: { column: "start_date", ascending: false } }),
    repo.list<CampusDrive>("campus_drives", { order: { column: "drive_date", ascending: false } }),
    repo.students({ status: "all" }),
  ]);
  const db = await getStore();
  const me = (await repo.staffForUser(session.userId, session.email))?.full_name ?? session.name;
  const [acts, subs, refs, opps, events, feedback, finance, docs, staff, courses, leads, letters, applications] = await Promise.all([
    createCollegeRepo(db).activities(),
    db.select<CollegeSubmission>("college_submissions", { order: { column: "created_at", ascending: false } }),
    db.select<CollegeReference>("college_references", { order: { column: "created_at", ascending: false } }),
    db.select<CollegeOpportunity>("college_opportunities", { order: { column: "created_at", ascending: false } }),
    db.select<CollegeEvent>("college_events", { order: { column: "event_date", ascending: false } }),
    db.select<CollegeFeedback>("college_feedback", { order: { column: "on_date", ascending: false } }),
    db.select<CollegeFinance>("college_finance", { order: { column: "created_at", ascending: false } }),
    db.select<CollegeDocument>("college_documents", { order: { column: "created_at", ascending: false } }),
    repo.staff(),
    repo.courses(),
    db.select<Lead>("leads", { order: { column: "created_at", ascending: false } }),
    db.select<Letter>("issued_letters"),
    db.select<StudentApplication>("student_applications"),
  ]);
  const ctx: CCtx = {
    sp, admin: isAdmin(session), me, now: nowMs(), today: todayISO(), colleges, tpos, mous, drives, students, leads: leads.filter((l) => !l.archived),
    acts, subs, refs, opps, events, feedback, finance, docs, staff, courses, letters, applications,
  };
  const cname = new Map(colleges.map((c) => [c.id, c.name]));
  const sel = colleges.find((c) => c.id === sp.id) ?? colleges[0];
  const studentsOf = (id: string) => students.filter((s) => s.college_id === id);
  const collegeSel = (v?: string) => (
    <select name="college_id" defaultValue={v ?? sel?.id} required aria-label="College" className="input w-auto py-1.5">
      {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );

  return (
    <>
      <PageHeader title="College Management 360°" subtitle="Colleges, pipeline, contacts, students & alumni, references, incoming data, targets, MoUs, seminars, admissions, placements and staff reports in one place." />
      <Flash sp={sp} />
      <nav className="mb-4 grid grid-cols-2 gap-1 rounded-[5px] border border-line bg-white p-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8" aria-label="College management sections">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/colleges?tab=${k}`} className={`rounded-[5px] px-2.5 py-1.5 text-[13px] ${tab === k ? "bg-brand font-medium text-white" : "bg-slate-50 text-navy hover:bg-slate-100"}`}>{l}</Link>
        ))}
      </nav>
      {COLLEGE_TABS[tab] && COLLEGE_TABS[tab](ctx)}

      {tab === "colleges" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card title={`College Master (${colleges.length})`} bodyClass="p-0 overflow-x-auto">
            <form className="flex gap-2 border-b border-line p-3"><input type="hidden" name="tab" value="master" /><input name="q" defaultValue={q} placeholder="Search college (name / location / code)" aria-label="Search colleges" className="input" /></form>
            <table className="table">
              <thead><tr><th>#</th><th>College</th><th>Location</th><th>Stage</th><th>Staff</th><th>MoU</th><th>Students</th><th>Status</th></tr></thead>
              <tbody>
                {colleges.filter((c) => !q || [c.name, c.city, c.code].some((v) => v?.toLowerCase().includes(q))).map((c, k) => {
                  const m = mous.find((x) => x.college_id === c.id);
                  const [tone, label] = m ? mouTone(m.status, m.end_date) : (["slate", "None"] as const);
                  return (
                    <tr key={c.id} className={c.id === sel?.id ? "bg-orange-50" : ""}>
                      <td>{k + 1}</td>
                      <td><Link href={`/colleges?tab=master&id=${c.id}`} className="font-medium text-navy hover:text-brand">{c.name}</Link></td>
                      <td>{[c.city, c.state].filter(Boolean).join(", ")}</td>
                      <td className="text-xs">{collegeStageLabel(c.stage ?? (c.status === "partner" ? "mou_signed" : "new"))}</td>
                      <td className="text-xs">{c.assigned_to ?? <span className="text-amber-700">—</span>}</td>
                      <td><Badge tone={tone}>{label}</Badge></td>
                      <td>{studentsOf(c.id).length}</td>
                      <td><Badge tone={c.status === "partner" ? "green" : "slate"}>{c.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {ctx.admin && (
              <details id="allocate" className="border-t border-line p-3">
                <summary className="cursor-pointer text-sm font-medium text-brand">Allocate colleges to staff</summary>
                <form action={allocateCollegesAction} className="mt-2 space-y-2 text-xs">
                  <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto">{colleges.map((c) => <label key={c.id} className="flex items-center gap-1.5"><input type="checkbox" name="ids" value={c.id} defaultChecked={!c.assigned_to} /> {c.name} <span className="text-muted">({c.assigned_to ?? "unassigned"})</span></label>)}</div>
                  <div className="flex gap-2"><select name="to" required aria-label="Staff" className="input py-1.5"><option value="">Allocate to…</option>{staff.filter((x) => x.active !== false).map((x) => <option key={x.id}>{x.full_name}</option>)}</select><button className="btn-primary">Allocate</button></div>
                </form>
              </details>
            )}
            <details className="border-t border-line p-3">
              <summary className="cursor-pointer text-sm font-medium text-brand"><Plus size={14} className="inline" /> Add college</summary>
              <CollegeForm />
            </details>
          </Card>

          {sel && (
            <section className="space-y-4 rounded-[5px] border-2 border-orange-300 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-navy">{sel.name}</h2>
                  <div className="text-sm text-muted">{[sel.city, sel.state].filter(Boolean).join(", ")}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge tone={sel.status === "partner" ? "green" : "slate"}>{sel.status === "partner" ? "Partner college" : sel.status}</Badge>
                    <span className="rounded-[5px] border border-line px-2 py-0.5">Code {sel.code ?? "—"}</span>
                    <span className="rounded-[5px] border border-line px-2 py-0.5">{sel.affiliation ?? "—"}</span>
                    <span className="rounded-[5px] border border-line px-2 py-0.5">{sel.college_type ?? "—"}</span>
                    <span className="rounded-[5px] border border-line px-2 py-0.5">Since {fmtDate(sel.since)}</span>
                  </div>
                </div>
                <details><summary className="btn-ghost cursor-pointer text-xs">Edit college</summary><div className="mt-2 w-80"><CollegeForm c={sel} /></div></details>
              </div>
              <College360 c={ctx} x={sel} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="College Summary">
                  <dl>
                    <Field label="Students (registered)" value={studentsOf(sel.id).length} />
                    <Field label="Students in training" value={studentsOf(sel.id).filter((s) => s.status === "active").length} />
                    <Field label="Students completed" value={studentsOf(sel.id).filter((s) => s.status === "completed").length} />
                    <Field label="Placements (through us)" value={drives.filter((d) => d.college_id === sel.id).reduce((a, d) => a + d.selected, 0)} />
                    <Field label="Campus drives conducted" value={drives.filter((d) => d.college_id === sel.id && d.status === "completed").length} />
                  </dl>
                </Card>
                <Card title="MoU / Agreement Details">
                  {mous.filter((m) => m.college_id === sel.id).slice(0, 1).map((m) => {
                    const [tone, label] = mouTone(m.status, m.end_date);
                    return (
                      <dl key={m.id}>
                        <Field label="MoU status" value={<Badge tone={tone}>{label}</Badge>} />
                        <Field label="MoU no." value={m.mou_no} />
                        <Field label="Start / end" value={`${fmtDate(m.start_date)} → ${fmtDate(m.end_date)}`} />
                        <Field label="Agreement type" value={m.agreement_type} />
                        <Field label="Renewal due in" value={m.end_date ? `${daysBetween(todayISO(), m.end_date)} days` : "—"} />
                      </dl>
                    );
                  })}
                  {!mous.some((m) => m.college_id === sel.id) && <Empty>No MoU yet. <Link href={`/colleges?tab=mou&id=${sel.id}`} className="text-brand hover:underline">Create one</Link>.</Empty>}
                </Card>
                <Card title={`TPO Contacts (${tpos.filter((t) => t.college_id === sel.id).length})`} actions={<Link href={`/colleges?tab=tpo&id=${sel.id}`} className="text-xs text-brand">+ Add TPO Contact</Link>}>
                  <ul className="space-y-3">{tpos.filter((t) => t.college_id === sel.id).map((t) => <TpoRow key={t.id} t={t} />)}</ul>
                </Card>
                <Card title="Recent & Upcoming Campus Drives" actions={<Link href={`/colleges?tab=drives&id=${sel.id}`} className="text-xs text-brand">+ Add Campus Drive</Link>}>
                  <ul className="space-y-2 text-[13px]">
                    {drives.filter((d) => d.college_id === sel.id).map((d) => (
                      <li key={d.id} className="flex justify-between gap-2"><span>{d.company} – {d.job_role}</span><span className="text-muted">{fmtDate(d.drive_date)}</span></li>
                    ))}
                  </ul>
                </Card>
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "contacts" && (
        <Card title={`TPO Contacts (${tpos.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>#</th><th>Contact</th><th>Designation · dept</th><th>College</th><th>Phone</th><th>Email</th><th>Call status</th><th>Next follow-up</th><th>Status</th><th /></tr></thead>
            <tbody>
              {tpos.map((t, k) => (
                <tr key={t.id}>
                  <td>{k + 1}</td>
                  <td className="font-medium">{t.name}{t.is_primary && <Badge tone="green">Primary</Badge>}</td>
                  <td className="text-xs">{t.designation}{t.department ? ` · ${t.department}` : ""}</td>
                  <td>{cname.get(t.college_id)}</td>
                  <td>{t.phone ?? <Badge tone="red">Missing</Badge>}</td>
                  <td className="text-xs">{t.email}</td>
                  <td className="whitespace-nowrap text-xs">
                    <Badge tone={t.call_status === "connected" ? "green" : t.call_status === "non_connected" ? "red" : "slate"}>{t.call_status === "connected" ? "Connected" : t.call_status === "non_connected" ? "Not connected" : "Not called"}</Badge>
                    <div className="mt-1 flex gap-1">
                      <form action={setContactStatusAction.bind(null, t.id, "connected")}><button className="rounded border border-emerald-300 px-1.5 text-[11px] text-emerald-700">Connected</button></form>
                      <form action={setContactStatusAction.bind(null, t.id, "non_connected")}><button className="rounded border border-red-200 px-1.5 text-[11px] text-red-700">No answer</button></form>
                    </div>
                  </td>
                  <td className="text-xs">{t.next_follow_up ? fmtDate(t.next_follow_up) : "—"}</td>
                  <td><Badge tone={t.active ? "green" : "slate"}>{t.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="whitespace-nowrap">
                    <Link href={`/colleges?tab=tpo&tpo=${t.id}`} className="text-xs text-brand hover:underline">History ({interactions.filter((i) => i.tpo_id === t.id).length})</Link>
                    {" · "}<CollegeLoginButton tpoId={t.id} />
                    {" · "}<form action={deleteRowAction.bind(null, "tpo_contacts", t.id)} className="inline"><button className="text-xs text-muted hover:text-brand">Delete</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={saveRowAction.bind(null, "tpo_contacts")} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
            {collegeSel()}
            <I name="name" required placeholder="TPO name" w="w-40" />
            <I name="designation" placeholder="Designation" w="w-44" />
            <I name="department" placeholder="Department" w="w-28" />
            <I name="phone" placeholder="Phone" w="w-32" />
            <I name="email" type="email" placeholder="Email" w="w-44" />
            <I name="next_follow_up" type="date" placeholder="Next follow-up" w="w-36" />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_primary" /> Primary</label>
            <input type="hidden" name="active" value="on" />
            <Save label="+ Add TPO Contact" />
          </form>
        </Card>
      )}

      {tab === "contacts" && (() => {
        const t = tpos.find((x) => x.id === sp.tpo) ?? tpos[0];
        if (!t) return null;
        const hist = interactions.filter((i) => i.tpo_id === t.id);
        return (
          <Card title={`Interaction history – ${t.name} (${cname.get(t.college_id)})`} className="mt-5" bodyClass="p-0 overflow-x-auto">
            <form action={saveRowAction.bind(null, "tpo_interactions")} className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <input type="hidden" name="tpo_id" value={t.id} />
              <I name="on_date" type="date" value={todayISO()} placeholder="Date" w="w-36" />
              <select name="mode" aria-label="Mode" className="input w-auto py-1.5"><option value="call">Call</option><option value="visit">Campus visit</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="meeting">Meeting</option></select>
              <I name="summary" required placeholder="What was discussed?" w="min-w-56 flex-1" />
              <I name="next_follow_up" type="date" placeholder="Next follow-up" w="w-36" />
              <Save label="+ Log interaction" />
            </form>
            <table className="table">
              <thead><tr><th>Date</th><th>Mode</th><th>Summary</th><th>Next follow-up</th><th>By</th></tr></thead>
              <tbody>
                {hist.map((h) => <tr key={h.id}><td className="whitespace-nowrap">{fmtDate(h.on_date)}</td><td className="capitalize">{h.mode}</td><td className="text-sm">{h.summary}</td><td>{fmtDate(h.next_follow_up)}</td><td className="text-xs">{h.by_name ?? "—"}</td></tr>)}
                {!hist.length && <tr><td colSpan={5} className="text-center text-muted">No interactions logged yet.</td></tr>}
              </tbody>
            </table>
          </Card>
        );
      })()}

      {tab === "mou" && (
        <Card title="MoU & Agreement List" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>#</th><th>College</th><th>Agreement type</th><th>MoU no.</th><th>Start</th><th>End</th><th>Status</th><th>Document</th><th /></tr></thead>
            <tbody>
              {mous.map((m, k) => {
                const [tone, label] = mouTone(m.status, m.end_date);
                return (
                  <tr key={m.id}>
                    <td>{k + 1}</td><td className="font-medium">{cname.get(m.college_id)}</td><td className="text-xs">{m.agreement_type}</td><td className="font-mono text-xs">{m.mou_no}</td>
                    <td>{fmtDate(m.start_date)}</td><td>{fmtDate(m.end_date)}</td><td><Badge tone={tone}>{label}</Badge></td>
                    <td className="whitespace-nowrap">
                      {m.document_path ? <a href={`/api/mou/${m.id}`} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline"><FileText size={12} className="inline" /> Signed copy</a> : m.document_url ? <a href={m.document_url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline"><FileText size={12} className="inline" /> Link</a> : null}
                      <form action={uploadMouAction.bind(null, m.id)} className="mt-1 flex items-center gap-1">
                        <input type="file" name="file" required accept=".pdf,image/*,.doc,.docx" aria-label="Signed MoU file" className="w-36 text-[10px]" />
                        <button className="text-[11px] text-brand hover:underline">Upload</button>
                      </form>
                    </td>
                    <td><form action={deleteRowAction.bind(null, "mous", m.id)}><button className="text-xs text-muted hover:text-brand">Delete</button></form></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <form action={saveRowAction.bind(null, "mous")} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
            {collegeSel()}
            <I name="mou_no" placeholder="MoU no." w="w-32" />
            <select name="agreement_type" aria-label="Agreement type" className="input w-auto py-1.5"><option>MoU (Training + Placement)</option><option>MoU (Training)</option><option>MoU (Training + Internship)</option><option>Agreement (Campus Drive)</option><option>Agreement (Internship)</option><option>MoU (CoE + Training)</option></select>
            <I name="start_date" type="date" placeholder="Start" w="w-36" />
            <I name="end_date" type="date" placeholder="End" w="w-36" />
            <select name="status" aria-label="Status" className="input w-auto py-1.5"><option value="draft">Draft</option><option value="review">Internal review</option><option value="shared">Shared with college</option><option value="active">Signed & active</option></select>
            <I name="document_url" placeholder="Signed copy link (optional)" w="w-52" />
            <I name="scope" placeholder="Scope of collaboration" w="min-w-48 flex-1" />
            <Save label="+ Create MoU" />
          </form>
          <div className="flex flex-wrap items-center gap-2 border-t border-line p-3 text-xs text-muted">
            Lifecycle: <Badge>Draft</Badge>→<Badge>Internal review</Badge>→<Badge>Shared with college</Badge>→<Badge tone="green">Signed &amp; active</Badge>→<Badge tone="amber">Renew before expiry</Badge>
            <span className="ml-auto">Renewal alerts are raised 90 days before the end date (Alerts &amp; Escalation).</span>
          </div>
        </Card>
      )}

      {tab === "placements" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Stat label="Total drives" value={drives.length} />
            <Stat label="Completed" value={drives.filter((d) => d.status === "completed").length} tone="green" />
            <Stat label="Ongoing" value={drives.filter((d) => d.status === "ongoing").length} tone="blue" />
            <Stat label="Upcoming" value={drives.filter((d) => d.status === "upcoming").length} tone="amber" />
            <Stat label="Registered" value={drives.reduce((a, d) => a + d.registered, 0)} />
            <Stat label="Shortlisted" value={drives.reduce((a, d) => a + d.shortlisted, 0)} tone="blue" />
            <Stat label="Selected" value={drives.reduce((a, d) => a + d.selected, 0)} tone="green" icon={<Trophy size={16} />} />
            <Stat label="Selection rate" value={`${Math.round((100 * drives.reduce((a, d) => a + d.selected, 0)) / Math.max(1, drives.reduce((a, d) => a + d.attended, 0)))}%`} tone="red" />
          </div>
          <Card title="Campus Drive Management" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Drive / company</th><th>College</th><th>Date</th><th>Mode</th><th>Registered</th><th>Attended</th><th>Shortlisted</th><th>Selected</th><th>Status / update</th></tr></thead>
              <tbody>
                {drives.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.company} – {d.job_role}<div className="text-[11px] text-muted">{d.package} · {d.eligibility}</div></td>
                    <td>{cname.get(d.college_id)}</td>
                    <td>{fmtDate(d.drive_date)}</td>
                    <td><Badge tone="blue">{d.mode}</Badge></td>
                    <td colSpan={5}>
                      <form action={saveRowAction.bind(null, "campus_drives")} className="flex flex-wrap items-center gap-1">
                        {(["id", "college_id", "company", "job_role", "drive_date", "mode", "eligibility", "package"] as const).map((k) => <input key={k} type="hidden" name={k} value={(d[k] as string) ?? ""} />)}
                        {(["registered", "attended", "shortlisted", "selected"] as const).map((k) => <input key={k} name={k} type="number" min={0} defaultValue={d[k]} aria-label={k} className="input w-16 py-1" />)}
                        <select name="status" defaultValue={d.status} aria-label="Status" className="input w-auto py-1"><option value="upcoming">Upcoming</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
                        <button className="btn-navy py-1 text-xs">Save</button>
                        <Badge tone={driveTone(d.status)}>{d.status}</Badge>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={saveRowAction.bind(null, "campus_drives")} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
              {collegeSel()}
              <I name="company" required placeholder="Company" w="w-36" />
              <I name="job_role" placeholder="Job role" w="w-44" />
              <I name="drive_date" type="date" placeholder="Date" w="w-36" />
              <select name="mode" aria-label="Mode" className="input w-auto py-1.5"><option value="onsite">Onsite</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select>
              <I name="package" placeholder="Package" w="w-28" />
              <I name="eligibility" placeholder="Eligibility" w="min-w-40 flex-1" />
              <input type="hidden" name="status" value="upcoming" />
              <Save label="+ Create Campus Drive" />
            </form>
          </Card>
        </>
      )}

      {tab === "portal" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="College Student Portal">
            <p className="mb-3 text-sm text-muted">Each college&apos;s students sign in to the same student portal (training progress, assessments, drives, certificates). Below is the live per-college report you can share with the TPO.</p>
            <ul className="space-y-2 text-sm">
              {["Student registration & profile", "Assigned training & learning progress", "Video completion & assessments (marks)", "Register for campus drives & internships", "Placement applications & interview updates", "Certificates, offer letters & documents"].map((f) => <li key={f} className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" /> {f}</li>)}
            </ul>
          </Card>
          <Card title="College-wise report" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>College</th><th>Registered</th><th>In training</th><th>Completed</th><th>Selected (drives)</th></tr></thead>
              <tbody>
                {colleges.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td>{studentsOf(c.id).length}</td>
                    <td>{studentsOf(c.id).filter((s) => s.status === "active").length}</td>
                    <td>{studentsOf(c.id).filter((s) => s.status === "completed").length}</td>
                    <td>{drives.filter((d) => d.college_id === c.id).reduce((a, d) => a + d.selected, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}

function TpoRow({ t }: { t: TpoContact }): ReactNode {
  const wa = waNumber(t.phone);
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-full bg-navy-soft text-xs font-medium text-brand">{t.name.split(/\s+/).filter((w) => !w.endsWith(".")).map((w) => w[0]).slice(0, 2).join("")}</span>
      <div className="min-w-0 flex-1 text-[13px]">
        <div className="font-medium text-navy">{t.name} {t.is_primary && <Badge tone="green">Primary</Badge>}</div>
        <div className="text-[11px] text-muted">{t.designation}</div>
      </div>
      <div className="flex gap-1 text-muted">
        {t.phone && <a href={`tel:${t.phone}`} aria-label="Call" className="rounded border border-line p-1 hover:text-brand"><Phone size={13} /></a>}
        {t.email && <a href={`mailto:${t.email}`} aria-label="Email" className="rounded border border-line p-1 hover:text-brand"><Mail size={13} /></a>}
        {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="rounded border border-line p-1 text-emerald-600"><MessageCircle size={13} /></a>}
      </div>
    </li>
  );
}

function CollegeForm({ c }: { c?: College }) {
  const f = (k: keyof College) => (c?.[k] as string) ?? "";
  return (
    <form action={saveRowAction.bind(null, "colleges")} className="mt-2 grid grid-cols-2 gap-2 text-xs">
      {c && <input type="hidden" name="id" value={c.id} />}
      {([["name", "College name *"], ["code", "Code"], ["city", "City"], ["state", "State"], ["affiliation", "Affiliation"], ["college_type", "Type"]] as const).map(([k, l]) => (
        <label key={k} className="text-muted">{l}<input name={k} defaultValue={f(k)} required={k === "name"} className="input mt-0.5 py-1.5" /></label>
      ))}
      <label className="text-muted">Partner since<input name="since" type="date" defaultValue={f("since")} className="input mt-0.5 py-1.5" /></label>
      <label className="text-muted">Status<select name="status" defaultValue={c?.status ?? "partner"} className="input mt-0.5 py-1.5"><option value="partner">Partner</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option></select></label>
      <button className="btn-primary col-span-2">{c ? "Save college" : "Add college"}</button>
    </form>
  );
}
