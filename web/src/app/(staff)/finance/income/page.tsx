import Link from "next/link";
import { ActionForm } from "@/components/finance-ui";
import { Bar, FIELD, Kpi, RefSelect } from "@/components/finance-bits";
import { Card, PageHeader } from "@/components/ui";
import { balanceSheet, financialYear, incomeLines, monthOf, sumLines } from "@/lib/finance";
import { fmtDate, inr } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { ENTITIES, ENTITY_LABEL, type Entity } from "@/lib/types-finance";
import { addIncomeAction } from "../actions";

export const metadata = { title: "Income" };

const SOURCES: Record<Entity, string> = {
  mastervlsi: "Student fees (from Fees Management) plus any other income recorded here.",
  enrich: "Paid project / service invoices (from Enrich Silicon) plus any other income recorded here.",
  property: "Rent, utilities and maintenance recovered from tenants (from Rental Income).",
};

export default async function IncomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const entity: Entity = ENTITIES.includes(sp.entity as Entity) ? (sp.entity as Entity) : "mastervlsi";
  const d = await (await getFinance()).load();
  const fy = financialYear(d.today);
  const month = monthOf(d.today);
  const lines = incomeLines(d).filter((l) => l.entity === entity).sort((a, b) => b.date.localeCompare(a.date));
  const byCat = new Map<string, number>();
  for (const l of lines.filter((x) => x.date >= fy.from && x.date <= fy.to)) byCat.set(l.category, (byCat.get(l.category) ?? 0) + l.amount);
  const max = Math.max(1, ...byCat.values());
  const refs = balanceSheet(d).filter((r) => r.entity === entity && r.ref.startsWith("account:"));

  return (
    <>
      <PageHeader title={`Income — ${ENTITY_LABEL[entity]}`} subtitle={SOURCES[entity]} />
      <div className="mb-4 flex flex-wrap gap-1 text-xs">
        {ENTITIES.map((e) => <Link key={e} href={e === "property" ? "/finance/income?entity=property" : `/finance/income?entity=${e}`} className={`rounded-[5px] border px-2.5 py-1 ${entity === e ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{ENTITY_LABEL[e]}</Link>)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="This month" value={sumLines(lines, (l) => monthOf(l.date) === month)} tone="green" />
        <Kpi label="Last month" value={sumLines(lines, (l) => monthOf(l.date) === monthOf(new Date(Date.parse(month + "-01") - 86400000).toISOString()))} tone="blue" />
        <Kpi label={`Financial year ${fy.label}`} value={sumLines(lines, (l) => l.date >= fy.from && l.date <= fy.to)} tone="violet" />
        <Kpi label="All time" value={sumLines(lines)} tone="navy" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Income received" className="xl:col-span-2" bodyClass="p-0 max-h-[600px] overflow-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Source</th><th>Details</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {lines.slice(0, 200).map((l, i) => <tr key={i}><td className="whitespace-nowrap">{fmtDate(l.date)}</td><td className="text-xs">{l.category}</td><td>{l.label}</td><td className="text-right tabular-nums">{inr(l.amount)}</td></tr>)}
              {!lines.length && <tr><td colSpan={4} className="text-center text-muted">No income recorded yet</td></tr>}
            </tbody>
          </table>
        </Card>
        <div className="space-y-5">
          <Card title={`By source — FY ${fy.label}`}>
            <ul className="space-y-2 text-sm">
              {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => <li key={c}><div className="flex justify-between"><span>{c}</span><span className="tabular-nums">{inr(v)}</span></div><Bar value={v} max={max} tone="bg-emerald-500" /></li>)}
              {!byCat.size && <li className="text-muted">Nothing this year yet</li>}
            </ul>
          </Card>
          {entity === "property" ? (
            <Card title="Record rent">
              <p className="text-sm text-muted">Rent is recorded against each tenant so dues and receipts stay correct.</p>
              <Link href="/finance/tenants" className="btn-primary mt-3">Go to tenants</Link>
            </Card>
          ) : (
            <Card title="Record other income">
              <ActionForm action={addIncomeAction} submit="Save income">
                <input type="hidden" name="entity" value={entity} />
                <div className="grid gap-3">
                  <div>
                    <label className="label" htmlFor="category">Type</label>
                    <select id="category" name="category" className="input">{(entity === "enrich" ? ["Projects & services", "Consulting", "Corporate training", "Interest", "Other"] : ["Corporate training", "Workshop", "Consulting", "Placement fee", "Interest", "Other"]).map((c) => <option key={c}>{c}</option>)}</select>
                  </div>
                  <FIELD label="Amount (₹) *" name="amount" type="number" required min={1} />
                  <FIELD label="Date" name="entry_date" type="date" defaultValue={d.today} />
                  <RefSelect name="account" label="Received into" options={refs} />
                  <FIELD label="Reference" name="reference" />
                  <FIELD label="Note" name="note" />
                </div>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
