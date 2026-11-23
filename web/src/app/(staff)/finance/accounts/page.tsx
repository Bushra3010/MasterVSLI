import { Landmark } from "lucide-react";
import Link from "next/link";
import { EntityBadge, Kpi } from "@/components/finance-bits";
import { I, Row, Save } from "@/components/form-bits";
import { Card, PageHeader } from "@/components/ui";
import { balanceSheet, movements, refLabel } from "@/lib/finance";
import { fmtDate, inr } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { ENTITIES, ENTITY_LABEL } from "@/lib/types-finance";
import { saveFinanceRow } from "../actions";

export const metadata = { title: "Bank & cash accounts" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = await (await getFinance()).load();
  const sheet = balanceSheet(d);
  const selected = typeof sp.ref === "string" && sheet.some((r) => r.ref === sp.ref) ? sp.ref : sheet[0]?.ref;
  const mv = selected ? movements(d, selected) : [];
  const statement = mv.reduce<(typeof mv[number] & { balance: number })[]>((out, m) => [...out, { ...m, balance: (out.at(-1)?.balance ?? 0) + m.inflow - m.outflow }], []).reverse();

  return (
    <>
      <PageHeader title="Bank & cash accounts" subtitle="Live balances for every account, plus collections not yet banked. Click an account for its statement." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ENTITIES.map((e) => <Kpi key={e} label={ENTITY_LABEL[e]} value={sheet.filter((r) => r.entity === e).reduce((a, r) => a + r.balance, 0)} tone={e === "mastervlsi" ? "blue" : e === "enrich" ? "violet" : "green"} />)}
        <Kpi label="Total liquid balance" value={sheet.reduce((a, r) => a + r.balance, 0)} tone="navy" icon={<Landmark size={15} />} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Accounts & balances" bodyClass="p-0">
          <table className="table">
            <tbody>
              {sheet.map((r) => (
                <tr key={r.ref} className={r.ref === selected ? "bg-brand-soft/50" : ""}>
                  <td><Link href={`/finance/accounts?ref=${encodeURIComponent(r.ref)}`} className="font-medium text-navy hover:text-brand">{r.label}</Link><div className="mt-0.5"><EntityBadge entity={r.entity} /> <span className="text-[11px] text-muted capitalize">{r.kind}</span></div></td>
                  <td className={`text-right font-semibold tabular-nums ${r.balance < 0 ? "text-red-600" : ""}`}>{inr(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={`Statement — ${selected ? refLabel(selected, d.accounts) : ""}`} className="xl:col-span-2" bodyClass="p-0 max-h-[560px] overflow-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Details</th><th className="text-right">In</th><th className="text-right">Out</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {statement.map((m, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap">{m.date === "0000-00-00" ? "Opening" : fmtDate(m.date)}</td>
                  <td>{m.label}</td>
                  <td className="text-right text-emerald-700 tabular-nums">{m.inflow ? inr(m.inflow) : ""}</td>
                  <td className="text-right text-red-600 tabular-nums">{m.outflow ? inr(m.outflow) : ""}</td>
                  <td className="text-right font-medium tabular-nums">{inr(m.balance)}</td>
                </tr>
              ))}
              {!statement.length && <tr><td colSpan={5} className="text-center text-muted">No movements</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card title="Manage accounts" className="xl:col-span-3">
          {d.accounts.map((a) => (
            <Row key={a.id} action={saveFinanceRow.bind(null, "fin_accounts")}>
              <input type="hidden" name="id" value={a.id} />
              <select name="entity" defaultValue={a.entity} aria-label="Entity" className="input w-40 py-1.5">{ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_LABEL[e]}</option>)}</select>
              <I name="name" value={a.name} w="min-w-48 flex-1" required placeholder="Account name" />
              <select name="kind" defaultValue={a.kind} aria-label="Type" className="input w-24 py-1.5"><option value="bank">Bank</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="wallet">Wallet</option></select>
              <I name="bank_name" value={a.bank_name} w="w-36" placeholder="Bank" />
              <I name="account_no" value={a.account_no} w="w-32" placeholder="Account no." />
              <I name="ifsc" value={a.ifsc} w="w-32" placeholder="IFSC" />
              <I name="opening_balance" type="number" value={a.opening_balance} w="w-32" placeholder="Opening ₹" />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={a.active} /> Active</label>
              <Save />
            </Row>
          ))}
          <Row action={saveFinanceRow.bind(null, "fin_accounts")}>
            <select name="entity" aria-label="Entity" className="input w-40 py-1.5">{ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_LABEL[e]}</option>)}</select>
            <I name="name" w="min-w-48 flex-1" required placeholder="New account, e.g. MasterVLSI — Axis current" />
            <select name="kind" aria-label="Type" className="input w-24 py-1.5"><option value="bank">Bank</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="wallet">Wallet</option></select>
            <I name="bank_name" w="w-36" placeholder="Bank" />
            <I name="account_no" w="w-32" placeholder="Account no." />
            <I name="ifsc" w="w-32" placeholder="IFSC" />
            <I name="opening_balance" type="number" w="w-32" placeholder="Opening ₹" />
            <input type="hidden" name="active" value="on" />
            <Save label="+ Add account" />
          </Row>
          <p className="mt-2 text-xs text-muted">Store only the last 4 digits of account numbers if you prefer. Balances are worked out from the opening balance and every payment, receipt and transfer recorded here.</p>
        </Card>
      </div>
    </>
  );
}
