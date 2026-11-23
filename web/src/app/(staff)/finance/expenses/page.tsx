import { Plus, Repeat } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/finance-ui";
import { Bar, EntityBadge, FIELD, Kpi } from "@/components/finance-bits";
import { I, Row, Save } from "@/components/form-bits";
import { Badge, Card, PageHeader } from "@/components/ui";
import { expenseLines, monthOf, sumLines } from "@/lib/finance";
import { fmtDate, inr, titleCase } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { getSession } from "@/lib/session";
import { APPROVAL_THRESHOLD, ENTITIES, ENTITY_LABEL, EXPENSE_CATEGORIES, EXPENSE_VIEWS, type Entity } from "@/lib/types-finance";
import { addExpenseAction, decideExpenseAction, generateRecurringAction, saveFinanceRow } from "../actions";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const viewKey = typeof sp.view === "string" && EXPENSE_VIEWS[sp.view] ? sp.view : "all";
  const view = EXPENSE_VIEWS[viewKey];
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const [d, me] = await Promise.all([(await getFinance()).load(), getSession()]);
  const superAdmin = me?.role === "super_admin";

  const match = (entity: Entity, category: string) => (!view.entity || entity === view.entity) && (!view.categories || view.categories.includes(category));
  const rows = d.expenses.filter((e) => match(e.entity, e.category) && (!month || monthOf(e.expense_date) === month) && (!status || e.status === status));
  const lines = expenseLines(d).filter((l) => match(l.entity, l.category));
  const thisMonth = monthOf(d.today);
  const monthTotal = sumLines(lines, (l) => monthOf(l.date) === thisMonth);
  const pending = d.expenses.filter((e) => e.status === "pending_approval" && match(e.entity, e.category));
  const unpaid = d.expenses.filter((e) => e.status === "approved" && match(e.entity, e.category));
  const byCat = new Map<string, number>();
  for (const l of lines.filter((x) => monthOf(x.date) === thisMonth)) byCat.set(l.category, (byCat.get(l.category) ?? 0) + l.amount);
  const maxCat = Math.max(1, ...byCat.values());
  const vendorName = new Map(d.vendors.map((v) => [v.id, v.name]));
  const months = [...new Set(d.expenses.map((e) => monthOf(e.expense_date)))].sort().reverse().slice(0, 6);
  const q = (k: string, v: string) => { const p = new URLSearchParams({ view: viewKey, ...(month ? { month } : {}), ...(status ? { status } : {}) }); if (v) p.set(k, v); else p.delete(k); return `/finance/expenses?${p}`; };

  return (
    <>
      <PageHeader title={view.label} subtitle="Every bill and spend across MasterVLSI, Enrich Silicon and the rental property. Pay any bill from one or several accounts." />
      <div className="mb-4 flex flex-wrap gap-1 text-xs">
        {Object.entries(EXPENSE_VIEWS).map(([k, v]) => <Link key={k} href={`/finance/expenses?view=${k}`} className={`rounded-[5px] border px-2.5 py-1 ${k === viewKey ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-navy"}`}>{v.label}</Link>)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Spent this month" value={monthTotal} tone="red" hint="includes payroll" />
        <Kpi label="Waiting for approval" value={pending.reduce((a, e) => a + Number(e.amount), 0)} tone="amber" hint={`${pending.length} bill(s) over ${inr(APPROVAL_THRESHOLD)}`} />
        <Kpi label="Approved, not yet paid" value={unpaid.reduce((a, e) => a + Number(e.amount) - Number(e.paid_amount), 0)} tone="violet" hint={`${unpaid.length} bill(s)`} />
        <Kpi label="Recurring per month (approx.)" value={d.recurring.filter((r) => r.active && match(r.entity, r.category)).reduce((a, r) => a + Number(r.amount) / (r.frequency === "monthly" ? 1 : r.frequency === "quarterly" ? 3 : 12), 0)} tone="blue" />
      </div>

      {pending.length > 0 && (
        <Card title={`Waiting for approval (${pending.length})`} className="mt-5" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Entity</th><th>Description</th><th>Payee</th><th>Amount</th><th>Added by</th><th /></tr></thead>
            <tbody>
              {pending.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.expense_date)}</td><td><EntityBadge entity={e.entity} /></td><td className="font-medium">{e.description}<div className="text-[11px] text-muted">{e.category}</div></td>
                  <td>{e.payee ?? vendorName.get(e.vendor_id ?? "") ?? "—"}</td><td className="font-semibold tabular-nums">{inr(Number(e.amount))}</td><td className="text-xs">{e.created_by}</td>
                  <td>{superAdmin ? (
                    <div className="flex gap-1">
                      <form action={decideExpenseAction.bind(null, e.id, true)}><button className="btn py-1 text-xs border border-emerald-300 bg-emerald-50 text-emerald-800">Approve</button></form>
                      <form action={decideExpenseAction.bind(null, e.id, false)}><button className="btn py-1 text-xs border border-red-200 bg-red-50 text-red-600">Reject</button></form>
                    </div>
                  ) : <span className="text-xs text-muted">Super admin approves</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card
          title="Expenses"
          className="xl:col-span-2"
          bodyClass="p-0 overflow-x-auto"
          actions={
            <div className="flex flex-wrap gap-1 text-xs">
              <Link href={q("month", "")} className={`rounded px-2 py-0.5 ${!month ? "bg-white text-navy" : "text-white/80"}`}>All</Link>
              {months.map((m) => <Link key={m} href={q("month", m)} className={`rounded px-2 py-0.5 ${month === m ? "bg-white text-navy" : "text-white/80"}`}>{m}</Link>)}
              <span className="text-white/40">|</span>
              {["approved", "paid"].map((s) => <Link key={s} href={q("status", status === s ? "" : s)} className={`rounded px-2 py-0.5 capitalize ${status === s ? "bg-white text-navy" : "text-white/80"}`}>{s === "approved" ? "Unpaid" : "Paid"}</Link>)}
            </div>
          }
        >
          <table className="table">
            <thead><tr><th>Date</th><th>Entity</th><th>Category</th><th>Description</th><th>Payee</th><th>Amount</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.slice(0, 120).map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                  <td><EntityBadge entity={e.entity} /></td>
                  <td className="text-xs">{e.category}</td>
                  <td>{e.description}{e.invoice_no && <div className="text-[11px] text-muted">Invoice {e.invoice_no}</div>}{e.recurring_id && <Badge tone="blue">Recurring</Badge>}</td>
                  <td className="text-xs">{e.payee ?? vendorName.get(e.vendor_id ?? "") ?? "—"}</td>
                  <td className="tabular-nums">{inr(Number(e.amount))}{Number(e.paid_amount) > 0 && Number(e.paid_amount) < Number(e.amount) && <div className="text-[11px] text-muted">paid {inr(Number(e.paid_amount))}</div>}</td>
                  <td><Badge tone={e.status === "paid" ? "green" : e.status === "approved" ? "violet" : e.status === "rejected" ? "slate" : "amber"}>{e.status === "approved" ? "Unpaid" : titleCase(e.status)}</Badge></td>
                  <td>{e.status === "approved" && <Link href={`/finance/pay?expense=${e.id}`} className="text-xs font-medium text-navy underline">Pay</Link>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="text-center text-muted">No expenses here</td></tr>}
            </tbody>
          </table>
        </Card>

        <div className="space-y-5">
          <Card title="Record expense / bill" icon={<Plus size={15} />}>
            <ActionForm action={addExpenseAction} submit="Save expense">
              <div className="grid gap-3">
                <div>
                  <label className="label" htmlFor="entity">Entity *</label>
                  <select id="entity" name="entity" className="input" defaultValue={view.entity ?? "mastervlsi"}>{ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_LABEL[e]}</option>)}</select>
                </div>
                <div>
                  <label className="label" htmlFor="category">Category *</label>
                  <select id="category" name="category" className="input" defaultValue={view.categories?.[0] ?? "Office & operational"}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                </div>
                <FIELD label="Description *" name="description" required placeholder="e.g. Electrical wiring — lab" />
                <div className="grid grid-cols-2 gap-2">
                  <FIELD label="Amount (₹) *" name="amount" type="number" required min={1} />
                  <FIELD label="Date" name="expense_date" type="date" defaultValue={d.today} />
                </div>
                <div>
                  <label className="label" htmlFor="vendor_id">Vendor</label>
                  <select id="vendor_id" name="vendor_id" className="input"><option value="">— (type payee below)</option>{d.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
                </div>
                <FIELD label="Payee" name="payee" placeholder="ABC Electricals" />
                <div className="grid grid-cols-2 gap-2">
                  <FIELD label="Invoice no." name="invoice_no" />
                  <FIELD label="Pay by" name="due_date" type="date" />
                </div>
                <div>
                  <label className="label" htmlFor="unit_id">Home (property expenses)</label>
                  <select id="unit_id" name="unit_id" className="input"><option value="">—</option>{d.units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select>
                </div>
                <p className="text-[11px] text-muted">Bills over {inr(APPROVAL_THRESHOLD)} wait for a super admin&apos;s approval{superAdmin ? " (yours are approved straight away)" : ""}.</p>
              </div>
            </ActionForm>
          </Card>

          <Card title="This month by category">
            <ul className="space-y-2 text-sm">
              {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <li key={c}><div className="flex justify-between"><span>{c}</span><span className="tabular-nums">{inr(v)}</span></div><Bar value={v} max={maxCat} tone="bg-red-500" /></li>
              ))}
              {!byCat.size && <li className="text-muted">Nothing spent yet this month</li>}
            </ul>
          </Card>
        </div>

        <Card
          title="Recurring payments"
          icon={<Repeat size={15} />}
          className="xl:col-span-3"
          actions={
            <form action={async () => { "use server"; await generateRecurringAction(); }}>
              <button className="rounded bg-white/15 px-2 py-0.5 text-xs hover:bg-white/25">Create bills that are due now</button>
            </form>
          }
        >
          <div className="mb-1 hidden grid-cols-[8rem_10rem_1fr_7rem_7rem_8rem_auto] gap-2 text-[11px] font-medium text-muted lg:grid">
            <span>Entity</span><span>Category</span><span>Description</span><span>Amount</span><span>Frequency</span><span>Next due</span><span />
          </div>
          {d.recurring.filter((r) => match(r.entity, r.category)).map((r) => (
            <Row key={r.id} action={saveFinanceRow.bind(null, "recurring_payments")}>
              <input type="hidden" name="id" value={r.id} />
              <select name="entity" defaultValue={r.entity} aria-label="Entity" className="input w-32 py-1.5">{ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_LABEL[e].split(" (")[0]}</option>)}</select>
              <select name="category" defaultValue={r.category} aria-label="Category" className="input w-40 py-1.5">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              <I name="description" value={r.description} w="min-w-40 flex-1" required placeholder="Description" />
              <I name="amount" type="number" value={r.amount} w="w-28" required placeholder="Amount" />
              <select name="frequency" defaultValue={r.frequency} aria-label="Frequency" className="input w-28 py-1.5"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select>
              <I name="next_due" type="date" value={r.next_due} w="w-36" required placeholder="Next due" />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={r.active} /> Active</label>
              <Save />
            </Row>
          ))}
          <Row action={saveFinanceRow.bind(null, "recurring_payments")}>
            <select name="entity" defaultValue={view.entity ?? "mastervlsi"} aria-label="Entity" className="input w-32 py-1.5">{ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_LABEL[e].split(" (")[0]}</option>)}</select>
            <select name="category" defaultValue={view.categories?.[0] ?? "Rent / office building"} aria-label="Category" className="input w-40 py-1.5">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <I name="description" w="min-w-40 flex-1" required placeholder="New recurring payment, e.g. Office rent" />
            <I name="amount" type="number" w="w-28" required placeholder="Amount" />
            <select name="frequency" aria-label="Frequency" className="input w-28 py-1.5"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select>
            <I name="next_due" type="date" value={d.today} w="w-36" required placeholder="Next due" />
            <input type="hidden" name="active" value="on" />
            <Save label="+ Add" />
          </Row>
          <p className="mt-2 text-xs text-muted">The daily job turns due recurring payments into approved bills automatically; use the button to do it now.</p>
        </Card>
      </div>
    </>
  );
}
