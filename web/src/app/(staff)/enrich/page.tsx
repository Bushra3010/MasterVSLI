import { Briefcase, Building2, Clock, FileText, GraduationCap, IndianRupee, Users } from "lucide-react";
import Link from "next/link";
import { I, Save } from "@/components/form-bits";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { addDays, fmtDate, inr, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import type { Client, Invoice, Milestone, Project, Timesheet } from "@/lib/types";
import { saveStaffAction } from "../actions";
import { addInvoiceAction, hireStudentAction, markInvoicePaidAction, saveRowAction, toggleMilestoneAction } from "../crm-actions";

export const metadata = { title: "Enrich Silicon" };

const TABS = [["overview", "Master control"], ["employees", "Employees"], ["clients", "Corporate clients"], ["projects", "Projects & timesheets"], ["invoices", "Billing & invoicing"]];

export default async function EnrichPage({ searchParams }: PageProps<"/enrich">) {
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";
  const repo = await getRepo();
  const [staff, clients, projects, timesheets, invoices, students, entries] = await Promise.all([
    repo.staff(),
    repo.list<Client>("clients", { order: { column: "name" } }),
    repo.list<Project>("projects", { order: { column: "name" } }),
    repo.list<Timesheet>("timesheets", { order: { column: "work_date", ascending: false } }),
    repo.list<Invoice>("invoices", { order: { column: "issue_date", ascending: false } }),
    repo.students(),
    repo.financeEntries(),
  ]);
  const milestones = await repo.list<Milestone>("project_milestones", { order: { column: "due_date" } });
  const emp = staff.filter((s) => s.company === "enrich");
  const mv = staff.filter((s) => (s.company ?? "mastervlsi") === "mastervlsi");
  const cname = new Map(clients.map((c) => [c.id, c.name]));
  const pname = new Map(projects.map((p) => [p.id, p.name]));
  const sname = new Map(staff.map((s) => [s.id, s.full_name]));
  const hired = new Set(staff.map((s) => s.source_student_id).filter(Boolean));
  const gross = (i: Invoice) => Number(i.amount) * (1 + Number(i.gst_pct) / 100);
  const book = (company: "mastervlsi" | "enrich") => ({
    income: entries.filter((e) => (e.company ?? "mastervlsi") === company && e.kind === "income").reduce((a, e) => a + Number(e.amount), 0),
    expense: entries.filter((e) => (e.company ?? "mastervlsi") === company && e.kind !== "income").reduce((a, e) => a + Number(e.amount), 0),
    unpaid: invoices.filter((i) => i.company === company && i.status === "unpaid").reduce((a, i) => a + gross(i), 0),
  });
  const weekHours = timesheets.filter((t) => t.work_date >= addDays(todayISO(), -7)).reduce((a, t) => a + Number(t.hours), 0);

  return (
    <>
      <PageHeader title="MasterVLSI + Enrich Silicon" subtitle="Training → Placement → Employment on one platform. Both companies keep separate employees, invoices, GST and books." />
      <nav className="mb-4 flex flex-wrap gap-4 border-b border-line text-[13px]">
        {TABS.map(([k, l]) => <Link key={k} href={`/enrich?tab=${k}`} className={`-mb-px border-b-2 pb-2 ${tab === k ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-brand"}`}>{l}</Link>)}
      </nav>

      {tab === "overview" && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {([["mastervlsi", "MasterVLSI", "Training institute", "border-orange-300 bg-orange-50"], ["enrich", "Enrich Silicon", "VLSI services company", "border-blue-300 bg-blue-50"]] as const).map(([k, title, sub, tint]) => {
              const b = book(k);
              return (
                <section key={k} className={`rounded-[5px] border-2 ${tint} p-4`}>
                  <div className="flex items-center gap-2 text-lg font-medium text-navy"><Building2 size={20} className="text-brand" /> {title}</div>
                  <div className="mb-3 text-xs text-muted">{sub}</div>
                  <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
                    <div className="rounded-[5px] bg-white p-2"><div className="text-muted">{k === "mastervlsi" ? "Students" : "Employees"}</div><div className="text-lg font-medium text-navy">{k === "mastervlsi" ? students.length : emp.length}</div></div>
                    <div className="rounded-[5px] bg-white p-2"><div className="text-muted">Staff</div><div className="text-lg font-medium text-navy">{k === "mastervlsi" ? mv.length : emp.length}</div></div>
                    <div className="rounded-[5px] bg-white p-2"><div className="text-muted">Other income</div><div className="text-lg font-medium text-emerald-700">{inr(b.income)}</div></div>
                    <div className="rounded-[5px] bg-white p-2"><div className="text-muted">Unpaid invoices</div><div className="text-lg font-medium text-amber-700">{inr(b.unpaid)}</div></div>
                  </div>
                </section>
              );
            })}
          </div>
          <Card title="Student → Employee flow" className="mt-5">
            <ol className="grid gap-3 text-[13px] sm:grid-cols-4">
              {[["College registration", "Portal / TPO / campus drive", Building2], ["MasterVLSI admission", "Profile, fees, training", GraduationCap], ["Training & placement", "Design verification, company drives", Briefcase], ["Enrich Silicon hiring", "Selection, onboarding, projects, payroll", Users]].map(([t, d, Icon], k) => {
                const C = Icon as typeof Users;
                return <li key={t as string} className="rounded-[5px] border border-line p-3"><span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-orange-500 text-xs text-white">{k + 1}</span><C size={16} className="inline text-brand" /><div className="mt-1 font-medium text-navy">{t as string}</div><div className="text-xs text-muted">{d as string}</div></li>;
              })}
            </ol>
            <p className="mt-3 text-xs text-muted">Legal &amp; financial separation: each company has its own invoices (MV-INV / ES-INV numbers), GST, bank accounts, employee records and books (Accounts › company filter).</p>
          </Card>
        </>
      )}

      {tab === "employees" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card title={`Employee database (${emp.length})`} bodyClass="p-0 overflow-x-auto" actions={<Link href="/hr?company=enrich" className="text-xs font-medium text-brand hover:underline">Attendance, leave & payroll →</Link>}>
            <table className="table">
              <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Joined</th><th>Monthly</th><th>Source</th></tr></thead>
              <tbody>
                {emp.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.employee_code}</td>
                    <td className="font-medium">{s.full_name}<div className="text-[11px] text-muted">{s.email}</div></td>
                    <td>{s.designation}</td>
                    <td>{fmtDate(s.joining_date)}</td>
                    <td className="tabular-nums">{inr(Number(s.monthly_salary ?? 0))}</td>
                    <td>{s.source_student_id ? <Link href={`/students/${s.source_student_id}`}><Badge tone="violet">MasterVLSI student</Badge></Link> : <Badge>External</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={saveStaffAction} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
              <input type="hidden" name="company" value="enrich" />
              <I name="employee_code" required placeholder="Emp. code (ES…)" w="w-28" />
              <I name="full_name" required placeholder="Full name" w="min-w-36 flex-1" />
              <I name="designation" placeholder="Designation" w="w-36" />
              <I name="joining_date" type="date" placeholder="Joining" w="w-36" />
              <I name="monthly_salary" type="number" placeholder="Monthly ₹" w="w-28" />
              <I name="email" type="email" placeholder="Email" w="w-44" />
              <Save label="+ Add employee" />
            </form>
          </Card>
          <Card title="Hire from MasterVLSI">
            <p className="mb-2 text-xs text-muted">Turn a trained / placed MasterVLSI student into an Enrich Silicon employee. Their record links back to the student profile.</p>
            <form action={hireStudentAction} className="space-y-2">
              <select name="student_id" required aria-label="Student" className="input">
                {students.filter((s) => !hired.has(s.id) && ["active", "completed"].includes(s.status)).map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.course_name} · {s.status}</option>)}
              </select>
              <input name="designation" required defaultValue="DV Engineer" aria-label="Designation" className="input" />
              <input name="salary" type="number" min={0} required placeholder="Monthly salary ₹" aria-label="Monthly salary" className="input" />
              <button className="btn-primary w-full">Hire into Enrich Silicon</button>
            </form>
          </Card>
        </div>
      )}

      {tab === "clients" && (
        <Card title={`Corporate clients (${clients.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Client</th><th>Type</th><th>Contact</th><th>GSTIN</th><th>Projects</th><th>Corporate students</th><th>Billed</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td><Badge tone={c.kind === "services" ? "blue" : "green"}>{c.kind === "services" ? "VLSI services" : "Corporate training"}</Badge></td>
                  <td className="text-xs">{c.contact_person}<div>{c.phone} · {c.email}</div></td>
                  <td className="font-mono text-xs">{c.gstin ?? "—"}</td>
                  <td>{projects.filter((p) => p.client_id === c.id).length}</td>
                  <td>{students.filter((s) => s.client_id === c.id).length}</td>
                  <td className="tabular-nums">{inr(invoices.filter((i) => i.client_id === c.id).reduce((a, i) => a + gross(i), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={saveRowAction.bind(null, "clients")} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
            <I name="name" required placeholder="Client / company name" w="min-w-44 flex-1" />
            <select name="kind" aria-label="Type" className="input w-auto py-1.5"><option value="services">VLSI services</option><option value="corporate_training">Corporate training</option></select>
            <I name="contact_person" placeholder="Contact person" w="w-36" />
            <I name="phone" placeholder="Phone" w="w-32" />
            <I name="email" type="email" placeholder="Email" w="w-44" />
            <I name="gstin" placeholder="GSTIN" w="w-40" />
            <Save label="+ Add client" />
          </form>
        </Card>
      )}

      {tab === "projects" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Projects" icon={<Briefcase size={15} />} bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Project</th><th>Client</th><th>Dates</th><th>Hours logged</th><th>Status</th></tr></thead>
              <tbody>
                {projects.map((p) => {
                  const late = p.status === "active" && p.end_date && p.end_date < todayISO();
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td>{cname.get(p.client_id ?? "")}</td>
                      <td className="text-xs">{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</td>
                      <td className="tabular-nums">{timesheets.filter((t) => t.project_id === p.id).reduce((a, t) => a + Number(t.hours), 0)}</td>
                      <td><Badge tone={late ? "red" : p.status === "active" ? "green" : "slate"}>{late ? "delayed" : p.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <form action={saveRowAction.bind(null, "projects")} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
              <I name="name" required placeholder="Project name" w="min-w-40 flex-1" />
              <select name="client_id" aria-label="Client" className="input w-auto py-1.5">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <I name="start_date" type="date" placeholder="Start" w="w-36" />
              <I name="end_date" type="date" placeholder="End" w="w-36" />
              <I name="hourly_rate" type="number" placeholder="₹/hour" w="w-24" />
              <input type="hidden" name="status" value="active" />
              <Save label="+ Add project" />
            </form>
          </Card>
          <Card title="Project milestones" className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Project</th><th>Milestone</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {milestones.map((m) => {
                  const late = !m.done && m.due_date < todayISO();
                  return (
                    <tr key={m.id} className={late ? "bg-red-50" : ""}>
                      <td>{pname.get(m.project_id)}</td><td className="font-medium">{m.title}</td><td>{fmtDate(m.due_date)}</td>
                      <td><form action={toggleMilestoneAction.bind(null, m.id, !m.done)}><button><Badge tone={m.done ? "green" : late ? "red" : "amber"}>{m.done ? `Done ${fmtDate(m.done_on)}` : late ? "Delayed – mark done" : "Open – mark done"}</Badge></button></form></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <form action={saveRowAction.bind(null, "project_milestones")} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
              <select name="project_id" required aria-label="Project" className="input w-auto py-1.5">{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <I name="title" required placeholder="Milestone" w="min-w-48 flex-1" />
              <I name="due_date" type="date" required placeholder="Due" w="w-36" />
              <Save label="+ Add milestone" />
            </form>
            <p className="border-t border-line px-3 py-2 text-[11px] text-muted">Overdue milestones raise a “Project milestone delay” alert automatically.</p>
          </Card>
          <Card title={`Timesheets (${weekHours} h in last 7 days)`} icon={<Clock size={15} />} bodyClass="p-0 overflow-x-auto">
            <form action={saveRowAction.bind(null, "timesheets")} className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <select name="staff_id" required aria-label="Employee" className="input w-auto py-1.5">{emp.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
              <select name="project_id" required aria-label="Project" className="input w-auto py-1.5">{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <I name="work_date" type="date" value={todayISO()} placeholder="Date" w="w-36" />
              <I name="hours" type="number" placeholder="Hours" w="w-20" required />
              <I name="note" placeholder="Note" w="min-w-32 flex-1" />
              <Save label="Log" />
            </form>
            <table className="table">
              <thead><tr><th>Date</th><th>Employee</th><th>Project</th><th>Hours</th></tr></thead>
              <tbody>{timesheets.slice(0, 15).map((t) => <tr key={t.id}><td>{fmtDate(t.work_date)}</td><td>{sname.get(t.staff_id)}</td><td className="text-xs">{pname.get(t.project_id)}</td><td>{t.hours}</td></tr>)}</tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "invoices" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Invoiced (all)" value={inr(invoices.filter((i) => i.status !== "cancelled").reduce((a, i) => a + gross(i), 0))} icon={<FileText size={18} />} />
            <Stat label="Received" value={inr(invoices.filter((i) => i.status === "paid").reduce((a, i) => a + gross(i), 0))} tone="green" icon={<IndianRupee size={18} />} />
            <Stat label="Outstanding" value={inr(invoices.filter((i) => i.status === "unpaid").reduce((a, i) => a + gross(i), 0))} tone="amber" />
            <Stat label="GST collected" value={inr(invoices.filter((i) => i.status === "paid").reduce((a, i) => a + (Number(i.amount) * Number(i.gst_pct)) / 100, 0))} tone="blue" />
          </div>
          <Card title="Invoices (client-wise, per company)" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Invoice no.</th><th>Company</th><th>Client</th><th>Date</th><th>Description</th><th>Amount</th><th>GST / TDS</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs"><Link href={`/enrich/invoice/${i.id}`} className="text-brand hover:underline">{i.invoice_no}</Link></td>
                    <td><Badge tone={i.company === "enrich" ? "blue" : "amber"}>{i.company === "enrich" ? "Enrich Silicon" : "MasterVLSI"}</Badge></td>
                    <td>{cname.get(i.client_id ?? "")}</td>
                    <td>{fmtDate(i.issue_date)}</td>
                    <td className="text-xs">{i.description}</td>
                    <td className="tabular-nums">{inr(i.amount)}</td>
                    <td>{i.gst_pct}%{Number(i.tds_pct) ? ` / −${i.tds_pct}%` : ""}</td>
                    <td className="tabular-nums font-medium">{inr(gross(i))}</td>
                    <td>{i.status === "unpaid" ? <form action={markInvoicePaidAction.bind(null, i.id)} className="flex items-center gap-1"><Badge tone="amber">unpaid</Badge><button className="text-xs text-emerald-700 hover:underline">Mark paid</button></form> : <Badge tone={i.status === "paid" ? "green" : "slate"}>{i.status}{i.paid_on ? ` ${fmtDate(i.paid_on)}` : ""}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form action={addInvoiceAction} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
              <select name="company" aria-label="Company" className="input w-auto py-1.5"><option value="enrich">Enrich Silicon</option><option value="mastervlsi">MasterVLSI</option></select>
              <select name="client_id" required aria-label="Client" className="input w-auto py-1.5">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <I name="issue_date" type="date" value={todayISO()} placeholder="Date" w="w-36" />
              <I name="description" placeholder="Description" w="min-w-44 flex-1" />
              <I name="amount" type="number" required placeholder="Amount ₹ (before GST)" w="w-44" />
              <I name="gst_pct" type="number" value={18} placeholder="GST %" w="w-20" />
              <I name="tds_pct" type="number" value={0} placeholder="TDS %" w="w-20" />
              <Save label="+ Create invoice" />
            </form>
          </Card>
        </>
      )}
    </>
  );
}
