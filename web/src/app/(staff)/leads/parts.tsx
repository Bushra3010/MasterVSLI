import Link from "next/link";
import { GraduationCap, MessageCircle, Phone, X } from "lucide-react";
import { Badge, Empty } from "@/components/ui";
import { fmtDate, istDateTime, todayISO } from "@/lib/format";
import { waNumber } from "@/lib/messaging";
import { FOLLOW_UP_OUTCOMES, LEAD_PRIORITIES, LEAD_STAGES, PRIORITY_TONE, stageLabel, type Lead, type LeadActivity, type LeadAllocation, type LeadTask, type Staff } from "@/lib/types";
import { moveLeadAction, updateLeadAction } from "../crm-actions";
import { addLeadAction, allocateAction, archiveLeadAction, followUpAction } from "./actions";

export const SOURCES = ["Website", "WhatsApp", "Referral", "Instagram", "Google", "Walk-in", "Manual call", "College / TPO", "Bulk upload"];
export const srcTone = (s: string) => (s === "Website" ? "blue" : s === "WhatsApp" ? "green" : s === "Referral" ? "violet" : "slate") as "blue" | "green" | "violet" | "slate";
export const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
export const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);

/** Deadline, priority and instructions — shared by every allocation form. */
export function AllocationFields({ counsellors, roundRobin = true, compact = false }: { counsellors: Staff[]; roundRobin?: boolean; compact?: boolean }) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-5"}`}>
      <label className="text-[11px] text-muted">Counsellor
        <select name="to" required className="input mt-0.5 py-1.5">
          <option value="">Choose…</option>
          {roundRobin && <option value="__round_robin">Round-robin (least loaded first)</option>}
          {counsellors.map((c) => <option key={c.id} value={c.full_name}>{c.full_name}</option>)}
        </select>
      </label>
      <label className="text-[11px] text-muted">Deadline<input name="deadline_date" type="date" min={todayISO()} className="input mt-0.5 py-1.5" /></label>
      <label className="text-[11px] text-muted">Time<input name="deadline_time" type="time" defaultValue="18:00" className="input mt-0.5 py-1.5" /></label>
      <label className="text-[11px] text-muted">Priority<select name="priority" className="input mt-0.5 py-1.5">{LEAD_PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className={`text-[11px] text-muted ${compact ? "col-span-2" : ""}`}>Instructions<input name="instructions" maxLength={300} placeholder="e.g. Call before 1 PM, share DV fee" className="input mt-0.5 py-1.5" /></label>
    </div>
  );
}

export function LeadCard({ l, href, now }: { l: Lead; href: string; now: number }) {
  const overdue = l.next_follow_up && Date.parse(l.next_follow_up) < now && !["enrolled", "lost"].includes(l.stage);
  return (
    <div className="rounded-[5px] border border-line bg-white p-2 text-[12px] shadow-sm">
      <Link href={href} className="block truncate text-[13px] font-semibold text-brand hover:underline">{l.full_name}</Link>
      <div className="text-muted">{l.phone ?? "—"}</div>
      <div className="font-medium text-navy">{l.assigned_to ?? <span className="text-amber-700">Unassigned</span>}</div>
      <div className={`text-[11px] ${overdue ? "font-medium text-red-600" : "text-muted"}`}>{l.next_follow_up ? fmtDate(l.next_follow_up) : "No follow-up"}</div>
      {l.priority && l.priority !== "normal" && <Badge tone={PRIORITY_TONE[l.priority]}>{l.priority}</Badge>}
      <div className="mt-1 flex gap-3 text-[11px] font-semibold text-brand">
        <Link href={`${href}#follow-up`} className="hover:underline">Follow up</Link>
        <Link href={`${href}#allocate`} className="hover:underline">Allocate</Link>
      </div>
    </div>
  );
}

export function AddLeadForm({ courses, counsellors, admin }: { courses: string[]; counsellors: Staff[]; admin: boolean }) {
  return (
    <form id="add" action={addLeadAction} className="space-y-2 text-xs">
      <div className="font-medium text-navy">New lead</div>
      <input name="full_name" required placeholder="Full name *" aria-label="Full name" className="input py-1.5" />
      <div className="grid grid-cols-2 gap-2">
        <input name="phone" placeholder="Mobile *" aria-label="Mobile" className="input py-1.5" />
        <input name="email" type="email" placeholder="Email" aria-label="Email" className="input py-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="source" aria-label="Source" className="input py-1.5">{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="course_code" aria-label="Course" className="input py-1.5"><option value="">Course?</option>{courses.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="city" placeholder="City" aria-label="City" className="input py-1.5" />
        <select name="assigned_to" aria-label="Assign to" className="input py-1.5"><option value="">Assign to me</option>{counsellors.map((s) => <option key={s.id}>{s.full_name}</option>)}</select>
      </div>
      <input name="remarks" placeholder="Remarks" aria-label="Remarks" className="input py-1.5" />
      {admin && <label className="flex items-center gap-1.5 text-[11px] text-muted"><input type="checkbox" name="allow_duplicate" /> Save even if the mobile number already exists</label>}
      <p className="text-[11px] text-muted">The mobile number is checked against all leads and registered students.</p>
      <button className="btn-primary w-full">Save lead</button>
    </form>
  );
}

