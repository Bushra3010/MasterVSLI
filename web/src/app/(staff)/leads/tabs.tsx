import Link from "next/link";
import type { ReactNode } from "react";
import { Kpi } from "@/components/student360";
import { Badge, Card, Empty } from "@/components/ui";
import { addDays, fmtDate, istDate, istDateTime } from "@/lib/format";
import type { LeadRepo } from "@/lib/leads";
import {
  LEAD_STAGES,
  OPEN_STAGES,
  PRIORITY_TONE,
  stageLabel,
  type Course,
  type DailyLeadReport,
  type Lead,
  type LeadActivity,
  type LeadAllocation,
  type LeadSettings,
  type LeadTask,
  type Staff,
  type StudentListItem,
} from "@/lib/types";
import { allocateAction, bulkUploadAction, completeTaskAction, generateReportAction, mergeDuplicateAction, restoreLeadAction, saveCounsellorAction, saveLeadSettingsAction } from "./actions";
import { AllocationFields, LeadCard, pct, SOURCES, srcTone } from "./parts";

export interface Ctx {
  sp: Record<string, string | string[] | undefined>;
  admin: boolean;
  me: string;
  now: number;
  today: string;
  leads: Lead[];
  allLeads: Lead[];
  archived: Lead[];
  acts: LeadActivity[];
  tasks: LeadTask[];
  allocs: LeadAllocation[];
  staff: Staff[];
  counsellors: Staff[];
  students: StudentListItem[];
  courses: Course[];
  settings: LeadSettings;
  lr: LeadRepo;
  linkTo: (id: string) => string;
}

const isOpen = (l: Lead) => OPEN_STAGES.includes(l.stage);
const due = (t: LeadTask, now: number) => t.status === "pending" && t.due_at && Date.parse(t.due_at) < now;
const name = (c: Ctx, id: string) => c.allLeads.find((l) => l.id === id);

function LeadLink({ c, id }: { c: Ctx; id: string }) {
  const l = name(c, id);
  return l ? <Link href={c.linkTo(l.id)} className="font-medium text-navy hover:text-brand">{l.full_name}<div className="text-[11px] font-normal text-muted">{l.phone}</div></Link> : <span className="text-muted">—</span>;
}

