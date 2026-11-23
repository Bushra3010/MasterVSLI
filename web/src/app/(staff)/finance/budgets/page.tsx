import Link from "next/link";
import { Bar, EntityBadge } from "@/components/finance-bits";
import { I, Row, Save } from "@/components/form-bits";
import { Badge, Card, PageHeader } from "@/components/ui";
import { expenseLines, lastMonths, monthOf } from "@/lib/finance";
import { fmtDate, inr } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { getSession } from "@/lib/session";
import { APPROVAL_THRESHOLD, ENTITIES, ENTITY_LABEL, EXPENSE_CATEGORIES } from "@/lib/types-finance";
import { decideExpenseAction, saveFinanceRow } from "../actions";

export const metadata = { title: "Budgets & approvals" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [d, me] = await Promise.all([(await getFinance()).load(), getSession()]);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : monthOf(d.today);
  const lines = expenseLines(d).filter((l) => monthOf(l.date) === month);
  const budgets = d.budgets.filter((b) => b.month === month);
  const rows = budgets.map((b) => {
    const actual = lines.filter((l) => l.entity === b.entity && l.category === b.category).reduce((a, l) => a + l.amount, 0);
    return { b, actual, pct: Number(b.amount) ? (100 * actual) / Number(b.amount) : 0 };
  });
  const unbudgeted = new Map<string, number>();
  for (const l of lines) if (!budgets.some((b) => b.entity === l.entity && b.category === l.category)) unbudgeted.set(`${l.entity}|${l.category}`, (unbudgeted.get(`${l.entity}|${l.category}`) ?? 0) + l.amount);
  const pending = d.expenses.filter((e) => e.status === "pending_approval");
  const decided = d.expenses.filter((e) => e.approved_at && (e.status === "rejected" || Number(e.amount) > APPROVAL_THRESHOLD)).sort((a, b) => (b.approved_at ?? "").localeCompare(a.approved_at ?? "")).slice(0, 10);
  const superAdmin = me?.role === "super_admin";

  return (
    <>
      <PageHeader title="Budgets & approvals" subtitle={`Monthly budgets per entity and category against actual spend. Bills over ${inr(APPROVAL_THRESHOLD)} need a super admin's approval before they can be paid.`} />
      <div className="mb-4 flex flex-wrap gap-1 text-xs">
        {lastMonths(d.today, 6).reverse().map((m) => <Link key={m} href={`/finance/budgets?month=${m}`} className={`rounded-[5px] border px-2.5 py-1 ${m === month ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{m}</Link>)}
      </div>

      <Card title={`Approval queue (${pending.length})`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Entity</th><th>Description</th><th>Payee</th><th>Amount</th><th>Added by</th><th /></tr></thead>
          <tbody>
            {pending.map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.expense_date)}</td><td><EntityBadge entity={e.entity} /></td><td className="font-medium">{e.description}<div className="text-[11px] text-muted">{e.category}{e.invoice_no ? ` · ${e.invoice_no}` : ""}</div></td>
                <td>{e.payee ?? "—"}</td><td className="font-semibold tabular-nums">{inr(Number(e.amount))}</td><td className="text-xs">{e.created_by}</td>
                <td>{superAdmin ? (
                  <div className="flex gap-1">
                    <form action={decideExpenseAction.bind(null, e.id, true)}><button className="btn py-1 text-xs border border-emerald-300 bg-emerald-50 text-emerald-800">Approve</button></form>
                    <form action={decideExpenseAction.bind(null, e.id, false)}><button className="btn py-1 text-xs border border-red-200 bg-red-50 text-red-600">Reject</button></form>
                  </div>
                ) : <span className="text-xs text-muted">Super admin approves</span>}</td>
              </tr>
            ))}
            {!pending.length && <tr><td colSpan={7} className="text-center text-muted">Nothing waiting for approval</td></tr>}
          </tbody>
        </table>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title={`Budget vs actual — ${month}`} className="xl:col-span-2">
          <ul className="space-y-3 text-sm">
            {rows.map(({ b, actual, pct }) => (
              <li key={b.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><EntityBadge entity={b.entity} /> {b.category}</span>
                  <span className="tabular-nums">{inr(actual)} <span className="text-muted">/ {inr(Number(b.amount))}</span> {pct > 100 ? <Badge tone="red">Over by {inr(actual - Number(b.amount))}</Badge> : pct > 85 ? <Badge tone="amber">{Math.round(pct)}%</Badge> : <Badge tone="green">{Math.round(pct)}%</Badge>}</span>
                </div>
                <Bar value={actual} max={Math.max(Number(b.amount), actual)} tone={pct > 100 ? "bg-brand" : pct > 85 ? "bg-amber-500" : "bg-emerald-500"} />
              </li>
            ))}
            {!rows.length && <li className="text-muted">No budgets set for {month}. Add them on the right.</li>}
          </ul>
          {unbudgeted.size > 0 && (
            <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
              Spent without a budget: {[...unbudgeted.entries()].map(([k, v]) => `${k.split("|")[1]} (${ENTITY_LABEL[k.split("|")[0] as "mastervlsi"].split(" (")[0]}) ${inr(v)}`).join(" · ")}
            </div>
          )}
        </Card>
        <Card title="Set budgets">
          {budgets.map((b) => (
            <Row key={b.id} action={saveFinanceRow.bind(null, "budgets")}>
              <input type="hidden" name="id" value={b.id} />
              <span className="min-w-0 flex-1 text-xs">{ENTITY_LABEL[b.entity].split(" (")[0]} · {b.category}</span>
              <I name="amount" type="number" value={b.amount} w="w-28" placeholder="₹" />
              <Save />
            </Row>
          ))}
          <Row action={saveFinanceRow.bind(null, "budgets")}>
            <input type="hidden" name="month" value={month} />
            <select name="entity" aria-label="Entity" className="input w-full py-1.5">{ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_LABEL[e]}</option>)}</select>
            <select name="category" aria-label="Category" className="input w-full py-1.5">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <I name="amount" type="number" w="w-32" required placeholder="Budget ₹" />
            <Save label="+ Budget" />
          </Row>
        </Card>
        {decided.length > 0 && (
          <Card title="Recent decisions" className="xl:col-span-3" bodyClass="p-0">
            <table className="table">
              <tbody>
                {decided.map((e) => <tr key={e.id}><td>{e.description}</td><td className="tabular-nums">{inr(Number(e.amount))}</td><td><Badge tone={e.status === "rejected" ? "slate" : "green"}>{e.status === "rejected" ? "Rejected" : "Approved"}</Badge></td><td className="text-xs text-muted">{e.approved_by} · {fmtDate(e.approved_at)}</td></tr>)}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  );
}