/** Follow-up completion: remarks and next action are mandatory (except when closing the lead). */
export function FollowUpForm({ leadId, back, taskId }: { leadId: string; back: string; taskId?: string }) {
  return (
    <form action={followUpAction.bind(null, leadId)} className="space-y-2 rounded-[5px] border border-line bg-slate-50 p-2.5 text-xs">
      <input type="hidden" name="back" value={back} />
      {taskId && <input type="hidden" name="task_id" value={taskId} />}
      <label className="block text-[11px] text-muted">Outcome *
        <select name="outcome" required className="input mt-0.5 py-1.5">{FOLLOW_UP_OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
      </label>
      <label className="block text-[11px] text-muted">Conversation remarks *
        <textarea name="remarks" required minLength={5} rows={2} placeholder="What was discussed?" className="input mt-0.5" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-3 text-[11px] text-muted">Next action *<input name="next_action" placeholder="e.g. Share fee structure, confirm visit" className="input mt-0.5 py-1.5" /></label>
        <label className="col-span-2 text-[11px] text-muted">Next date *<input name="next_date" type="date" min={todayISO()} className="input mt-0.5 py-1.5" /></label>
        <label className="text-[11px] text-muted">Time<input name="next_time" type="time" defaultValue="11:00" className="input mt-0.5 py-1.5" /></label>
      </div>
      <button className="btn-primary w-full py-1.5">Complete follow-up</button>
    </form>
  );
}

export function LeadDrawer({ l, acts, tasks, allocs, closeHref, courses, counsellors, admin, back, now }: {
  l: Lead; acts: LeadActivity[]; tasks: LeadTask[]; allocs: LeadAllocation[]; closeHref: string; courses: string[]; counsellors: Staff[]; admin: boolean; back: string; now: number;
}) {
  const wa = waNumber(l.phone);
  const order = LEAD_STAGES.filter((s) => !["lost", "future_follow_up", "non_connected"].includes(s.key));
  const idx = order.findIndex((s) => s.key === l.stage);
  const open = tasks.filter((t) => t.status === "pending");
  const closed = l.stage === "enrolled" || l.stage === "lost";
  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full overflow-y-auto border-l-4 border-brand bg-white shadow-2xl sm:w-[460px]" aria-label="Lead details">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-medium text-navy">Lead Details – {l.full_name}</h2>
        <Link href={closeHref} aria-label="Close" className="text-muted hover:text-brand"><X size={18} /></Link>
      </div>
      <div className="space-y-4 p-4 text-[13px]">
        <div className="flex items-start gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-base font-medium text-brand">{initials(l.full_name)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-base font-medium text-navy">{l.full_name} <Badge tone={l.stage === "lost" ? "red" : l.stage === "enrolled" ? "green" : "amber"}>{stageLabel(l.stage)}</Badge>{l.archived && <Badge tone="slate">Archived</Badge>}</div>
            <div className="text-muted">{l.phone} · {l.email}</div>
            <div className="text-[11px] text-muted">{l.lead_no} · Source {l.source} · Counsellor <b>{l.assigned_to ?? "Unassigned"}</b>{l.priority && l.priority !== "normal" ? ` · ${l.priority} priority` : ""}</div>
            {l.allocation_note && <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">Instructions: {l.allocation_note}{l.allocation_deadline ? ` · by ${istDateTime(l.allocation_deadline)}` : ""}</div>}
          </div>
        </div>

        <ol className="flex items-start justify-between">
          {order.map((s, k) => (
            <li key={s.key} className="flex flex-1 flex-col items-center text-center text-[10px]">
              <span className={`grid size-5 place-items-center rounded-full text-white ${idx >= 0 && k < idx ? "bg-emerald-500" : k === idx ? "bg-orange-500" : "bg-slate-300"}`}>{k + 1}</span>
              <span className={k === idx ? "font-medium text-orange-600" : "text-muted"}>{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn border border-emerald-300 bg-emerald-50 text-emerald-800"><MessageCircle size={14} /> WhatsApp</a>}
          {l.phone && <a href={`tel:${l.phone}`} className="btn border border-blue-300 bg-blue-50 text-blue-800"><Phone size={14} /> Call</a>}
          {!closed && <Link href={`/students/new?lead=${l.id}`} className="btn bg-orange-500 text-white hover:bg-orange-600"><GraduationCap size={14} /> Convert to Admission</Link>}
        </div>
        {!closed && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted">Move stage directly</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LEAD_STAGES.filter((s) => s.key !== l.stage && s.key !== "enrolled").map((s) => (
                <form key={s.key} action={moveLeadAction.bind(null, l.id, s.key)}><button className="rounded-[5px] border border-line px-2 py-1 hover:bg-slate-50">Mark {s.label}</button></form>
              ))}
            </div>
          </details>
        )}

        {l.next_follow_up && (
          <div className="rounded-[5px] border border-amber-200 bg-amber-50 p-3">
            <div className="font-medium text-navy">Next follow-up</div>
            <div className="text-orange-700">{istDateTime(l.next_follow_up)}</div>
            <div className="text-xs text-muted">Action: {l.follow_up_note ?? "—"}</div>
          </div>
        )}

        {!closed && (
          <section id="follow-up" className="scroll-mt-4">
            <h3 className="mb-2 font-medium text-navy">Complete follow-up</h3>
            <FollowUpForm leadId={l.id} back={back} taskId={open[0]?.id} />
          </section>
        )}

        {open.length > 0 && (
          <section>
            <h3 className="mb-1 font-medium text-navy">Open tasks ({open.length})</h3>
            <ul className="space-y-1 text-xs">{open.map((t) => <li key={t.id} className="flex justify-between gap-2 rounded border border-line px-2 py-1"><span>{t.title} · <b>{t.assigned_to}</b></span><span className={t.due_at && Date.parse(t.due_at) < now ? "text-red-600" : "text-muted"}>{t.due_at ? istDateTime(t.due_at) : "—"}</span></li>)}</ul>
          </section>
        )}

        {admin && !l.archived && (
          <section id="allocate" className="scroll-mt-4">
            <h3 className="mb-2 font-medium text-navy">{l.assigned_to ? "Reallocate" : "Allocate"} this lead</h3>
            <form action={allocateAction} className="space-y-2 rounded-[5px] border border-line p-2.5 text-xs">
              <input type="hidden" name="mode" value="individual" />
              <input type="hidden" name="ids" value={l.id} />
              <input type="hidden" name="back" value={back} />
              <AllocationFields counsellors={counsellors} roundRobin={false} compact />
              <button className="btn-navy w-full py-1.5">{l.assigned_to ? "Reallocate" : "Allocate"}</button>
            </form>
          </section>
        )}

        <section>
          <h3 className="mb-2 font-medium text-navy">Conversation history ({acts.length})</h3>
          <ul className="space-y-2">
            {acts.map((a) => (
              <li key={a.id} className="rounded-[5px] border border-line p-2">
                <div className="flex justify-between gap-2 text-xs"><b className="font-medium capitalize text-navy">{a.kind.replace("_", "-")}</b><span className="text-muted">{istDateTime(a.created_at)} · {a.by_name ?? "System"}</span></div>
                <div className="text-xs text-[#515b73]">{a.summary}</div>
                {a.outcome && <Badge tone="blue">{stageLabel(a.outcome)}</Badge>}
              </li>
            ))}
            {!acts.length && <Empty>No activity yet.</Empty>}
          </ul>
        </section>

        {allocs.length > 0 && (
          <section>
            <h3 className="mb-1 font-medium text-navy">Allocation history</h3>
            <ul className="space-y-1 text-[11px] text-muted">{allocs.map((a) => <li key={a.id}>{istDateTime(a.created_at)} · {a.from_staff ? `${a.from_staff} → ` : ""}<b className="text-navy">{a.to_staff}</b> ({a.mode}) by {a.allocated_by}</li>)}</ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 font-medium text-navy">Student &amp; course details</h3>
          <form action={updateLeadAction.bind(null, l.id)} className="grid grid-cols-2 gap-2 text-xs">
            {([["phone", "Mobile"], ["email", "Email"], ["city", "Location"], ["education", "Education"], ["batch_pref", "Batch preference"], ["mode_pref", "Mode"], ["fee_plan", "Fee plan"]] as const).map(([k, label]) => (
              <label key={k} className="text-muted">{label}<input name={k} defaultValue={(l[k] as string) ?? ""} className="input mt-0.5 py-1" /></label>
            ))}
            <label className="text-muted">Course<select name="course_code" defaultValue={l.course_code ?? ""} className="input mt-0.5 py-1"><option value="">—</option>{courses.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="col-span-2 text-muted">Remarks<textarea name="remarks" defaultValue={l.remarks ?? ""} rows={2} className="input mt-0.5" /></label>
            <button className="btn-navy col-span-2 py-1.5">Save details</button>
          </form>
        </section>

        {admin && !l.archived && (
          <form action={archiveLeadAction.bind(null, l.id)} className="flex gap-2 border-t border-line pt-3 text-xs">
            <input name="reason" placeholder="Reason for archiving" aria-label="Archive reason" className="input flex-1 py-1.5" />
            <button className="btn-ghost py-1.5">Archive lead</button>
          </form>
        )}
      </div>
    </aside>
  );
}
