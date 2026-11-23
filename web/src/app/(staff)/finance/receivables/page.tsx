import Link from "next/link";
import { EntityBadge, Kpi } from "@/components/finance-bits";
import { Badge, Card, PageHeader } from "@/components/ui";
import { receivablesPayables, type RPItem } from "@/lib/finance";
import { fmtDate, inr } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { ENTITIES, ENTITY_SHORT, type Entity } from "@/lib/types-finance";

export const metadata = { title: "Receivables & payables" };

function List({ items, title }: { items: RPItem[]; title: string }) {
  const sorted = [...items].sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due ?? "").localeCompare(b.due ?? ""));
  return (
    <Card title={`${title} (${items.length})`} bodyClass="p-0 max-h-[620px] overflow-auto">
      <table className="table">
        <thead><tr><th>Entity</th><th>Type</th><th>Party</th><th>Due</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i}>
              <td><EntityBadge entity={r.entity} /></td>
              <td className="text-xs">{r.kind}</td>
              <td>{r.href ? <Link href={r.href} className="font-medium text-navy hover:text-brand">{ENTITY_SHORT[r.party as Entity] ?? r.party}</Link> : <span className="font-medium">{ENTITY_SHORT[r.party as Entity] ?? r.party}</span>}<div className="max-w-64 truncate text-[11px] text-muted">{r.detail}</div></td>
              <td className="whitespace-nowrap">{r.due ? fmtDate(r.due) : "—"}{r.overdue && <div><Badge tone="red">Overdue</Badge></div>}</td>
              <td className="text-right font-medium tabular-nums">{inr(r.amount)}</td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={5} className="text-center text-muted">Nothing here</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const entity = ENTITIES.includes(sp.entity as Entity) ? (sp.entity as Entity) : null;
  const d = await (await getFinance()).load();
  const { receivables, payables } = receivablesPayables(d);
  const r = receivables.filter((x) => !entity || x.entity === entity);
  const p = payables.filter((x) => !entity || x.entity === entity);
  const sum = (xs: RPItem[], f: (x: RPItem) => boolean = () => true) => xs.filter(f).reduce((a, x) => a + x.amount, 0);
  return (
    <>
      <PageHeader title="Receivables & payables" subtitle="Money coming in (rent, fees, invoices, inter-entity) and going out (bills, deposits to refund, inter-entity)." />
      <div className="mb-4 flex flex-wrap gap-1 text-xs">
        <Link href="/finance/receivables" className={`rounded-[5px] border px-2.5 py-1 ${!entity ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>All entities</Link>
        {ENTITIES.map((e) => <Link key={e} href={`/finance/receivables?entity=${e}`} className={`rounded-[5px] border px-2.5 py-1 ${entity === e ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{ENTITY_SHORT[e]}</Link>)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Receivable" value={sum(r)} tone="green" />
        <Kpi label="…of which overdue" value={sum(r, (x) => x.overdue)} tone="red" />
        <Kpi label="Payable" value={sum(p)} tone="amber" />
        <Kpi label="…of which overdue" value={sum(p, (x) => x.overdue)} tone="red" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <List items={r} title="Receivables" />
        <List items={p} title="Payables" />
      </div>
    </>
  );
}
