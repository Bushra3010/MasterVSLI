import { Building2, History, Link2, Mail, MapPin, Phone, Plus, Search, StickyNote } from "lucide-react";
import Link from "next/link";
import { I, Save } from "@/components/form-bits";
import { Badge, Card, Empty, Field, PageHeader } from "@/components/ui";
import { fmtDate, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import type { Drive, HrCall, HrContact, HrHistory } from "@/lib/types";
import { deleteRowAction, saveRowAction } from "../crm-actions";

export const metadata = { title: "HR contacts" };

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
function duration(from?: string | null, to?: string | null) {
  if (!from) return "—";
  const end = to ? new Date(to) : new Date();
  const months = Math.max(0, (end.getFullYear() - new Date(from).getFullYear()) * 12 + end.getMonth() - new Date(from).getMonth());
  return to ? `${Math.floor(months / 12)} yr ${months % 12} mo` : "–";
}
const outcomeTone = (o?: string | null) => (o === "Interested" ? "green" : o === "Connected" ? "blue" : o === "Not interested" ? "red" : "amber") as "green" | "blue" | "red" | "amber";

export default async function HrContactsPage({ searchParams }: PageProps<"/hr-contacts">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";
  const repo = await getRepo();
  const [contacts, history, calls, drives] = await Promise.all([
    repo.list<HrContact>("hr_contacts", { order: { column: "full_name" } }),
    repo.list<HrHistory>("hr_company_history", { order: { column: "from_date", ascending: false } }),
    repo.list<HrCall>("hr_calls", { order: { column: "call_date", ascending: false } }),
    repo.drives(),
  ]);
  const shown = contacts.filter((c) => !q || [c.full_name, c.current_company, c.phone, c.email].some((v) => v?.toLowerCase().includes(q)));
  const adding = sp.add === "1";
  const sel = adding ? null : contacts.find((c) => c.id === sp.id) ?? shown[0] ?? null;
  const myHist = history.filter((h) => h.hr_id === sel?.id);
  const myCalls = calls.filter((c) => c.hr_id === sel?.id);
  const companies = new Set(myHist.map((h) => h.company.toLowerCase().split(" ")[0]));
  const opportunities = drives.filter((d: Drive) => companies.has(d.company.toLowerCase().split(" ")[0]));
  const tabs = [["overview", "Overview"], ["history", "Company History"], ["calls", "Calling Activities"], ["opps", "Placement Opportunities"], ["notes", "Notes & References"]];

  return (
    <>
      <PageHeader
        title="HR & Company Management"
        subtitle="Maintain HR details, track their company history, and manage calling activities for student placements."
        actions={<Link href="/hr-contacts?add=1" className="btn-primary"><Plus size={15} /> Add HR</Link>}
      />
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card title={`HR Contacts (${contacts.length})`} bodyClass="p-0">
          <form className="relative border-b border-line p-3">
            <Search size={14} className="absolute top-1/2 left-6 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="Search HR (name, company, phone, email)" aria-label="Search HR contacts" className="input pl-8" />
          </form>
          <ul className="max-h-[640px] divide-y divide-line overflow-y-auto">
            {shown.map((c) => (
              <li key={c.id}>
                <Link href={`/hr-contacts?id=${c.id}`} className={`flex items-center gap-3 px-3 py-3 ${c.id === sel?.id ? "border-l-4 border-brand bg-brand-soft" : "hover:bg-slate-50"}`}>
                  <span className="grid size-9 place-items-center rounded-full bg-navy-soft text-xs font-medium text-brand">{initials(c.full_name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-navy">{c.full_name}</div>
                    <div className="truncate text-[11px] text-muted">{c.current_company ?? "—"}</div>
                  </div>
                  {c.current_company && <Badge tone="green">Current</Badge>}
                </Link>
              </li>
            ))}
            {!shown.length && <li className="p-4 text-sm text-muted">No HR contacts.</li>}
          </ul>
        </Card>

        {adding || !sel ? (
          <Card title="Add HR contact">
            <HrForm />
          </Card>
        ) : (
          <div className="space-y-5">
            <section className="rounded-[5px] border border-line bg-white p-4">
              <div className="flex flex-wrap items-start gap-4">
                <span className="grid size-14 place-items-center rounded-full bg-navy-soft text-lg font-medium text-brand">{initials(sel.full_name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-medium text-navy">{sel.full_name}</h2>
                    {sel.current_company && <span className="inline-flex items-center gap-1 rounded-[5px] bg-emerald-50 px-2 py-1 text-xs text-emerald-800"><Building2 size={13} /> Currently at: {sel.current_company}</span>}
                  </div>
                  <div className="text-sm text-muted">{sel.designation}</div>
                  <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-[#515b73]">
                    {sel.phone && <a href={`tel:${sel.phone}`} className="flex items-center gap-1 hover:text-brand"><Phone size={13} /> {sel.phone}</a>}
                    {sel.email && <a href={`mailto:${sel.email}`} className="flex items-center gap-1 hover:text-brand"><Mail size={13} /> {sel.email}</a>}
                    {sel.city && <span className="flex items-center gap-1"><MapPin size={13} /> {sel.city}</span>}
                  </div>
                </div>
                <Link href={`/hr-contacts?id=${sel.id}&tab=edit`} className="btn border border-violet-300 bg-violet-50 text-violet-800">Edit</Link>
              </div>
              <nav className="mt-4 flex flex-wrap gap-4 border-b border-line text-[13px]">
                {tabs.map(([k, l]) => (
                  <Link key={k} href={`/hr-contacts?id=${sel.id}&tab=${k}`} className={`-mb-px border-b-2 pb-2 ${tab === k ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-brand"}`}>{l}</Link>
                ))}
              </nav>
            </section>

            {tab === "edit" && <Card title="Edit HR contact"><HrForm c={sel} /></Card>}

            {(tab === "overview" || tab === "history") && (
              <div className="grid gap-5 lg:grid-cols-2">
                {tab === "overview" && (
                  <>
                    <Card title="HR Details">
                      <dl>
                        <Field label="Full name" value={sel.full_name} />
                        <Field label="Designation" value={sel.designation} />
                        <Field label="Department" value={sel.department} />
                        <Field label="Phone" value={sel.phone} />
                        <Field label="Email" value={sel.email} />
                        <Field label="LinkedIn" value={sel.linkedin && <a href={`https://${sel.linkedin.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline"><Link2 size={12} /> {sel.linkedin}</a>} />
                      </dl>
                    </Card>
                    <Card title="Current Organization" className="bg-navy-soft">
                      <div className="mb-2 flex items-center gap-2 text-base font-medium text-navy"><Building2 size={18} className="text-brand" /> {sel.current_company ?? "—"}</div>
                      <dl>
                        <Field label="Joined on" value={fmtDate(sel.joined_on)} />
                        <Field label="Location" value={sel.city} />
                        <Field label="Company type" value={sel.company_type} />
                      </dl>
                    </Card>
                  </>
                )}
              </div>
            )}

            {(tab === "overview" || tab === "history") && (
              <Card title="Company History (All Organizations Worked With)" icon={<History size={15} />} bodyClass="p-0 overflow-x-auto">
                <table className="table">
                  <thead><tr><th>#</th><th>Company</th><th>Designation</th><th>From</th><th>To</th><th>Duration</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {myHist.map((h, k) => (
                      <tr key={h.id}>
                        <td>{k + 1}</td><td className="font-medium">{h.company}</td><td>{h.designation}</td><td>{fmtDate(h.from_date)}</td><td>{h.to_date ? fmtDate(h.to_date) : "Present"}</td>
                        <td>{duration(h.from_date, h.to_date)}</td>
                        <td><Badge tone={h.to_date ? "slate" : "green"}>{h.to_date ? "Previous" : "Current"}</Badge></td>
                        <td><form action={deleteRowAction.bind(null, "hr_company_history", h.id)}><button className="text-xs text-muted hover:text-brand">Delete</button></form></td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={8}>
                        <form action={saveRowAction.bind(null, "hr_company_history")} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="hr_id" value={sel.id} />
                          <I name="company" required placeholder="Company" w="min-w-40 flex-1" />
                          <I name="designation" placeholder="Designation" w="w-40" />
                          <I name="from_date" type="date" placeholder="From" w="w-36" />
                          <I name="to_date" type="date" placeholder="To (blank = present)" w="w-36" />
                          <Save label="+ Add Organization" />
                        </form>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            )}

            {(tab === "overview" || tab === "calls" || tab === "notes") && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                {(tab === "overview" || tab === "calls") && (
                  <Card title="Recent Calling Activities" icon={<Phone size={15} />} bodyClass="p-0 overflow-x-auto" className={tab === "calls" ? "lg:col-span-2" : ""}>
                    <table className="table">
                      <thead><tr><th>Date</th><th>Activity</th><th>Outcome</th><th>Remarks</th></tr></thead>
                      <tbody>
                        {myCalls.map((c) => (
                          <tr key={c.id}><td className="whitespace-nowrap">{fmtDate(c.call_date)}</td><td>{c.activity}</td><td><Badge tone={outcomeTone(c.outcome)}>{c.outcome ?? "—"}</Badge></td><td className="text-xs">{c.remarks}</td></tr>
                        ))}
                        <tr>
                          <td colSpan={4}>
                            <form action={saveRowAction.bind(null, "hr_calls")} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="hr_id" value={sel.id} />
                              <I name="call_date" type="date" value={todayISO()} placeholder="Date" w="w-36" />
                              <select name="activity" aria-label="Activity" className="input w-auto py-1.5"><option>Introduction call</option><option>Placement discussion</option><option>Follow-up</option><option>Profiles shared</option><option>Interview scheduling</option></select>
                              <select name="outcome" aria-label="Outcome" className="input w-auto py-1.5"><option>Connected</option><option>Interested</option><option>To follow up</option><option>Not interested</option><option>No answer</option></select>
                              <I name="remarks" placeholder="Remarks" w="min-w-40 flex-1" />
                              <Save label="+ Add Calling Activity" />
                            </form>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </Card>
                )}
                {(tab === "overview" || tab === "notes") && (
                  <Card title="Reference / Hiring Insight" icon={<StickyNote size={15} />} className={tab === "notes" ? "lg:col-span-2" : ""}>
                    <form action={saveRowAction.bind(null, "hr_contacts")} className="space-y-2">
                      <HiddenContact c={sel} />
                      <textarea name="reference_note" defaultValue={sel.reference_note ?? ""} rows={5} aria-label="Reference note" className="input" placeholder="How do we know this HR? Past hiring, batches, references…" />
                      <Save />
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === "opps" && (
              <Card title="Placement Opportunities" bodyClass="p-0 overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Company</th><th>Role</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {opportunities.map((d) => <tr key={d.id}><td className="font-medium">{d.company}</td><td>{d.job_role}</td><td>{fmtDate(d.drive_date)}</td><td className="capitalize">{d.status}</td></tr>)}
                    {!opportunities.length && <tr><td colSpan={4}><Empty>No drives yet with this HR&apos;s companies. <Link href="/placements" className="text-brand hover:underline">Create a drive</Link>.</Empty></td></tr>}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** Keeps the other contact fields when only the note is saved. */
function HiddenContact({ c }: { c: HrContact }) {
  return (
    <>
      {(["id", "full_name", "designation", "department", "phone", "email", "linkedin", "city", "current_company", "company_type", "joined_on"] as const).map((k) => (
        <input key={k} type="hidden" name={k} value={(c[k] as string) ?? ""} />
      ))}
    </>
  );
}

function HrForm({ c }: { c?: HrContact }) {
  const f = (k: keyof HrContact) => (c?.[k] as string) ?? "";
  return (
    <form action={saveRowAction.bind(null, "hr_contacts")} className="grid gap-3 sm:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      {([["full_name", "Full name *"], ["designation", "Designation"], ["department", "Department"], ["phone", "Phone"], ["email", "Email"], ["linkedin", "LinkedIn"], ["city", "Location"], ["current_company", "Current company"], ["company_type", "Company type"]] as const).map(([k, l]) => (
        <label key={k} className="text-xs text-muted">{l}<input name={k} defaultValue={f(k)} required={k === "full_name"} className="input mt-1" /></label>
      ))}
      <label className="text-xs text-muted">Joined current company<input name="joined_on" type="date" defaultValue={f("joined_on")} className="input mt-1" /></label>
      <label className="text-xs text-muted sm:col-span-2">Reference / hiring insight<textarea name="reference_note" defaultValue={f("reference_note")} rows={3} className="input mt-1" /></label>
      <button className="btn-primary sm:col-span-2">{c ? "Save changes" : "Add HR contact"}</button>
    </form>
  );
}
