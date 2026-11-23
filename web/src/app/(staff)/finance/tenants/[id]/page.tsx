import { AlertTriangle, ArrowLeft, FileText, IndianRupee, LogOut, Phone, Plug, User, Wrench } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/finance-ui";
import { FIELD, RefSelect } from "@/components/finance-bits";
import { Badge, Card, Field, StatusBadge } from "@/components/ui";
import { balanceSheet, dueBalance, dueTotal, monthOf, tenancyView } from "@/lib/finance";
import { fmtDate, inr, titleCase } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { docFileName } from "@/lib/types";
import {
  exitTenancyAction,
  maintenanceAction,
  maintenanceStatusAction,
  noticeAction,
  saveFinanceRow,
  tenantPaymentAction,
  uploadTenantDocAction,
  utilityBillAction,
} from "../../actions";

export const metadata = { title: "Tenant record" };

const TABS = [
  ["overview", "Overview"],
  ["agreement", "Agreement"],
  ["rent", "Rent & payments"],
  ["utilities", "Utilities"],
  ["maintenance", "Maintenance"],
  ["deposit", "Deposit & exit"],
  ["documents", "Documents"],
  ["history", "History"],
] as const;

export default async function TenantRecord({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" && TABS.some(([k]) => k === sp.tab) ? sp.tab : "overview") as (typeof TABS)[number][0];
  const d = await (await getFinance()).load();
  const t = d.tenancies.find((x) => x.id === id);
  if (!t) notFound();
  const v = tenancyView(d, t);
  const tn = v.tenant;
  const bills = d.bills.filter((b) => b.tenancy_id === t.id || (b.unit_id === t.unit_id && !b.tenancy_id));
  const maint = d.maintenance.filter((m) => m.tenancy_id === t.id || m.unit_id === t.unit_id);
  const docs = d.tenantDocs.filter((x) => x.tenant_id === tn.id);
  const refs = balanceSheet(d);
  const propertyRefs = refs.filter((r) => r.entity === "property");
  const month = monthOf(d.today);
  const nextDue = v.dues.find((r) => dueBalance(r) > 0);
  const ended = t.status === "ended";

  return (
    <>
      <Link href="/finance/tenants" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-brand"><ArrowLeft size={14} /> All tenants</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 rounded-[5px] border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-full bg-navy text-lg font-semibold text-white">{tn.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
          <div>
            <h1 className="text-xl font-semibold text-navy">{tn.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-medium text-ink">{v.unit?.code}</span>{v.unit?.unit_type && <span>· {v.unit.unit_type}</span>}
              <span className="flex items-center gap-1"><Phone size={12} /> {tn.phone ?? "—"}</span>
              <Badge tone={t.status === "active" ? "green" : t.status === "notice" ? "amber" : "slate"}>{titleCase(t.status)}</Badge>
              {tn.kyc_verified ? <Badge tone="green">KYC verified</Badge> : <Badge tone="amber">KYC pending</Badge>}
            </div>
            <div className="mt-1 text-xs text-muted">Agreement {t.agreement_no ?? "—"} · {fmtDate(t.start_date)} → {fmtDate(t.end_date)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[["Monthly rent", inr(Number(t.monthly_rent))], ["Due day", `${t.due_day}th`], ["Security deposit", inr(v.depositHeld)], ["Outstanding", inr(v.outstanding)]].map(([l, val]) => (
            <div key={l} className="rounded-[5px] bg-slate-50 px-3 py-2"><div className="text-[11px] text-muted">{l}</div><div className={`font-semibold tabular-nums ${l === "Outstanding" && v.outstanding ? "text-red-600" : "text-navy"}`}>{val}</div></div>
          ))}
        </div>
      </div>

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/finance/tenants/${t.id}?tab=${k}`} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card title="Tenant & property details" icon={<User size={15} />}>
            <dl>
              <Field label="Tenant name" value={tn.full_name} />
              <Field label="Mobile" value={tn.phone} />
              <Field label="Email" value={tn.email} />
              <Field label="ID proof" value={tn.id_proof_type ? `${tn.id_proof_type} · ${tn.id_proof_no ?? ""}` : null} />
              <Field label="Occupation" value={tn.occupation} />
              <Field label="Family members" value={tn.family_members} />
              <Field label="Permanent address" value={tn.permanent_address} />
              <Field label="Emergency contact" value={tn.emergency_phone ? `${tn.emergency_name ?? ""} · ${tn.emergency_phone}` : null} />
              <Field label="Police verification" value={tn.police_verified ? "Done" : "Pending"} />
              <Field label="Home" value={`${v.unit?.code ?? ""} · ${v.unit?.unit_type ?? ""} · ${v.unit?.floor ?? ""} floor`} />
            </dl>
          </Card>
          <Card title="Agreement details" icon={<FileText size={15} />}>
            <dl>
              <Field label="Agreement no." value={t.agreement_no} />
              <Field label="Start date" value={fmtDate(t.start_date)} />
              <Field label="End date" value={fmtDate(t.end_date)} />
              <Field label="Monthly rent" value={inr(Number(t.monthly_rent))} />
              <Field label="Maintenance / month" value={inr(Number(t.maintenance_charge))} />
              <Field label="Rent escalation" value={`${t.escalation_pct}% yearly`} />
              <Field label="Notice period" value={`${t.notice_days} days`} />
              <Field label="Security deposit (agreed)" value={inr(Number(t.security_deposit))} />
            </dl>
          </Card>
          <Card title="Financial summary" icon={<IndianRupee size={15} />}>
            <dl>
              <Field label="This month" value={v.current ? `${inr(dueTotal(v.current))} · ${dueBalance(v.current) ? "due" : "paid"}` : "—"} />
              <Field label="Total paid (till date)" value={inr(v.totalPaid)} />
              <Field label="Outstanding" value={<span className={v.outstanding ? "text-red-600" : ""}>{inr(v.outstanding)}</span>} />
              <Field label="Next due" value={nextDue ? `${fmtDate(nextDue.due_date)} · ${inr(dueBalance(nextDue))}` : "Nothing due"} />
              <Field label="Deposit held" value={inr(v.depositHeld)} />
            </dl>
            {v.overdue.length > 0 && <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle size={13} /> {v.overdue.length} overdue month(s)</p>}
          </Card>
          <Card title="Recurring bills (this home)" icon={<Plug size={15} />} className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Bill</th><th>Month</th><th>Meter</th><th>Units</th><th>Amount</th><th>Paid by</th><th>Status</th></tr></thead>
              <tbody>
                {bills.slice(0, 6).map((b) => (
                  <tr key={b.id}><td className="capitalize">{b.utility}</td><td>{b.bill_month}</td><td className="text-xs">{b.meter_no ?? "—"}</td><td className="tabular-nums">{b.curr_reading != null && b.prev_reading != null ? Number(b.curr_reading) - Number(b.prev_reading) : "—"}</td><td className="tabular-nums">{inr(Number(b.amount))}</td><td className="capitalize">{b.payer}</td><td><StatusBadge status={b.status === "paid" ? "paid" : "pending"} /></td></tr>
                ))}
                {!bills.length && <tr><td colSpan={7} className="text-center text-muted">No bills yet</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="Maintenance & service requests" icon={<Wrench size={15} />} bodyClass="p-0">
            <table className="table">
              <tbody>
                {maint.slice(0, 5).map((m) => <tr key={m.id}><td>{m.title}<div className="text-[11px] text-muted">{fmtDate(m.raised_on)}</div></td><td><Badge tone={m.status === "completed" ? "green" : m.status === "open" ? "amber" : "blue"}>{titleCase(m.status)}</Badge></td></tr>)}
                {!maint.length && <tr><td className="text-center text-muted">No requests</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "agreement" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Edit tenant & KYC">
            <form action={saveFinanceRow.bind(null, "tenants")} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={tn.id} />
              <FIELD label="Full name" name="full_name" defaultValue={tn.full_name} required />
              <FIELD label="Mobile" name="phone" defaultValue={tn.phone} />
              <FIELD label="Alternate mobile" name="alt_phone" defaultValue={tn.alt_phone} />
              <FIELD label="Email" name="email" type="email" defaultValue={tn.email} />
              <FIELD label="ID proof type" name="id_proof_type" defaultValue={tn.id_proof_type} />
              <FIELD label="ID proof number" name="id_proof_no" defaultValue={tn.id_proof_no} />
              <FIELD label="Occupation" name="occupation" defaultValue={tn.occupation} />
              <FIELD label="Family members" name="family_members" type="number" defaultValue={tn.family_members} />
              <FIELD label="Permanent address" name="permanent_address" defaultValue={tn.permanent_address} />
              <FIELD label="Emergency contact name" name="emergency_name" defaultValue={tn.emergency_name} />
              <FIELD label="Emergency mobile" name="emergency_phone" defaultValue={tn.emergency_phone} />
              <FIELD label="Notes" name="notes" defaultValue={tn.notes} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="kyc_verified" defaultChecked={tn.kyc_verified} /> KYC verified</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="police_verified" defaultChecked={tn.police_verified} /> Police verification done</label>
              <div className="sm:col-span-2"><button className="btn-primary">Save tenant</button></div>
            </form>
          </Card>
          <Card title="Edit agreement">
            <form action={saveFinanceRow.bind(null, "tenancies")} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={t.id} />
              <FIELD label="Agreement no." name="agreement_no" defaultValue={t.agreement_no} />
              <FIELD label="Start date" name="start_date" type="date" defaultValue={t.start_date} required />
              <FIELD label="End date" name="end_date" type="date" defaultValue={t.end_date} />
              <FIELD label="Monthly rent (₹)" name="monthly_rent" type="number" defaultValue={t.monthly_rent} required />
              <FIELD label="Due day (1–28)" name="due_day" type="number" defaultValue={t.due_day} />
              <FIELD label="Maintenance / month (₹)" name="maintenance_charge" type="number" defaultValue={t.maintenance_charge} />
              <FIELD label="Security deposit agreed (₹)" name="security_deposit" type="number" defaultValue={t.security_deposit} />
              <FIELD label="Yearly escalation %" name="escalation_pct" type="number" step="0.5" defaultValue={t.escalation_pct} />
              <FIELD label="Notice period (days)" name="notice_days" type="number" defaultValue={t.notice_days} />
              <div className="sm:col-span-2 text-xs text-muted">Rent changes apply to dues raised from now on; existing months keep their amounts.</div>
              <div className="sm:col-span-2"><button className="btn-primary">Save agreement</button></div>
            </form>
          </Card>
        </div>
      )}

      {tab === "rent" && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card title="Monthly dues" className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Month</th><th>Due date</th><th>Rent</th><th>Maint.</th><th>Utilities</th><th>Other</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
              <tbody>
                {[...v.dues].reverse().map((r) => (
                  <tr key={r.id} className={r.period === month ? "bg-brand-soft/40" : ""}>
                    <td className="font-medium">{r.period}</td><td>{fmtDate(r.due_date)}</td>
                    <td className="tabular-nums">{inr(Number(r.rent))}</td><td className="tabular-nums">{inr(Number(r.maintenance))}</td><td className="tabular-nums">{inr(Number(r.utilities))}</td><td className="tabular-nums">{inr(Number(r.other))}</td>
                    <td className="font-semibold tabular-nums">{inr(dueTotal(r))}</td><td className="tabular-nums">{inr(Number(r.paid))}</td>
                    <td><StatusBadge status={dueBalance(r) === 0 ? "paid" : r.due_date < d.today ? "overdue" : Number(r.paid) > 0 ? "partial" : "pending"} /></td>
                  </tr>
                ))}
                {!v.dues.length && <tr><td colSpan={9} className="text-center text-muted">No dues raised yet</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="Record payment">
            {ended ? <p className="text-sm text-muted">This tenancy has ended.</p> : (
              <ActionForm action={tenantPaymentAction.bind(null, t.id)} submit="Record payment">
                <div className="grid gap-3">
                  <div>
                    <label className="label" htmlFor="kind">For</label>
                    <select id="kind" name="kind" className="input"><option value="rent">Rent / monthly dues</option><option value="deposit">Security deposit</option><option value="other">Other</option></select>
                  </div>
                  <FIELD label="Amount (₹)" name="amount" type="number" required min={1} defaultValue={nextDue ? dueBalance(nextDue) : ""} />
                  <FIELD label="Paid on" name="paid_on" type="date" defaultValue={d.today} required />
                  <div>
                    <label className="label" htmlFor="mode">Mode</label>
                    <select id="mode" name="mode" className="input"><option>UPI</option><option>Cash</option><option>Bank transfer</option><option>Cheque</option></select>
                  </div>
                  <FIELD label="Reference" name="reference" placeholder="UTR / receipt no." />
                  <div>
                    <label className="label" htmlFor="account">Received into</label>
                    <select id="account" name="account" className="input">
                      <option value="">Cash in hand (rent collections, not yet banked)</option>
                      {propertyRefs.filter((r) => r.ref.startsWith("account:")).map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
                    </select>
                  </div>
                </div>
              </ActionForm>
            )}
          </Card>
          <Card title="Payment history" className="xl:col-span-3" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Date</th><th>For</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Received into</th></tr></thead>
              <tbody>
                {v.pays.map((p) => (
                  <tr key={p.id}><td>{fmtDate(p.paid_on)}</td><td className="capitalize">{p.kind}</td><td className={`tabular-nums ${p.kind === "refund" ? "text-red-600" : ""}`}>{p.kind === "refund" ? "−" : ""}{inr(Number(p.amount))}</td><td>{p.mode}</td><td className="text-xs">{p.reference ?? "—"}</td><td className="text-xs">{p.account_id ? refs.find((r) => r.ref === `account:${p.account_id}`)?.label : "Rent collections"}</td></tr>
                ))}
                {!v.pays.length && <tr><td colSpan={6} className="text-center text-muted">No payments yet</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "utilities" && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card title="Utility bills" className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Bill</th><th>Month</th><th>Meter</th><th>Previous</th><th>Current</th><th>Units</th><th>Amount</th><th>Paid by</th><th>Status</th></tr></thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id}><td className="capitalize">{b.utility}</td><td>{b.bill_month}</td><td className="text-xs">{b.meter_no ?? "—"}</td><td className="tabular-nums">{b.prev_reading ?? "—"}</td><td className="tabular-nums">{b.curr_reading ?? "—"}</td><td className="tabular-nums">{b.curr_reading != null && b.prev_reading != null ? Number(b.curr_reading) - Number(b.prev_reading) : "—"}</td><td className="tabular-nums">{inr(Number(b.amount))}</td><td className="capitalize">{b.payer}</td><td><StatusBadge status={b.status === "paid" ? "paid" : "pending"} /></td></tr>
                ))}
                {!bills.length && <tr><td colSpan={9} className="text-center text-muted">No bills yet</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="Add utility bill">
            <ActionForm action={utilityBillAction.bind(null, ended ? "" : t.id, t.unit_id)} submit="Add bill">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="utility">Utility</label>
                  <select id="utility" name="utility" className="input"><option value="electricity">Electricity</option><option value="water">Water</option><option value="gas">Gas</option><option value="internet">Internet</option><option value="other">Other</option></select>
                </div>
                <FIELD label="Bill month" name="bill_month" type="month" defaultValue={month} required />
                <FIELD label="Meter no." name="meter_no" defaultValue={bills[0]?.meter_no} />
                <FIELD label="Amount (₹)" name="amount" type="number" required min={0} />
                <FIELD label="Previous reading" name="prev_reading" type="number" step="0.01" defaultValue={bills[0]?.curr_reading ?? ""} />
                <FIELD label="Current reading" name="curr_reading" type="number" step="0.01" />
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="payer">Who pays</label>
                  <select id="payer" name="payer" className="input"><option value="tenant">Tenant — added to this month&apos;s rent due</option><option value="owner">Owner — booked as a property expense</option></select>
                </div>
              </div>
            </ActionForm>
          </Card>
        </div>
      )}

      {tab === "maintenance" && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card title="Maintenance & service requests" className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Request</th><th>Raised</th><th>Priority</th><th>Status</th><th>Cost</th><th>Update</th></tr></thead>
              <tbody>
                {maint.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.title}<div className="text-[11px] text-muted">{m.category}</div></td>
                    <td>{fmtDate(m.raised_on)}</td>
                    <td><Badge tone={m.priority === "urgent" || m.priority === "high" ? "red" : "slate"}>{titleCase(m.priority)}</Badge></td>
                    <td><Badge tone={m.status === "completed" ? "green" : m.status === "open" ? "amber" : "blue"}>{titleCase(m.status)}</Badge></td>
                    <td className="tabular-nums">{Number(m.cost) ? `${inr(Number(m.cost))} · ${m.charge_to}` : "—"}</td>
                    <td>
                      {m.status !== "completed" && m.status !== "cancelled" && (
                        <form action={maintenanceStatusAction.bind(null, m.id)} className="flex flex-wrap items-center gap-1">
                          <select name="status" aria-label="Status" className="input w-auto py-1 text-xs" defaultValue={m.status === "open" ? "in_progress" : "completed"}><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
                          <input name="cost" type="number" min={0} placeholder="Cost ₹" aria-label="Cost" className="input w-20 py-1 text-xs" />
                          <select name="charge_to" aria-label="Charge to" className="input w-auto py-1 text-xs"><option value="owner">Owner</option><option value="tenant">Tenant</option></select>
                          <button className="btn-navy py-1 text-xs">Save</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {!maint.length && <tr><td colSpan={6} className="text-center text-muted">No requests</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="Raise a request">
            <form action={maintenanceAction.bind(null, t.unit_id, ended ? "" : t.id)} className="grid gap-3">
              <FIELD label="Issue *" name="title" required placeholder="e.g. Water leakage in kitchen" />
              <div>
                <label className="label" htmlFor="category">Category</label>
                <select id="category" name="category" className="input"><option>Plumbing</option><option>Electrical</option><option>Painting</option><option>Carpentry</option><option>Appliance</option><option>Pest control</option><option>Other</option></select>
              </div>
              <div>
                <label className="label" htmlFor="priority">Priority</label>
                <select id="priority" name="priority" className="input" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>
              </div>
              <div>
                <label className="label" htmlFor="vendor_id">Vendor (optional)</label>
                <select id="vendor_id" name="vendor_id" className="input"><option value="">—</option>{d.vendors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              </div>
              <button className="btn-primary">Raise request</button>
              <p className="text-[11px] text-muted">When completed, the cost is booked as a property expense (owner) or added to the tenant&apos;s current due (tenant).</p>
            </form>
          </Card>
        </div>
      )}

      {tab === "deposit" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Security deposit">
            <dl>
              <Field label="Agreed deposit" value={inr(Number(t.security_deposit))} />
              <Field label="Received" value={inr(v.pays.filter((p) => p.kind === "deposit").reduce((a, p) => a + Number(p.amount), 0))} />
              <Field label="Refunded" value={inr(v.pays.filter((p) => p.kind === "refund").reduce((a, p) => a + Number(p.amount), 0))} />
              <Field label="Held now" value={<b>{inr(v.depositHeld)}</b>} />
              <Field label="Unpaid dues" value={inr(v.outstanding)} />
            </dl>
            {t.status === "active" && (
              <form action={noticeAction.bind(null, t.id)} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-3">
                <FIELD label="Tenant gave notice — expected exit date" name="exit_date" type="date" />
                <button className="btn-ghost">Mark on notice</button>
              </form>
            )}
          </Card>
          <Card title="Exit & settlement" icon={<LogOut size={15} />}>
            {ended ? (
              <dl>
                <Field label="Exit date" value={fmtDate(t.exit_date)} />
                <Field label="Deductions" value={inr(Number(t.deductions))} />
                <Field label="Refunded" value={inr(Number(t.refund_amount ?? 0))} />
                <Field label="Settled on" value={fmtDate(t.settled_on)} />
                <Field label="Note" value={t.settlement_note} />
              </dl>
            ) : (
              <ActionForm action={exitTenancyAction.bind(null, t.id)} submit="Close tenancy & settle" reset={false}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FIELD label="Exit date" name="exit_date" type="date" defaultValue={t.exit_date ?? d.today} required />
                  <FIELD label="Deductions (damages, cleaning) ₹" name="deductions" type="number" defaultValue={0} min={0} />
                  <div className="sm:col-span-2"><RefSelect name="refund_ref" label="Refund paid from" options={propertyRefs} defaultValue={propertyRefs[0]?.ref} /></div>
                  <div className="sm:col-span-2"><FIELD label="Settlement note" name="note" placeholder="Keys returned, meter reading noted…" /></div>
                </div>
                <p className="text-xs text-muted">Refund = deposit held ({inr(v.depositHeld)}) − deductions − unpaid dues ({inr(v.outstanding)}). The home becomes vacant.</p>
              </ActionForm>
            )}
          </Card>
        </div>
      )}

      {tab === "documents" && (
        <Card title="Documents" className="max-w-2xl">
          <ul className="space-y-2 text-sm">
            {docs.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2">
                <a href={`/api/tenant-documents/${x.id}`} target="_blank" className="font-medium text-navy hover:text-brand">{titleCase(x.kind)} <span className="text-xs font-normal text-muted">· {docFileName(x.storage_path)}</span></a>
                <Badge tone={x.verified ? "green" : "amber"}>{x.verified ? "Verified" : "Pending"}</Badge>
              </li>
            ))}
            {!docs.length && <li className="text-muted">No documents yet — add the agreement, ID proof, police verification and photos.</li>}
          </ul>
          <div className="mt-3 border-t border-line pt-3">
            <ActionForm action={uploadTenantDocAction.bind(null, tn.id)} submit="Upload">
              <div className="flex flex-wrap gap-2">
                <select name="kind" aria-label="Document type" className="input w-auto"><option value="agreement">Rental agreement</option><option value="id_proof">ID proof</option><option value="police_verification">Police verification</option><option value="photo">Photo</option><option value="other">Other</option></select>
                <input name="file" type="file" required aria-label="File" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="min-w-0 flex-1 text-xs" />
              </div>
            </ActionForm>
          </div>
        </Card>
      )}

      {tab === "history" && (
        <Card title="History" bodyClass="p-0">
          <table className="table">
            <thead><tr><th>Date</th><th>Event</th></tr></thead>
            <tbody>
              {[
                ...v.pays.map((p) => ({ date: p.paid_on, text: `${titleCase(p.kind)} ${p.kind === "refund" ? "paid out" : "received"}: ${inr(Number(p.amount))} (${p.mode})` })),
                ...v.dues.map((r) => ({ date: r.due_date, text: `Rent due raised for ${r.period}: ${inr(dueTotal(r))}` })),
                ...maint.map((m) => ({ date: m.raised_on, text: `Maintenance request: ${m.title} (${m.status})` })),
                ...bills.map((b) => ({ date: `${b.bill_month}-01`, text: `${titleCase(b.utility)} bill ${b.bill_month}: ${inr(Number(b.amount))} (${b.payer})` })),
                { date: t.start_date, text: `Tenancy started (${t.agreement_no ?? "agreement"})` },
                ...(t.exit_date && ended ? [{ date: t.exit_date, text: `Tenancy ended; refund ${inr(Number(t.refund_amount ?? 0))}` }] : []),
              ]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((e, i) => <tr key={i}><td className="whitespace-nowrap">{fmtDate(e.date)}</td><td>{e.text}</td></tr>)}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
