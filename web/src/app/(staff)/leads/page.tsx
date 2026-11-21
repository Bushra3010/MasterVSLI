import { CalendarClock, GraduationCap, MessageCircle, Phone, Plus, School, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, todayISO } from "@/lib/format";
import { waNumber } from "@/lib/messaging";
import { getRepo } from "@/lib/server";
import type { Lead, LeadActivity, LeadStage } from "@/lib/types";
import { addLeadAction, leadActivityAction, moveLeadAction, updateLeadAction } from "../crm-actions";

export const metadata = { title: "Lead management" };

const STAGES: { key: LeadStage; label: string; sub: string; tint: string; head: string; icon: typeof Users }[] = [
  { key: "lead", label: "Leads", sub: "New inquiries (Website / WhatsApp / Referral / Other)", tint: "bg-blue-50", head: "bg-blue-100 text-blue-800", icon: UserPlus },
  { key: "interested", label: "Interested", sub: "Showed interest after call / chat", tint: "bg-amber-50", head: "bg-amber-100 text-amber-800", icon: Phone },
  { key: "visited", label: "Visited", sub: "Visited institute (counselling / demo)", tint: "bg-violet-50", head: "bg-violet-100 text-violet-800", icon: School },
  { key: "enrolled", label: "Enroll (Admission)", sub: "Fee payment & profile creation", tint: "bg-emerald-50", head: "bg-emerald-100 text-emerald-800", icon: GraduationCap },
];
const SOURCES = ["Website", "WhatsApp", "Referral", "Instagram", "Google", "Walk-in", "Manual call", "College / TPO"];
const srcTone = (s: string) => (s === "Website" ? "blue" : s === "WhatsApp" ? "green" : s === "Referral" ? "violet" : "slate") as "blue" | "green" | "violet" | "slate";
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "pipeline";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const source = typeof sp.source === "string" ? sp.source : "";
  const repo = await getRepo();
  const [leads, activities, students, courses, staff] = await Promise.all([
    repo.list<Lead>("leads", { order: { column: "created_at", ascending: false } }),
    repo.list<LeadActivity>("lead_activities", { order: { column: "created_at", ascending: false } }),
    repo.students(),
    repo.courses(),
    repo.staff(),
  ]);
  const shown = leads.filter((l) => (!source || l.source === source) && (!q || [l.full_name, l.phone, l.email].some((v) => v?.toLowerCase().includes(q))));
  const selected = typeof sp.id === "string" ? leads.find((l) => l.id === sp.id) : undefined;
  const reached = (s: LeadStage) => leads.filter((l) => l.stage_dates?.[s] || l.stage === s).length;
  const total = leads.length;
  const today = todayISO();
  const due = leads.filter((l) => l.next_follow_up && !["enrolled", "lost"].includes(l.stage)).sort((a, b) => a.next_follow_up!.localeCompare(b.next_follow_up!));
  const linkTo = (extra: Record<string, string>) => `/leads?${new URLSearchParams({ tab, ...(q ? { q } : {}), ...(source ? { source } : {}), ...extra })}`;

  return (
    <div className={selected ? "xl:mr-[440px]" : ""}>
      <PageHeader title="Student Lead Management" subtitle="Lead → Interested → Visited → Enroll. Capture leads from every source, track follow-ups and visits, and convert to admission." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((s, k) => (
          <div key={s.key} className={`relative rounded-[5px] border border-line ${s.tint} p-4 text-center`}>
            <s.icon className="mx-auto text-brand" size={26} />
            <div className="mt-1 text-[15px] font-medium text-navy">{s.label}</div>
            <div className="text-[11px] text-muted">{s.sub}</div>
            <div className="mt-1 text-xl font-medium text-navy">{leads.filter((l) => l.stage === s.key).length}</div>
            {k < 3 && <span className="absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 text-lg text-navy xl:block">→</span>}
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-line text-[13px]">
        {[["pipeline", "Lead Pipeline"], ["list", "Lead List"], ["followups", `Follow-ups (${due.length})`], ["source", "Source"], ["conversions", "Conversions"]].map(([k, l]) => (
          <Link key={k} href={`/leads?tab=${k}`} className={`-mb-px border-b-2 pb-2 ${tab === k ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-brand"}`}>{l}</Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
      <form className="flex flex-1 flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input name="q" defaultValue={q} placeholder="Search by name / phone / email" aria-label="Search leads" className="input max-w-xs" />
        <select name="source" defaultValue={source} aria-label="Source" className="input w-auto">
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn-ghost">Filter</button>
      </form>
        <details className="relative ml-auto">
          <summary className="btn-primary cursor-pointer list-none"><Plus size={15} /> Add Lead</summary>
          <div className="absolute right-0 z-20 mt-1 w-80 rounded-[5px] border border-line bg-white p-3 shadow-lg">
            <AddLeadForm courses={courses.map((c) => c.code)} staff={staff.map((s) => s.full_name)} />
          </div>
        </details>
      </div>

      {tab === "pipeline" && (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {STAGES.map((s) => {
            const col = shown.filter((l) => l.stage === s.key);
            return (
              <div key={s.key} className={`rounded-[5px] border border-line ${s.tint}`}>
                <div className={`flex items-center gap-2 rounded-t-[5px] px-3 py-2 text-sm font-medium ${s.head}`}><s.icon size={15} /> {s.label} ({col.length})</div>
                <div className="max-h-[560px] space-y-2 overflow-y-auto p-2">
                  {col.map((l) => <LeadCard key={l.id} l={l} active={l.id === selected?.id} href={linkTo({ id: l.id })} />)}
                  {!col.length && <p className="p-2 text-xs text-muted">No leads here.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "list" && (
        <Card bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Lead ID</th><th>Name</th><th>Phone</th><th>Source</th><th>Course</th><th>Stage</th><th>Assigned</th><th>Added</th></tr></thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs">{l.lead_no}</td>
                  <td><Link href={linkTo({ id: l.id })} className="font-medium text-navy hover:text-brand">{l.full_name}</Link></td>
                  <td>{l.phone}</td>
                  <td><Badge tone={srcTone(l.source)}>{l.source}</Badge></td>
                  <td>{l.course_code ?? "—"}</td>
                  <td className="capitalize">{l.stage}</td>
                  <td>{l.assigned_to ?? "—"}</td>
                  <td>{fmtDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "followups" && (
        <Card bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>Lead</th><th>Stage</th><th>Action</th><th>Assigned</th></tr></thead>
            <tbody>
              {due.map((l) => (
                <tr key={l.id} className={l.next_follow_up!.slice(0, 10) < today ? "bg-red-50" : ""}>
                  <td className="whitespace-nowrap">{new Date(l.next_follow_up!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                  <td><Link href={linkTo({ id: l.id })} className="font-medium text-navy hover:text-brand">{l.full_name}</Link></td>
                  <td className="capitalize">{l.stage}</td>
                  <td className="text-sm">{l.follow_up_note ?? "—"}</td>
                  <td>{l.assigned_to}</td>
                </tr>
              ))}
              {!due.length && <tr><td colSpan={5} className="text-center text-muted">No follow-ups scheduled.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "source" && (
        <Card title="Source analysis" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Source</th><th>Leads</th><th>Interested</th><th>Visited</th><th>Enrolled</th><th>Conversion</th></tr></thead>
            <tbody>
              {[...new Set(leads.map((l) => l.source))].map((src) => {
                const ls = leads.filter((l) => l.source === src);
                const enr = ls.filter((l) => l.stage === "enrolled").length;
                return (
                  <tr key={src}>
                    <td><Badge tone={srcTone(src)}>{src}</Badge></td>
                    <td>{ls.length}</td>
                    <td>{ls.filter((l) => l.stage_dates?.interested).length}</td>
                    <td>{ls.filter((l) => l.stage_dates?.visited).length}</td>
                    <td>{enr}</td>
                    <td>{pct(enr, ls.length)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "conversions" && (
        <Card bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Lead</th><th>Source</th><th>Lead → Enrolled</th><th>Student</th></tr></thead>
            <tbody>
              {leads.filter((l) => l.stage === "enrolled").map((l) => (
                <tr key={l.id}>
                  <td className="font-medium">{l.full_name}</td>
                  <td>{l.source}</td>
                  <td>{fmtDate(l.stage_dates.lead)} → {fmtDate(l.stage_dates.enrolled)}</td>
                  <td>{l.student_id ? <Link href={`/students/${l.student_id}`} className="text-brand hover:underline">{students.find((s) => s.id === l.student_id)?.enrollment_no ?? "Open"}</Link> : "—"}</td>
                </tr>
              ))}
              {!leads.some((l) => l.stage === "enrolled") && <tr><td colSpan={4} className="text-center text-muted">No conversions yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Quick Actions">
          <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
            <a href="#add" className="rounded-[5px] bg-emerald-50 p-3 text-emerald-800"><UserPlus className="mx-auto mb-1" size={18} />Add Lead</a>
            <Link href="/leads?tab=followups" className="rounded-[5px] bg-blue-50 p-3 text-blue-800"><CalendarClock className="mx-auto mb-1" size={18} />Follow-ups</Link>
            <Link href="/leads?tab=pipeline" className="rounded-[5px] bg-violet-50 p-3 text-violet-800"><School className="mx-auto mb-1" size={18} />Visits</Link>
            <Link href="/students/new" className="rounded-[5px] bg-orange-50 p-3 text-orange-800"><GraduationCap className="mx-auto mb-1" size={18} />Convert to Admission</Link>
          </div>
        </Card>
        <Card title="Conversion Summary">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Lead → Interested", reached("interested"), total], ["Interested → Visited", reached("visited"), reached("interested")], ["Visited → Enroll", reached("enrolled"), reached("visited")]].map(([l, a, b]) => (
              <div key={l as string} className="rounded-[5px] border border-line p-3">
                <div className="text-[11px] text-muted">{l}</div>
                <div className="text-lg font-medium text-navy">{pct(a as number, b as number)}%</div>
                <div className="text-[11px] text-muted">({a} / {b})</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {selected && <LeadDrawer l={selected} acts={activities.filter((a) => a.lead_id === selected.id)} closeHref={linkTo({})} courses={courses.map((c) => c.code)} staff={staff.map((s) => s.full_name)} />}
    </div>
  );
}

function LeadCard({ l, active, href }: { l: Lead; active: boolean; href: string }) {
  return (
    <Link href={href} className={`block rounded-[5px] border bg-white p-2.5 hover:border-brand ${active ? "border-brand ring-2 ring-brand/20" : "border-line"}`}>
      <div className="flex items-start gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-medium text-brand">{initials(l.full_name)}</span>
        <div className="min-w-0 text-[12px]">
          <div className="truncate text-[13px] font-medium text-navy">{l.full_name}</div>
          <div className="text-muted">{l.phone}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge tone={srcTone(l.source)}>{l.source}</Badge>
            {l.course_code && <span className="text-muted">{l.course_code}</span>}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {l.stage === "lead" ? `Added: ${fmtDate(l.created_at)}` : l.next_follow_up ? `Follow-up: ${fmtDate(l.next_follow_up)}` : `Updated: ${fmtDate(l.stage_dates?.[l.stage])}`}
          </div>
        </div>
      </div>
    </Link>
  );
}

function AddLeadForm({ courses, staff }: { courses: string[]; staff: string[] }) {
  return (
    <form id="add" action={addLeadAction} className="space-y-2 text-xs">
      <div className="font-medium text-navy">New lead</div>
      <input name="full_name" required placeholder="Full name *" aria-label="Full name" className="input py-1.5" />
      <div className="grid grid-cols-2 gap-2">
        <input name="phone" placeholder="Mobile" aria-label="Mobile" className="input py-1.5" />
        <input name="email" type="email" placeholder="Email" aria-label="Email" className="input py-1.5" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="source" aria-label="Source" className="input py-1.5">{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="course_code" aria-label="Course" className="input py-1.5"><option value="">Course?</option>{courses.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="city" placeholder="City" aria-label="City" className="input py-1.5" />
        <select name="assigned_to" aria-label="Assign to" className="input py-1.5"><option value="">Assign to me</option>{staff.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <input name="remarks" placeholder="Remarks" aria-label="Remarks" className="input py-1.5" />
      <button className="btn-primary w-full">Save lead</button>
    </form>
  );
}

function LeadDrawer({ l, acts, closeHref, courses, staff }: { l: Lead; acts: LeadActivity[]; closeHref: string; courses: string[]; staff: string[] }) {
  const order: LeadStage[] = ["lead", "interested", "visited", "enrolled"];
  const idx = order.indexOf(l.stage);
  const wa = waNumber(l.phone);
  const next = order[idx + 1];
  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full overflow-y-auto border-l-4 border-brand bg-white shadow-2xl sm:w-[440px]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-medium text-navy">Lead Details – {l.full_name}</h2>
        <Link href={closeHref} aria-label="Close" className="text-muted hover:text-brand"><X size={18} /></Link>
      </div>
      <div className="space-y-4 p-4 text-[13px]">
        <div className="flex items-start gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-base font-medium text-brand">{initials(l.full_name)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-base font-medium text-navy">{l.full_name} <Badge tone={l.stage === "lost" ? "red" : "amber"}>{l.stage}</Badge></div>
            <div className="text-muted">{l.phone} · {l.email}</div>
            <div className="text-[11px] text-muted">{l.lead_no} · Source {l.source} · Assigned to {l.assigned_to ?? "—"}</div>
          </div>
        </div>

        <ol className="flex items-start justify-between">
          {order.map((s, k) => (
            <li key={s} className="flex flex-1 flex-col items-center text-center text-[11px]">
              <span className={`grid size-6 place-items-center rounded-full text-white ${k < idx || l.stage === "enrolled" ? "bg-emerald-500" : k === idx ? "bg-orange-500" : "bg-slate-300"}`}>{k + 1}</span>
              <span className={k === idx ? "font-medium text-orange-600" : "text-muted"}>{s === "enrolled" ? "Enroll" : s[0].toUpperCase() + s.slice(1)}</span>
              <span className="text-muted">{l.stage_dates?.[s] ? fmtDate(l.stage_dates[s]) : "—"}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn border border-emerald-300 bg-emerald-50 text-emerald-800"><MessageCircle size={14} /> WhatsApp</a>}
          {l.phone && <a href={`tel:${l.phone}`} className="btn border border-blue-300 bg-blue-50 text-blue-800"><Phone size={14} /> Call</a>}
          {next && next !== "enrolled" && <form action={moveLeadAction.bind(null, l.id, next)}><button className="btn border border-violet-300 bg-violet-50 text-violet-800">Mark {next}</button></form>}
          {l.stage !== "enrolled" && <Link href={`/students/new?lead=${l.id}`} className="btn bg-orange-500 text-white hover:bg-orange-600"><GraduationCap size={14} /> Convert to Admission</Link>}
          {l.stage !== "lost" && l.stage !== "enrolled" && <form action={moveLeadAction.bind(null, l.id, "lost")}><button className="btn text-muted hover:text-brand">Mark lost</button></form>}
        </div>

        {l.next_follow_up && (
          <div className="rounded-[5px] border border-amber-200 bg-amber-50 p-3">
            <div className="font-medium text-navy">Next Follow-up</div>
            <div className="text-orange-700">{new Date(l.next_follow_up).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</div>
            <div className="text-xs text-muted">Action: {l.follow_up_note ?? "—"}</div>
          </div>
        )}

        <section>
          <h3 className="mb-2 font-medium text-navy">Conversation &amp; Activity Timeline</h3>
          <form action={leadActivityAction.bind(null, l.id)} className="mb-3 space-y-2 rounded-[5px] border border-line p-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <select name="kind" aria-label="Activity type" className="input py-1.5"><option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="visit">Institute visit</option><option value="counseling">Counselling / fee discussion</option><option value="demo">Demo class</option><option value="note">Note</option></select>
              <select name="outcome" aria-label="Outcome" className="input py-1.5"><option value="">Outcome</option><option>Interested</option><option>Visited</option><option>In progress</option><option>Callback</option><option>Not interested</option></select>
            </div>
            <textarea name="summary" required rows={2} placeholder="What was discussed?" aria-label="Summary" className="input" />
            <div className="grid grid-cols-2 gap-2">
              <input name="next_follow_up" type="datetime-local" aria-label="Next follow-up" className="input py-1.5" />
              <input name="follow_up_note" placeholder="Next action" aria-label="Next action" className="input py-1.5" />
            </div>
            <button className="btn-primary w-full py-1.5">Add activity</button>
          </form>
          <ul className="space-y-2">
            {acts.map((a) => (
              <li key={a.id} className="rounded-[5px] border border-line p-2">
                <div className="flex justify-between text-xs"><b className="font-medium capitalize text-navy">{a.kind}</b><span className="text-muted">{new Date(a.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</span></div>
                <div className="text-xs text-[#515b73]">{a.summary}</div>
                {a.outcome && <Badge tone="blue">{a.outcome}</Badge>}
              </li>
            ))}
            {!acts.length && <Empty>No activity yet.</Empty>}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 font-medium text-navy">Student &amp; course details</h3>
          <form action={updateLeadAction.bind(null, l.id)} className="grid grid-cols-2 gap-2 text-xs">
            {([["phone", "Mobile"], ["email", "Email"], ["city", "Location"], ["education", "Education"], ["batch_pref", "Batch preference"], ["mode_pref", "Mode"], ["fee_plan", "Fee plan"]] as const).map(([k, label]) => (
              <label key={k} className="text-muted">{label}<input name={k} defaultValue={(l[k] as string) ?? ""} className="input mt-0.5 py-1" /></label>
            ))}
            <label className="text-muted">Course<select name="course_code" defaultValue={l.course_code ?? ""} className="input mt-0.5 py-1"><option value="">—</option>{courses.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="text-muted">Assigned to<select name="assigned_to" defaultValue={l.assigned_to ?? ""} className="input mt-0.5 py-1"><option value="">—</option>{[...new Set([...(l.assigned_to ? [l.assigned_to] : []), ...staff])].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="col-span-2 text-muted">Remarks<textarea name="remarks" defaultValue={l.remarks ?? ""} rows={2} className="input mt-0.5" /></label>
            <button className="btn-navy col-span-2 py-1.5">Save details</button>
          </form>
        </section>
      </div>
    </aside>
  );
}
