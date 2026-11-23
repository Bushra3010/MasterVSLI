import Link from "next/link";
import { Download } from "lucide-react";
import { EntityBadge } from "@/components/finance-bits";
import { Card, PageHeader } from "@/components/ui";
import { expenseLines, financialYear, incomeLines, lastMonths, monthOf, sumLines } from "@/lib/finance";
import { inr } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { ENTITIES, ENTITY_SHORT } from "@/lib/types-finance";

export const metadata = { title: "Reports & MIS" };

export default async function ReportsPage() {
  const d = await (await getFinance()).load();
  const fy = financialYear(d.today);
  const inc = incomeLines(d);
  const exp = expenseLines(d);
  const months = lastMonths(d.today, 12).filter((m) => m >= fy.from.slice(0, 7));
  const inFy = (l: { date: string }) => l.date >= fy.from && l.date <= fy.to;
  const cats = new Map<string, Map<string, number>>();
  for (const l of exp.filter(inFy)) {
    const m = cats.get(l.category) ?? new Map();
    m.set(l.entity, (m.get(l.entity) ?? 0) + l.amount);
    cats.set(l.category, m);
  }

  return (
    <>
      <PageHeader
        title="Reports & MIS"
        subtitle={`Financial year ${fy.label} (April–March). Income is counted when received; expenses on their bill date (pending approvals and rejected bills excluded); payroll is included.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {[["pnl", "P&L by month"], ["income", "Income"], ["expenses", "Expenses"], ["receivables", "Receivables & payables"]].map(([k, l]) => (
              <a key={k} href={`/api/export/finance?type=${k}`} className="btn-ghost text-xs"><Download size={13} /> {l} (Excel)</a>
            ))}
          </div>
        }
      />
      <Card title={`Entity-wise P&L — FY ${fy.label}`} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Entity</th><th className="text-right">Income</th><th className="text-right">Expenses</th><th className="text-right">Profit / loss</th><th className="text-right">Margin</th></tr></thead>
          <tbody>
            {ENTITIES.map((e) => {
              const i = sumLines(inc, (l) => l.entity === e && inFy(l));
              const x = sumLines(exp, (l) => l.entity === e && inFy(l));
              return <tr key={e}><td><EntityBadge entity={e} /></td><td className="text-right tabular-nums">{inr(i)}</td><td className="text-right tabular-nums">{inr(x)}</td><td className={`text-right font-semibold tabular-nums ${i - x < 0 ? "text-red-600" : "text-emerald-700"}`}>{inr(i - x)}</td><td className="text-right tabular-nums">{i ? `${Math.round((100 * (i - x)) / i)}%` : "—"}</td></tr>;
            })}
            <tr className="font-semibold"><td>Total</td><td className="text-right tabular-nums">{inr(sumLines(inc, inFy))}</td><td className="text-right tabular-nums">{inr(sumLines(exp, inFy))}</td><td className="text-right tabular-nums">{inr(sumLines(inc, inFy) - sumLines(exp, inFy))}</td><td /></tr>
          </tbody>
        </table>
      </Card>

      <Card title="Month by month (all entities)" className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Month</th>{ENTITIES.map((e) => <th key={e} className="text-right">{ENTITY_SHORT[e]} net</th>)}<th className="text-right">Income</th><th className="text-right">Expenses</th><th className="text-right">Net</th></tr></thead>
          <tbody>
            {months.map((m) => {
              const i = sumLines(inc, (l) => monthOf(l.date) === m);
              const x = sumLines(exp, (l) => monthOf(l.date) === m);
              return (
                <tr key={m}>
                  <td className="font-medium">{m}</td>
                  {ENTITIES.map((e) => { const v = sumLines(inc, (l) => l.entity === e && monthOf(l.date) === m) - sumLines(exp, (l) => l.entity === e && monthOf(l.date) === m); return <td key={e} className={`text-right tabular-nums ${v < 0 ? "text-red-600" : ""}`}>{inr(v)}</td>; })}
                  <td className="text-right tabular-nums">{inr(i)}</td><td className="text-right tabular-nums">{inr(x)}</td><td className={`text-right font-semibold tabular-nums ${i - x < 0 ? "text-red-600" : "text-emerald-700"}`}>{inr(i - x)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title={`Expenses by category — FY ${fy.label}`} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Category</th>{ENTITIES.map((e) => <th key={e} className="text-right">{ENTITY_SHORT[e]}</th>)}<th className="text-right">Total</th></tr></thead>
          <tbody>
            {[...cats.entries()].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0)).map(([c, m]) => (
              <tr key={c}><td>{c}</td>{ENTITIES.map((e) => <td key={e} className="text-right tabular-nums">{m.get(e) ? inr(m.get(e)!) : "—"}</td>)}<td className="text-right font-semibold tabular-nums">{inr([...m.values()].reduce((x, y) => x + y, 0))}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted">Need more detail? <Link href="/finance/receivables" className="underline">Receivables & payables</Link> · <Link href="/finance/accounts" className="underline">Account statements</Link></p>
    </>
  );
}