function Pipeline({ c, leads }: { c: Ctx; leads: Lead[] }) {
  return (
    <div className="overflow-x-auto pb-2" data-testid="pipeline">
      <div className="grid min-w-[1100px] grid-cols-5 gap-2">
        {LEAD_STAGES.map((s) => {
          const col = leads.filter((l) => l.stage === s.key);
          return (
            <div key={s.key} className={`flex flex-col rounded-[5px] border border-t-4 border-line bg-slate-100/70 ${s.bar}`}>
              <div className={`px-2 py-1.5 text-[13px] font-semibold ${s.head}`}>{s.label} ({col.length})</div>
              <div className="max-h-[340px] flex-1 space-y-2 overflow-y-auto px-1.5 pb-1.5">
                {col.map((l) => <LeadCard key={l.id} l={l} href={c.linkTo(l.id)} now={c.now} />)}
                {!col.length && <p className="p-1 text-[11px] text-muted">No leads.</p>}
              </div>
              {c.admin && <Link href={`/leads?tab=allocation&stage=${s.key}#stage`} className="m-1.5 rounded-[5px] border border-line bg-white px-2 py-1 text-center text-[11px] font-medium text-navy hover:bg-slate-50">Allocate stage</Link>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportTable({ r }: { r: DailyLeadReport }) {
  const cols = ["allocated", "attended", "pending", "connected", "non_connected", "interested", "scheduled", "visited", "converted"] as const;
  const head = ["Allocated", "Attended", "Pending", "Connected", "Non-connected", "Interested", "Scheduled", "Visited", "Converted"];
  return (
    <table className="table">
      <thead><tr><th>Counsellor</th>{head.map((h) => <th key={h} className="text-right">{h}</th>)}</tr></thead>
      <tbody>
        {r.rows.map((x) => <tr key={x.name}><td className="font-medium">{x.name}</td>{cols.map((k) => <td key={k} className="text-right tabular-nums">{x[k]}</td>)}</tr>)}
        <tr className="bg-slate-50 font-semibold"><td>Total</td>{cols.map((k) => <td key={k} className="text-right tabular-nums">{r.total[k]}</td>)}</tr>
      </tbody>
    </table>
  );
}

function ReportKpis({ r }: { r: DailyLeadReport }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Kpi label="Allocated" value={r.total.allocated} />
      <Kpi label="Attended" value={r.total.attended} />
      <Kpi label="Connected" value={r.total.connected} tone="green" />
      <Kpi label="Non-connected" value={r.total.non_connected} tone="red" />
      <Kpi label="Interested" value={r.total.interested} />
      <Kpi label="Visit scheduled" value={r.total.scheduled} />
      <Kpi label="Visited" value={r.total.visited} />
      <Kpi label="Converted" value={r.total.converted} tone="green" />
    </div>
  );
}

// ---------------------------------------------------------------- views ----
async function dashboard(c: Ctx) {
  const dup = c.admin ? (await c.lr.duplicateGroups()).length : 0;
  const myTasks = c.admin ? c.tasks : c.tasks.filter((t) => t.assigned_to === c.me);
  const todayF = myTasks.filter((t) => t.status === "pending" && t.due_at && istDate(t.due_at) === c.today).length;
  const overdue = myTasks.filter((t) => due(t, c.now)).length;
  const r = await c.lr.dailyReport(c.today);
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Link href="/leads?tab=all"><Kpi label="Total leads" value={c.leads.length} /></Link>
        <Link href="/leads?tab=allocation#unassigned"><Kpi label="Unassigned" value={c.leads.filter((l) => !l.assigned_to && isOpen(l)).length} tone="amber" /></Link>
        <Link href="/leads?tab=followups"><Kpi label="Today follow-ups" value={todayF} /></Link>
        <Link href="/leads?tab=followups"><Kpi label="Overdue" value={overdue} tone={overdue ? "red" : undefined} /></Link>
        {c.admin && <Link href="/leads?tab=duplicates"><Kpi label="Duplicates" value={dup} tone={dup ? "amber" : undefined} /></Link>}
        <Link href="/leads?tab=admissions"><Kpi label="Converted" value={c.leads.filter((l) => l.stage === "enrolled").length} tone="green" /></Link>
      </div>
      <Card title="Complete Lead Pipeline" className="mb-5" bodyClass="p-2"><Pipeline c={c} leads={c.leads} /></Card>
      <Card title={`Today's lead activity — ${fmtDate(c.today)}`} actions={<Link href="/leads?tab=report" className="text-xs underline">Daily report →</Link>} bodyClass="p-0 overflow-x-auto">
        <ReportTable r={r} />
        <div className="border-t border-line px-3 py-2 text-sm">Daily allocated lead completion: <b>{r.completion}%</b></div>
      </Card>
    </>
  );
}

function all(c: Ctx) {
  const q = typeof c.sp.q === "string" ? c.sp.q.trim().toLowerCase() : "";
  const f = (k: string) => (typeof c.sp[k] === "string" ? (c.sp[k] as string) : "");
  const shown = c.leads.filter(
    (l) =>
      (!f("source") || l.source === f("source")) &&
      (!f("stage") || l.stage === f("stage")) &&
      (!f("counsellor") || (f("counsellor") === "__none" ? !l.assigned_to : l.assigned_to === f("counsellor"))) &&
      (!q || [l.full_name, l.phone, l.email, l.lead_no].some((v) => v?.toLowerCase().includes(q))),
  );
  const rows = (
    <table className="table">
      <thead><tr>{c.admin && <th className="w-8" />}<th>Lead ID</th><th>Name</th><th>Source</th><th>Course</th><th>Stage</th><th>Counsellor</th><th>Priority</th><th>Next follow-up</th><th>Added</th></tr></thead>
      <tbody>
        {shown.map((l) => (
          <tr key={l.id}>
            {c.admin && <td><input type="checkbox" name="ids" value={l.id} aria-label={`Select ${l.full_name}`} /></td>}
            <td className="font-mono text-xs">{l.lead_no}</td>
            <td><Link href={c.linkTo(l.id)} className="font-medium text-navy hover:text-brand">{l.full_name}</Link><div className="text-[11px] text-muted">{l.phone}</div></td>
            <td><Badge tone={srcTone(l.source)}>{l.source}</Badge></td>
            <td>{l.course_code ?? "—"}</td>
            <td>{stageLabel(l.stage)}</td>
            <td>{l.assigned_to ?? <span className="text-amber-700">Unassigned</span>}</td>
            <td>{l.priority && l.priority !== "normal" ? <Badge tone={PRIORITY_TONE[l.priority]}>{l.priority}</Badge> : "—"}</td>
            <td className="whitespace-nowrap text-xs">{l.next_follow_up ? istDateTime(l.next_follow_up) : "—"}</td>
            <td className="whitespace-nowrap">{fmtDate(l.created_at)}</td>
          </tr>
        ))}
        {!shown.length && <tr><td colSpan={10} className="text-center text-muted">No leads match.</td></tr>}
      </tbody>
    </table>
  );
  return (
    <>
      <form className="mb-3 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="all" />
        <input name="q" defaultValue={q} placeholder="Search name / mobile / email / lead ID" aria-label="Search leads" className="input max-w-xs" />
        <select name="stage" defaultValue={f("stage")} aria-label="Stage" className="input w-auto"><option value="">All stages</option>{LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        <select name="source" defaultValue={f("source")} aria-label="Source" className="input w-auto"><option value="">All sources</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        {c.admin && <select name="counsellor" defaultValue={f("counsellor")} aria-label="Counsellor" className="input w-auto"><option value="">All counsellors</option><option value="__none">Unassigned</option>{c.counsellors.map((s) => <option key={s.id}>{s.full_name}</option>)}</select>}
        <button className="btn-ghost">Filter</button>
        <span className="self-center text-xs text-muted">{shown.length} lead{shown.length === 1 ? "" : "s"}</span>
      </form>
      {c.admin ? (
        <form action={allocateAction}>
          <input type="hidden" name="mode" value="bulk" />
          <Card className="mb-3" bodyClass="p-3"><div className="mb-2 text-xs font-semibold text-navy">Bulk allocation — tick leads below</div><AllocationFields counsellors={c.counsellors} /><button className="btn-primary mt-2">Allocate selected</button></Card>
          <Card bodyClass="p-0 overflow-x-auto">{rows}</Card>
        </form>
      ) : <Card bodyClass="p-0 overflow-x-auto">{rows}</Card>}
    </>
  );
}

function pipeline(c: Ctx) {
  return <Pipeline c={c} leads={c.leads} />;
}

function allocation(c: Ctx) {
  const unassigned = c.leads.filter((l) => !l.assigned_to && isOpen(l));
  const stage = typeof c.sp.stage === "string" ? c.sp.stage : "lead";
  const open = c.leads.filter(isOpen);
  const load = (n: string) => c.tasks.filter((t) => t.assigned_to === n && t.status === "pending").length;
  return (
    <div className="space-y-5">
      <Card title="Counsellor load" bodyClass="p-3">
        <div className="flex flex-wrap gap-2">
          {c.counsellors.map((s) => {
            const n = load(s.full_name);
            const cap = s.lead_capacity ?? 30;
            return <div key={s.id} className="rounded-[5px] border border-line px-3 py-2 text-xs"><b className="text-navy">{s.full_name}</b> · {n} open tasks / capacity {cap}{n >= cap && <Badge tone="red">Full</Badge>}</div>;
          })}
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Individual allocation / reallocation" bodyClass="p-3">
          <form action={allocateAction} className="space-y-2">
            <input type="hidden" name="mode" value="individual" />
            <label className="block text-[11px] text-muted">Lead
              <select name="ids" required className="input mt-0.5 py-1.5">
                <option value="">Choose a lead…</option>
                {open.map((l) => <option key={l.id} value={l.id}>{l.full_name} · {l.phone} · {stageLabel(l.stage)} · {l.assigned_to ?? "Unassigned"}</option>)}
              </select>
            </label>
            <AllocationFields counsellors={c.counsellors} roundRobin={false} compact />
            <button className="btn-primary w-full">Allocate lead</button>
          </form>
        </Card>
        <Card title="Allocate entire pipeline stage" bodyClass="p-3">
          <form id="stage" action={allocateAction} className="space-y-2">
            <input type="hidden" name="mode" value="stage" />
            <label className="block text-[11px] text-muted">Stage
              <select name="stage" defaultValue={stage} className="input mt-0.5 py-1.5">{LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label} ({c.leads.filter((l) => l.stage === s.key).length})</option>)}</select>
            </label>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="only_unassigned" defaultChecked /> Only leads not yet allocated</label>
            <AllocationFields counsellors={c.counsellors} compact />
            <button className="btn-primary w-full">Allocate stage</button>
          </form>
        </Card>
      </div>
      <form id="unassigned" action={allocateAction}>
        <input type="hidden" name="mode" value="bulk" />
        <Card title={`Unassigned leads (${unassigned.length})`} bodyClass="p-0 overflow-x-auto">
          <div className="border-b border-line p-3"><AllocationFields counsellors={c.counsellors} /><button className="btn-primary mt-2">Allocate selected</button></div>
          <table className="table">
            <thead><tr><th className="w-8" /><th>Lead</th><th>Source</th><th>Stage</th><th>Added</th></tr></thead>
            <tbody>
              {unassigned.map((l) => (
                <tr key={l.id}><td><input type="checkbox" name="ids" value={l.id} defaultChecked aria-label={`Select ${l.full_name}`} /></td><td><LeadLink c={c} id={l.id} /></td><td>{l.source}</td><td>{stageLabel(l.stage)}</td><td>{fmtDate(l.created_at)}</td></tr>
              ))}
              {!unassigned.length && <tr><td colSpan={5} className="text-center text-muted">Every open lead is allocated.</td></tr>}
            </tbody>
          </table>
        </Card>
      </form>
      <p className="text-xs text-muted">Allocation instructions, deadline and priority are shown to the counsellor on the lead and as a task in their workspace. See <Link href="/leads?tab=history" className="underline">Allocation History</Link>.</p>
    </div>
  );
}

async function workspace(c: Ctx) {
  const mine = c.allLeads.filter((l) => l.assigned_to === c.me);
  const tasks = c.tasks.filter((t) => t.assigned_to === c.me);
  const pending = tasks.filter((t) => t.status === "pending");
  const overdue = pending.filter((t) => due(t, c.now));
  const todays = pending.filter((t) => t.due_at && istDate(t.due_at) === c.today);
  const completed = tasks.filter((t) => t.status === "completed" && t.completed_at && istDate(t.completed_at) === c.today);
  const newly = mine.filter((l) => l.allocated_at && c.now - Date.parse(l.allocated_at) < 86_400_000 && !c.acts.some((a) => a.lead_id === l.id && a.by_name === c.me && a.kind === "follow_up" && a.created_at >= l.allocated_at!));
  const visits = mine.filter((l) => l.stage === "visit_scheduled" && l.next_follow_up && Date.parse(l.next_follow_up) - c.now < 2 * 86_400_000 && Date.parse(l.next_follow_up) > c.now);
  const missed = mine.filter((l) => isOpen(l) && l.next_follow_up && Date.parse(l.next_follow_up) < c.now);
  const r = await c.lr.dailyReport(c.today);
  const myRow = r.rows.find((x) => x.name === c.me);
  const notes = [
    ...newly.map((l) => ({ k: `n-${l.id}`, tone: "blue" as const, text: `New allocation: ${l.full_name}${l.allocation_note ? ` — ${l.allocation_note}` : ""}`, id: l.id })),
    ...visits.map((l) => ({ k: `v-${l.id}`, tone: "amber" as const, text: `Upcoming visit: ${l.full_name} · ${istDateTime(l.next_follow_up)}`, id: l.id })),
    ...missed.map((l) => ({ k: `m-${l.id}`, tone: "red" as const, text: `Missed follow-up: ${l.full_name} (was due ${istDateTime(l.next_follow_up)})`, id: l.id })),
    ...overdue.map((t) => ({ k: `o-${t.id}`, tone: "red" as const, text: `Overdue task: ${t.title} — ${name(c, t.lead_id)?.full_name ?? ""}`, id: t.lead_id })),
  ];
  const taskTable = (list: LeadTask[], done = false) => (
    <table className="table">
      <thead><tr><th>Lead</th><th>Task</th><th>Due</th><th>{done ? "Remarks" : "Action"}</th></tr></thead>
      <tbody>
        {list.map((t) => (
          <tr key={t.id} className={due(t, c.now) ? "bg-red-50" : ""}>
            <td><LeadLink c={c} id={t.lead_id} /></td>
            <td className="text-xs">{t.title}{t.priority !== "normal" && <> <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge></>}</td>
            <td className="whitespace-nowrap text-xs">{t.due_at ? istDateTime(t.due_at) : "—"}</td>
            <td className="text-xs">
              {done ? t.remarks : (
                <div className="flex flex-wrap items-center gap-1">
                  <Link href={`${c.linkTo(t.lead_id)}#follow-up`} className="btn-navy px-2 py-1 text-[11px]">Follow up</Link>
                  <form action={completeTaskAction.bind(null, t.id)} className="flex items-center gap-1">
                    <input type="hidden" name="back" value="/leads?tab=workspace" />
                    <input name="remarks" placeholder="Task remark" aria-label="Task remark" className="input w-28 py-1 text-[11px]" />
                    <button className="rounded-[5px] border border-line px-2 py-1 text-[11px]">Done</button>
                  </form>
                </div>
              )}
            </td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={4} className="text-center text-muted">Nothing here.</td></tr>}
      </tbody>
    </table>
  );
  return (
    <div className="space-y-5">
      {c.admin && (
        <form className="flex flex-wrap items-center gap-2 text-xs">
          <input type="hidden" name="tab" value="workspace" />
          <span className="text-muted">View workspace of</span>
          <select name="as" defaultValue={c.me} aria-label="Counsellor" className="input w-auto py-1">{c.counsellors.map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
          <button className="btn-ghost py-1">Open</button>
        </form>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="My assigned leads" value={mine.filter(isOpen).length} />
        <Kpi label="Newly allocated" value={newly.length} tone={newly.length ? "amber" : undefined} />
        <Kpi label="Today's follow-ups" value={todays.length} />
        <Kpi label="Pending tasks" value={pending.length} />
        <Kpi label="Overdue tasks" value={overdue.length} tone={overdue.length ? "red" : undefined} />
        <Kpi label="Completed today" value={completed.length} tone="green" />
      </div>
      <Card title={`Notifications (${notes.length})`} bodyClass="p-3">
        {notes.length ? <ul className="space-y-1.5">{notes.map((n) => <li key={n.k} className={`rounded-r-[5px] border-l-4 px-2 py-1 text-[13px] ${n.tone === "red" ? "border-red-600 bg-red-50" : n.tone === "amber" ? "border-amber-500 bg-amber-50" : "border-sky-600 bg-sky-50"}`}><Link href={c.linkTo(n.id)} className="hover:underline">{n.text}</Link></li>)}</ul> : <Empty>No notifications.</Empty>}
      </Card>
      <Card title={`Today's follow-ups & pending tasks (${pending.length})`} bodyClass="p-0 overflow-x-auto">{taskTable([...overdue, ...pending.filter((t) => !overdue.includes(t))])}</Card>
      <Card title="My pipeline" bodyClass="p-2"><Pipeline c={c} leads={mine} /></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Completed tasks today (${completed.length})`} bodyClass="p-0 overflow-x-auto">{taskTable(completed, true)}</Card>
        <Card title="My daily performance" bodyClass="p-3">
          {myRow ? (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {(["allocated", "attended", "pending", "connected", "non_connected", "interested", "scheduled", "visited", "converted"] as const).map((k) => (
                <div key={k} className="rounded-[5px] border border-line p-2"><div className="text-muted capitalize">{k.replace("_", "-")}</div><div className="text-lg font-semibold text-navy">{myRow[k]}</div></div>
              ))}
            </div>
          ) : <Empty>No activity recorded today.</Empty>}
        </Card>
      </div>
    </div>
  );
}

function followups(c: Ctx) {
  const list = c.tasks.filter((t) => t.status === "pending" && (c.admin || t.assigned_to === c.me)).sort((a, b) => (a.due_at ?? "9").localeCompare(b.due_at ?? "9"));
  return (
    <Card title={`Follow-up management (${list.length} open)`} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Due</th><th>Lead</th><th>Stage</th><th>Next action</th><th>Counsellor</th><th /></tr></thead>
        <tbody>
          {list.map((t) => {
            const l = name(c, t.lead_id);
            return (
              <tr key={t.id} className={due(t, c.now) ? "bg-red-50" : ""}>
                <td className="whitespace-nowrap text-xs">{t.due_at ? istDateTime(t.due_at) : "No date"}{due(t, c.now) && <div className="font-medium text-red-600">Overdue</div>}</td>
                <td><LeadLink c={c} id={t.lead_id} /></td>
                <td className="text-xs">{l ? stageLabel(l.stage) : "—"}</td>
                <td className="text-xs">{t.title}</td>
                <td className="text-xs">{t.assigned_to}</td>
                <td><Link href={`${c.linkTo(t.lead_id)}#follow-up`} className="text-xs font-medium text-brand underline">Complete</Link></td>
              </tr>
            );
          })}
          {!list.length && <tr><td colSpan={6} className="text-center text-muted">No open follow-ups.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

async function report(c: Ctx) {
  const date = typeof c.sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.sp.date) ? c.sp.date : c.today;
  const r = await c.lr.dailyReport(date);
  const view = c.admin ? r : { ...r, rows: r.rows.filter((x) => x.name === c.me) };
  const register = c.acts.filter((a) => istDate(a.created_at) === date && (c.admin || a.by_name === c.me));
  const saved = c.admin ? await c.lr.savedReports() : [];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex items-end gap-2">
          <input type="hidden" name="tab" value="report" />
          <label className="text-[11px] text-muted">Report date<input name="date" type="date" defaultValue={date} max={c.today} className="input mt-0.5 py-1.5" /></label>
          <button className="btn-ghost">Show</button>
        </form>
        {c.admin && (
          <div className="flex flex-wrap gap-2">
            <form action={generateReportAction}><input type="hidden" name="date" value={date} /><button className="btn-navy">Generate &amp; save report</button></form>
            <a href={`/api/export/lead-report?date=${date}`} className="btn-ghost">Export report (CSV)</a>
          </div>
        )}
      </div>
      <h2 className="text-lg font-semibold text-navy">Daily Lead Management Report · {fmtDate(date)}</h2>
      <ReportKpis r={view} />
      <Card title="Counsellor-wise report" bodyClass="p-0 overflow-x-auto">
        <ReportTable r={view} />
        <div className="border-t border-line px-3 py-2 text-sm">Daily allocated lead completion: <b>{c.admin ? r.completion : pct(view.rows[0]?.attended ?? 0, view.rows[0]?.allocated ?? 0)}%</b> <span className="text-xs text-muted">(allocated vs attended)</span></div>
      </Card>
      <Card title={`Detailed activity register (${register.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Time</th><th>Staff</th><th>Lead</th><th>Activity</th><th>Outcome</th></tr></thead>
          <tbody>
            {register.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-xs">{istDateTime(a.created_at).slice(11)}</td><td className="text-xs">{a.by_name ?? "System"}</td><td><LeadLink c={c} id={a.lead_id} /></td><td className="text-xs"><b className="capitalize">{a.kind.replace("_", "-")}</b> — {a.summary}</td><td className="text-xs">{a.outcome ? stageLabel(a.outcome) : "—"}</td></tr>)}
            {!register.length && <tr><td colSpan={5} className="text-center text-muted">No activity on this date.</td></tr>}
          </tbody>
        </table>
      </Card>
      {c.admin && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Automatic report to Super Admin" bodyClass="p-3">
            <form action={saveLeadSettingsAction} className="grid gap-2 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
              <label className="text-[11px] text-muted">Send at (IST)<input name="report_time" type="time" defaultValue={c.settings.report_time} className="input mt-0.5 py-1.5" /></label>
              <label className="text-[11px] text-muted">Email to<input name="report_email" type="email" defaultValue={c.settings.report_email ?? ""} placeholder="superadmin@…" className="input mt-0.5 py-1.5" /></label>
              <button className="btn-primary py-1.5">Save</button>
            </form>
            <p className="mt-2 text-[11px] text-muted">The report is generated automatically every day after this time and saved below; it is emailed when email sending is configured.</p>
          </Card>
          <Card title="Saved daily reports" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Date</th><th className="text-right">Allocated</th><th className="text-right">Attended</th><th className="text-right">Converted</th><th className="text-right">Completion</th></tr></thead>
              <tbody>
                {saved.map((s) => <tr key={s.report_date}><td><Link href={`/leads?tab=report&date=${s.report_date}`} className="text-navy underline">{fmtDate(s.report_date)}</Link></td><td className="text-right">{s.data.total.allocated}</td><td className="text-right">{s.data.total.attended}</td><td className="text-right">{s.data.total.converted}</td><td className="text-right">{s.data.completion}%</td></tr>)}
                {!saved.length && <tr><td colSpan={5} className="text-center text-muted">No saved reports yet.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

function calendar(c: Ctx) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(c.today, i));
  const tasks = c.tasks.filter((t) => t.status === "pending" && t.due_at && (c.admin || t.assigned_to === c.me));
  const overdue = tasks.filter((t) => istDate(t.due_at!) < c.today);
  return (
    <div className="space-y-3">
      {overdue.length > 0 && <Card title={`Overdue (${overdue.length})`} bodyClass="p-3"><ul className="space-y-1 text-[13px]">{overdue.map((t) => <li key={t.id} className="text-red-700"><LeadLink c={c} id={t.lead_id} /> — {t.title} · {istDateTime(t.due_at)}</li>)}</ul></Card>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {days.map((d) => {
          const list = tasks.filter((t) => istDate(t.due_at!) === d);
          return (
            <div key={d} className={`min-h-28 rounded-[5px] border border-line bg-white p-2 ${d === c.today ? "ring-2 ring-brand/30" : ""}`}>
              <div className="text-[11px] font-semibold text-navy">{fmtDate(d)}</div>
              <ul className="mt-1 space-y-1">
                {list.map((t) => {
                  const l = name(c, t.lead_id);
                  return <li key={t.id} className={`rounded px-1.5 py-1 text-[11px] ${l?.stage === "visit_scheduled" ? "bg-orange-50 text-orange-900" : "bg-sky-50 text-sky-900"}`}><Link href={c.linkTo(t.lead_id)} className="hover:underline"><b>{istDateTime(t.due_at).slice(11)}</b> {l?.full_name}{l?.stage === "visit_scheduled" ? " · Visit" : ""}</Link><div className="text-muted">{t.assigned_to}</div></li>;
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function upload(c: Ctx) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Card title="Bulk lead upload" bodyClass="p-4">
        <form action={bulkUploadAction} className="space-y-3">
          <label className="block text-[11px] text-muted">Excel sheet saved as CSV (max 2 MB, 2,000 rows)<input name="file" type="file" accept=".csv,text/csv" className="input mt-0.5" /></label>
          <label className="block text-[11px] text-muted">…or paste rows (first line = header)<textarea name="csv" rows={6} className="input mt-0.5 font-mono text-xs" placeholder={"name,phone,email,city,source,course,remarks\nRohit Gupta,9876543210,rohit@example.com,Bengaluru,Website,DV,Weekend batch"} /></label>
          <label className="block text-[11px] text-muted">Default source<select name="source" defaultValue="Bulk upload" className="input mt-0.5 py-1.5">{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <div className="rounded-[5px] border border-line p-2.5">
            <div className="mb-2 text-xs font-semibold text-navy">Allocate the new leads (optional)</div>
            <AllocationFields counsellors={c.counsellors} />
            <p className="mt-1 text-[11px] text-muted">Leave Counsellor empty to keep them unassigned.</p>
          </div>
          <button className="btn-primary">Upload leads</button>
        </form>
      </Card>
      <Card title="How duplicates are removed" bodyClass="p-4 text-sm">
        <ul className="list-disc space-y-1 pl-5 text-[13px]">
          <li>Columns: <b>name</b> and <b>phone</b> are required; email, city, source, course and remarks are optional.</li>
          <li>Mobile numbers are compared on their last 10 digits.</li>
          <li>Rows repeating a number in the same file are skipped.</li>
          <li>Numbers already used by a lead or a registered student are skipped.</li>
          <li>Rows without a name or a 10-digit mobile are skipped.</li>
        </ul>
        <Link href="/api/export/lead-template" prefetch={false} className="mt-3 inline-block text-xs font-medium text-brand underline">Download the CSV template</Link>
      </Card>
    </div>
  );
}

async function duplicates(c: Ctx) {
  const groups = await c.lr.duplicateGroups();
  return (
    <Card title={`Duplicate management (${groups.length})`} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Mobile</th><th>Leads with this number</th><th>Registered student</th><th>Action</th></tr></thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.phone}>
              <td className="font-mono text-xs">{g.phone}</td>
              <td><ul className="space-y-1">{g.leads.map((l, i) => <li key={l.id} className="text-xs"><Link href={c.linkTo(l.id)} className="font-medium text-navy underline">{l.full_name}</Link> · {l.lead_no} · {stageLabel(l.stage)} · {l.assigned_to ?? "Unassigned"} {i === 0 && <Badge tone="green">Original</Badge>}</li>)}</ul></td>
              <td className="text-xs">{g.student ? <Link href={`/students/${g.student.id}`} className="text-brand underline">{g.student.full_name} ({g.student.enrollment_no})</Link> : "—"}</td>
              <td>
                <div className="flex flex-col gap-1">
                  {g.leads.slice(1).map((d) => <form key={d.id} action={mergeDuplicateAction.bind(null, d.id, g.leads[0].id)}><button className="rounded-[5px] border border-line px-2 py-1 text-[11px] hover:bg-slate-50">Merge {d.lead_no} into original</button></form>)}
                  {g.student && g.leads.length === 1 && <span className="text-[11px] text-muted">Already a student — archive the lead from its details.</span>}
                </div>
              </td>
            </tr>
          ))}
          {!groups.length && <tr><td colSpan={4} className="text-center text-muted">No duplicates found.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function counsellors(c: Ctx) {
  const active = c.staff.filter((s) => s.active !== false);
  return (
    <Card title="Counsellor management" bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Staff</th><th className="text-right">Open leads</th><th className="text-right">Pending tasks</th><th className="text-right">Converted</th><th>Settings</th></tr></thead>
        <tbody>
          {c.staff.map((s) => {
            const mine = c.allLeads.filter((l) => l.assigned_to === s.full_name);
            return (
              <tr key={s.id} className={s.active === false ? "bg-slate-50 text-muted" : ""}>
                <td><div className="font-medium text-navy">{s.full_name}</div><div className="text-[11px] text-muted">{s.designation ?? "—"} {s.active === false && <Badge tone="slate">Deactivated</Badge>}</div></td>
                <td className="text-right tabular-nums">{mine.filter(isOpen).length}</td>
                <td className="text-right tabular-nums">{c.tasks.filter((t) => t.assigned_to === s.full_name && t.status === "pending").length}</td>
                <td className="text-right tabular-nums">{mine.filter((l) => l.stage === "enrolled").length}</td>
                <td>
                  <form action={saveCounsellorAction.bind(null, s.id)} className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" name="counsellor" defaultChecked={Boolean(s.counsellor)} /> Counsellor</label>
                    <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={s.active !== false} /> Active</label>
                    <label className="flex items-center gap-1">Capacity<input name="lead_capacity" type="number" min={1} max={500} defaultValue={s.lead_capacity ?? 30} className="input w-16 py-1" /></label>
                    <select name="move_to" aria-label="On deactivation move open leads to" className="input w-auto py-1"><option value="">On deactivation keep leads</option>{active.filter((x) => x.id !== s.id).map((x) => <option key={x.id} value={x.full_name}>Move open leads to {x.full_name}</option>)}</select>
                    <button className="btn-navy px-2 py-1">Save</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-2 text-[11px] text-muted">Deactivated staff keep all their history; they just stop receiving allocations. Staff log in with their own account, and every action is recorded under their name.</p>
    </Card>
  );
}

function admissions(c: Ctx) {
  const pending = c.leads.filter((l) => ["visited", "admission_pending"].includes(l.stage));
  const done = c.leads.filter((l) => l.stage === "enrolled");
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title={`Ready for admission (${pending.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Lead</th><th>Stage</th><th>Course</th><th>Counsellor</th><th /></tr></thead>
          <tbody>
            {pending.map((l) => <tr key={l.id}><td><LeadLink c={c} id={l.id} /></td><td className="text-xs">{stageLabel(l.stage)}</td><td>{l.course_code ?? "—"}</td><td className="text-xs">{l.assigned_to ?? "—"}</td><td><Link href={`/students/new?lead=${l.id}`} className="btn bg-orange-500 px-2 py-1 text-xs text-white">Convert to admission</Link></td></tr>)}
            {!pending.length && <tr><td colSpan={5} className="text-center text-muted">No leads waiting for admission.</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title={`Converted (${done.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Lead</th><th>Source</th><th>Lead → Converted</th><th>Student</th></tr></thead>
          <tbody>
            {done.map((l) => <tr key={l.id}><td className="font-medium">{l.full_name}</td><td>{l.source}</td><td className="text-xs">{fmtDate(l.stage_dates.lead)} → {fmtDate(l.stage_dates.enrolled)}</td><td>{l.student_id ? <Link href={`/students/${l.student_id}`} className="text-brand hover:underline">{c.students.find((s) => s.id === l.student_id)?.enrollment_no ?? "Open"}</Link> : "—"}</td></tr>)}
            {!done.length && <tr><td colSpan={4} className="text-center text-muted">No conversions yet.</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted xl:col-span-2">Converting opens the admission form with the lead&apos;s name, mobile, email, city and course already filled in — nothing is typed twice.</p>
    </div>
  );
}

function analytics(c: Ctx) {
  const L = c.allLeads;
  const reached = (k: string) => L.filter((l) => l.stage_dates?.[k] || l.stage === k).length;
  const funnel = ["lead", "connected", "interested", "visit_scheduled", "visited", "admission_pending", "enrolled"];
  return (
    <div className="space-y-5">
      <Card title="Stage funnel" bodyClass="p-3">
        <div className="space-y-1.5">
          {funnel.map((k) => {
            const n = k === "lead" ? L.length : reached(k);
            return <div key={k} className="flex items-center gap-2 text-xs"><span className="w-32 shrink-0">{stageLabel(k)}</span><div className="h-4 flex-1 rounded bg-slate-100"><div className="h-4 rounded bg-brand" style={{ width: `${pct(n, L.length)}%` }} /></div><span className="w-20 text-right tabular-nums">{n} · {pct(n, L.length)}%</span></div>;
          })}
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Source analysis" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Source</th><th className="text-right">Leads</th><th className="text-right">Interested</th><th className="text-right">Visited</th><th className="text-right">Converted</th><th className="text-right">Conversion</th></tr></thead>
            <tbody>
              {[...new Set(L.map((l) => l.source))].map((src) => {
                const ls = L.filter((l) => l.source === src);
                const enr = ls.filter((l) => l.stage === "enrolled").length;
                return <tr key={src}><td><Badge tone={srcTone(src)}>{src}</Badge></td><td className="text-right">{ls.length}</td><td className="text-right">{ls.filter((l) => l.stage_dates?.interested).length}</td><td className="text-right">{ls.filter((l) => l.stage_dates?.visited).length}</td><td className="text-right">{enr}</td><td className="text-right">{pct(enr, ls.length)}%</td></tr>;
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Counsellor conversion" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Counsellor</th><th className="text-right">Leads</th><th className="text-right">Follow-ups done</th><th className="text-right">Visited</th><th className="text-right">Converted</th><th className="text-right">Conversion</th></tr></thead>
            <tbody>
              {c.staff.map((s) => {
                const ls = L.filter((l) => l.assigned_to === s.full_name);
                if (!ls.length) return null;
                const enr = ls.filter((l) => l.stage === "enrolled").length;
                return <tr key={s.id}><td>{s.full_name}</td><td className="text-right">{ls.length}</td><td className="text-right">{c.acts.filter((a) => a.by_name === s.full_name && a.kind === "follow_up").length}</td><td className="text-right">{ls.filter((l) => l.stage_dates?.visited).length}</td><td className="text-right">{enr}</td><td className="text-right">{pct(enr, ls.length)}%</td></tr>;
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function history(c: Ctx) {
  return (
    <Card title={`Allocation history (${c.allocs.length})`} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>When</th><th>Lead</th><th>From → To</th><th>Type</th><th>Deadline · priority</th><th>Instructions</th><th>By</th></tr></thead>
        <tbody>
          {c.allocs.slice(0, 300).map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap text-xs">{istDateTime(a.created_at)}</td>
              <td><LeadLink c={c} id={a.lead_id} /></td>
              <td className="text-xs">{a.from_staff ? `${a.from_staff} → ` : ""}<b>{a.to_staff}</b></td>
              <td className="text-xs capitalize">{a.mode}</td>
              <td className="text-xs">{a.deadline ? istDateTime(a.deadline) : "—"} · <Badge tone={PRIORITY_TONE[a.priority]}>{a.priority}</Badge></td>
              <td className="text-xs">{a.instructions ?? "—"}</td>
              <td className="text-xs">{a.allocated_by}</td>
            </tr>
          ))}
          {!c.allocs.length && <tr><td colSpan={7} className="text-center text-muted">No allocations yet.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function audit(c: Ctx) {
  const who = typeof c.sp.staff === "string" ? c.sp.staff : "";
  const list = c.acts.filter((a) => !who || a.by_name === who).slice(0, 400);
  const names = [...new Set(c.acts.map((a) => a.by_name).filter(Boolean))] as string[];
  return (
    <>
      <form className="mb-3 flex gap-2">
        <input type="hidden" name="tab" value="audit" />
        <select name="staff" defaultValue={who} aria-label="Staff" className="input w-auto"><option value="">Everyone</option>{names.map((n) => <option key={n}>{n}</option>)}</select>
        <button className="btn-ghost">Filter</button>
      </form>
      <Card title={`Audit trail — every lead action with who did it (${list.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>When</th><th>Staff</th><th>Lead</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {list.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-xs">{istDateTime(a.created_at)}</td><td className="text-xs">{a.by_name ?? "System"}</td><td><LeadLink c={c} id={a.lead_id} /></td><td className="text-xs capitalize">{a.kind.replace("_", "-")}</td><td className="text-xs">{a.summary}{a.outcome ? ` (${stageLabel(a.outcome)})` : ""}</td></tr>)}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function archive(c: Ctx) {
  return (
    <Card title={`Archived leads (${c.archived.length})`} bodyClass="p-0 overflow-x-auto">
      <table className="table">
        <thead><tr><th>Lead</th><th>Stage</th><th>Archived</th><th>Reason</th><th /></tr></thead>
        <tbody>
          {c.archived.map((l) => (
            <tr key={l.id}>
              <td><Link href={c.linkTo(l.id)} className="font-medium text-navy hover:text-brand">{l.full_name}</Link><div className="text-[11px] text-muted">{l.lead_no} · {l.phone}</div></td>
              <td className="text-xs">{stageLabel(l.stage)}</td>
              <td className="text-xs">{fmtDate(l.archived_at)}</td>
              <td className="text-xs">{l.archive_reason ?? "—"}{l.duplicate_of && <div className="text-muted">Duplicate of <Link href={c.linkTo(l.duplicate_of)} className="underline">original</Link></div>}</td>
              <td><form action={restoreLeadAction.bind(null, l.id)}><button className="text-xs font-medium text-brand underline">Restore</button></form></td>
            </tr>
          ))}
          {!c.archived.length && <tr><td colSpan={5} className="text-center text-muted">Nothing archived. History is never deleted — archived leads keep all their conversations.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

export const TAB_VIEWS: Record<string, (c: Ctx) => ReactNode | Promise<ReactNode>> = {
  dashboard, all, pipeline, allocation, workspace, followups, report, calendar, upload, duplicates, counsellors, admissions, analytics, history, audit, archive,
};
