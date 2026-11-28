import { CheckCircle2, Home, Plus } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/finance-ui";
import { FIELD, Kpi, RefSelect } from "@/components/finance-bits";
import { I, Row, Save } from "@/components/form-bits";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { balanceSheet, dueBalance, monthOf, tenancyView } from "@/lib/finance";
import { inr } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { addTenantAction, raiseDuesAction, saveFinanceRow } from "../actions";

export const metadata = { title: "Rental income — tenants" };

const MAINTAIN = [
  "Tenant basic details & KYC",
  "Property / unit details",
  "Rental agreement details",
  "Monthly rent & due date",
  "Security deposit (advance)",
  "Utility details (electricity, water)",
  "Maintenance / repair requests",
  "Payments & receipts history",
  "Outstanding / dues",
  "Exit & settlement / refund",
  "All related documents",
];

export default async function TenantsPage() {
  const d = await (await getFinance()).load();
  const month = monthOf(d.today);
  const occupied = d.tenancies.filter((t) => t.status !== "ended");
  const views = occupied.map((t) => tenancyView(d, t));
  const byUnit = new Map(views.map((v) => [v.t.unit_id, v]));
  const dueThisMonth = views.reduce((a, v) => a + (v.current ? dueBalance(v.current) + Number(v.current.paid) : 0), 0);
  const collectedThisMonth = d.tenantPayments.filter((p) => p.kind !== "deposit" && p.kind !== "refund" && monthOf(p.paid_on) === month).reduce((a, p) => a + Number(p.amount), 0);
  const outstanding = views.reduce((a, v) => a + v.outstanding, 0);
  const deposits = views.reduce((a, v) => a + v.depositHeld, 0);
  const vacant = d.units.filter((u) => !byUnit.has(u.id));
  const refs = balanceSheet(d).filter((r) => r.entity === "property");

  return (
    <>
      <PageHeader
        title="Rental income — tenants"
        subtitle="Every home, its tenant, agreement, monthly rent, deposit, utilities, maintenance, payments and exit settlement."
        actions={
          <form action={async () => { "use server"; await raiseDuesAction(); }}>
            <button className="btn-ghost">Raise this month&apos;s rent dues</button>
          </form>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Homes" value={d.units.length} hint={`${occupied.length} occupied · ${vacant.length} vacant`} />
        <Kpi label="Rent billed this month" value={dueThisMonth} tone="blue" />
        <Kpi label="Collected this month" value={collectedThisMonth} tone="green" />
        <Kpi label="Outstanding" value={outstanding} tone="red" />
        <Kpi label="Security deposits held" value={deposits} tone="violet" />
        <Stat label="Tenants with overdue rent" value={views.filter((v) => v.overdue.length).length} tone="amber" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title={`Rental income — tenants (${d.units.length} homes)`} icon={<Home size={15} />} className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>#</th><th>Home</th><th>Tenant</th><th>Monthly rent</th><th>Due day</th><th>This month</th><th>Outstanding</th><th /></tr></thead>
            <tbody>
              {d.units.map((u, i) => {
                const v = byUnit.get(u.id);
                if (!v) return (
                  <tr key={u.id} className="text-muted">
                    <td>{i + 1}</td><td className="font-medium text-ink">{u.code}</td><td colSpan={5} className="text-center italic">— Vacant —</td><td />
                  </tr>
                );
                const cur = v.current;
                const state = !cur ? "—" : dueBalance(cur) === 0 ? "Paid" : cur.due_date < d.today ? "Overdue" : Number(cur.paid) > 0 ? "Partial" : "Due";
                return (
                  <tr key={u.id}>
                    <td>{i + 1}</td>
                    <td className="font-medium">{u.code}<div className="text-[11px] text-muted">{u.unit_type}</div></td>
                    <td><Link href={`/finance/tenants/${v.t.id}`} className="font-medium text-navy hover:text-brand">{v.tenant.full_name}</Link><div className="text-[11px] text-muted">{v.tenant.phone}</div></td>
                    <td className="tabular-nums">{inr(Number(v.t.monthly_rent))}</td>
                    <td>{v.t.due_day}th</td>
                    <td><Badge tone={state === "Paid" ? "green" : state === "Overdue" ? "red" : state === "Partial" ? "amber" : "slate"}>{state}</Badge></td>
                    <td className={`tabular-nums ${v.outstanding ? "text-red-600" : ""}`}>{inr(v.outstanding)}</td>
                    <td><Link href={`/finance/tenants/${v.t.id}`} className="text-xs text-navy underline">Open record</Link>{v.t.status === "notice" && <Badge tone="amber">Notice</Badge>}</td>
                  </tr>
                );
              })}
              {!d.units.length && <tr><td colSpan={8} className="text-center text-muted">Add a property and its homes below to start.</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card title="What to maintain against each tenant" icon={<CheckCircle2 size={15} />}>
          <ul className="space-y-1.5 text-sm">
            {MAINTAIN.map((m) => <li key={m} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />{m}</li>)}
          </ul>
          <p className="mt-3 text-xs text-muted">One-time setup per tenant, then monthly tracking of rent, bills, maintenance, payments and documents.</p>
        </Card>

        <Card title="Add tenant" icon={<Plus size={15} />} className="xl:col-span-2">
            <ActionForm action={addTenantAction} submit="Add tenant">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="unit_id">Home / unit *</label>
                  <select id="unit_id" name="unit_id" defaultValue={vacant[0]?.id ?? "__new"} className="input">
                    {vacant.map((u) => <option key={u.id} value={u.id}>{u.code}{u.unit_type ? ` · ${u.unit_type}` : ""}</option>)}
                    <option value="__new">+ New home (fill in below)</option>
                  </select>
                </div>
                <FIELD label="Tenant full name *" name="full_name" required />
                <FIELD label="Mobile" name="phone" />
                <FIELD label="Email" name="email" type="email" />
                <div>
                  <label className="label" htmlFor="id_proof_type">ID proof</label>
                  <select id="id_proof_type" name="id_proof_type" className="input"><option>Aadhaar</option><option>PAN</option><option>Passport</option><option>Driving licence</option><option>Voter ID</option></select>
                </div>
                <FIELD label="ID proof number" name="id_proof_no" />
                <FIELD label="Occupation" name="occupation" />
                <FIELD label="Family members" name="family_members" type="number" min={1} />
                <FIELD label="Permanent address" name="permanent_address" />
                <FIELD label="Emergency contact name" name="emergency_name" />
                <FIELD label="Emergency contact mobile" name="emergency_phone" />
                <div className="flex items-end gap-4 pb-2 text-sm">
                  <label className="flex items-center gap-1.5"><input type="checkbox" name="kyc_verified" /> KYC verified</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" name="police_verified" /> Police verified</label>
                </div>
              </div>
              <div className="rounded-[5px] border border-dashed border-line bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold text-muted uppercase">New home {vacant.length ? "(only when “+ New home” is chosen above)" : "— no vacant homes yet, add it here"}</div>
                <div className="grid gap-3 sm:grid-cols-5">
                  <div>
                    <label className="label" htmlFor="new_property_id">Property</label>
                    <select id="new_property_id" name="new_property_id" defaultValue={d.properties[0]?.id ?? "__new"} className="input">
                      {d.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="__new">+ New property</option>
                    </select>
                  </div>
                  <FIELD label="New property name" name="new_property_name" placeholder="e.g. Vijayanagar Homes" />
                  <FIELD label="City" name="new_property_city" placeholder="Mysuru" />
                  <FIELD label="Home name / no. *" name="new_unit_code" placeholder="Home 01" />
                  <FIELD label="Type" name="new_unit_type" placeholder="2BHK" />
                </div>
              </div>
              <div className="border-t border-line pt-3 text-xs font-semibold text-muted uppercase">Agreement & rent</div>
              <div className="grid gap-3 sm:grid-cols-4">
                <FIELD label="Agreement no." name="agreement_no" placeholder="RENT-007" />
                <FIELD label="Start date *" name="start_date" type="date" required defaultValue={d.today} />
                <FIELD label="End date" name="end_date" type="date" />
                <FIELD label="Monthly rent (₹) *" name="monthly_rent" type="number" required min={1} />
                <FIELD label="Rent due day (1–28)" name="due_day" type="number" defaultValue={5} min={1} />
                <FIELD label="Maintenance / month (₹)" name="maintenance_charge" type="number" defaultValue={0} min={0} />
                <FIELD label="Security deposit (₹)" name="security_deposit" type="number" defaultValue={0} min={0} />
                <FIELD label="Yearly escalation %" name="escalation_pct" type="number" step="0.5" defaultValue={5} />
                <FIELD label="Notice period (days)" name="notice_days" type="number" defaultValue={30} />
                <FIELD label="Deposit received now (₹)" name="deposit_received" type="number" defaultValue={0} min={0} />
                <div>
                  <label className="label" htmlFor="deposit_mode">Deposit mode</label>
                  <select id="deposit_mode" name="deposit_mode" className="input"><option>Bank transfer</option><option>UPI</option><option>Cash</option><option>Cheque</option></select>
                </div>
                <RefSelect name="deposit_account" label="Deposit received into" options={refs.filter((r) => r.ref.startsWith("account:"))} />
              </div>
            </ActionForm>
        </Card>

        <Card title="Properties & homes">
          {d.properties.map((p) => (
            <div key={p.id} className="mb-3 rounded-[5px] border border-line p-2">
              <Row action={saveFinanceRow.bind(null, "properties")}>
                <input type="hidden" name="id" value={p.id} />
                <I name="name" value={p.name} w="flex-1 font-medium" required placeholder="Property name" />
                <I name="city" value={p.city} w="w-28" placeholder="City" />
                <Save />
              </Row>
              {d.units.filter((u) => u.property_id === p.id).map((u) => (
                <Row key={u.id} action={saveFinanceRow.bind(null, "property_units")}>
                  <input type="hidden" name="id" value={u.id} />
                  <I name="code" value={u.code} w="w-24" required placeholder="Home code" />
                  <I name="unit_type" value={u.unit_type} w="w-20" placeholder="Type" />
                  <I name="floor" value={u.floor} w="w-20" placeholder="Floor" />
                  <Save />
                </Row>
              ))}
              <Row action={saveFinanceRow.bind(null, "property_units")}>
                <input type="hidden" name="property_id" value={p.id} />
                <input type="hidden" name="status" value="vacant" />
                <I name="code" w="w-24" required placeholder="Home 07" />
                <I name="unit_type" w="w-20" placeholder="2BHK" />
                <I name="floor" w="w-20" placeholder="Floor" />
                <Save label="+ Home" />
              </Row>
            </div>
          ))}
          <Row action={saveFinanceRow.bind(null, "properties")}>
            <I name="name" w="flex-1" required placeholder="New property name" />
            <I name="city" w="w-28" placeholder="City" />
            <Save label="+ Property" />
          </Row>
        </Card>
      </div>
    </>
  );
}
