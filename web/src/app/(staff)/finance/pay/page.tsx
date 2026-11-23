import { ArrowLeftRight, Handshake, Send } from "lucide-react";
import { ActionForm } from "@/components/finance-ui";
import { EntityBadge, FIELD, RefSelect } from "@/components/finance-bits";
import { Badge, Card, PageHeader } from "@/components/ui";
import { balanceSheet, refLabel, tenancyView } from "@/lib/finance";
import { fmtDate, inr } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { ENTITY_SHORT } from "@/lib/types-finance";
import { settleAction, transferAction } from "../actions";
import { PaymentForm } from "./payment-form";

export const metadata = { title: "Payments & fund transfer" };

export default async function PayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const d = await (await getFinance()).load();
  const refs = balanceSheet(d);
  const vendorName = new Map(d.vendors.map((v) => [v.id, v.name]));
  const bills = d.expenses
    .filter((e) => e.status === "approved" && Number(e.amount) - Number(e.paid_amount) > 0)
    .map((e) => ({ id: e.id, label: `${e.description}${e.invoice_no ? ` · ${e.invoice_no}` : ""}`, due: Number(e.amount) - Number(e.paid_amount), entity: e.entity, payee: e.payee ?? vendorName.get(e.vendor_id ?? "") ?? "", vendor_id: e.vendor_id ?? null }));
  const tenancies = d.tenancies.filter((t) => t.status !== "ended").map((t) => { const v = tenancyView(d, t); return { id: t.id, label: `${v.unit?.code ?? ""} · ${v.tenant.full_name}` }; });
  const pending = d.settlements.filter((s) => s.status === "pending");

  return (
    <>
      <PageHeader title="Payments & fund transfer" subtitle="Pay vendors and bills from any account, rent collections or student-fee collections — or a mix. Move money between accounts and settle what entities owe each other." />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Make a payment (multi-source)" icon={<Send size={15} />} className="xl:col-span-2">
          <PaymentForm refs={refs} bills={bills} tenancies={tenancies} preselect={typeof sp.expense === "string" ? sp.expense : undefined} today={d.today} />
        </Card>
        <Card title="Transfer between accounts" icon={<ArrowLeftRight size={15} />}>
          <ActionForm action={transferAction} submit="Transfer">
            <div className="grid gap-3">
              <RefSelect name="from_ref" label="From *" required options={refs} />
              <RefSelect name="to_ref" label="To *" required options={refs} />
              <FIELD label="Amount (₹) *" name="amount" type="number" required min={1} />
              <FIELD label="Date" name="transfer_date" type="date" defaultValue={d.today} required />
              <FIELD label="Reference" name="reference" placeholder="IMPS / cash deposit slip" />
              <FIELD label="Note" name="note" />
              <p className="text-[11px] text-muted">Use this to bank cash collections too: from &quot;Rent collections&quot; or &quot;Student fee collections&quot; into a bank account.</p>
            </div>
          </ActionForm>
        </Card>
      </div>

      <Card title={`Inter-entity settlement / reimbursement (${pending.length} pending)`} icon={<Handshake size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <div id="settlements" />
        <table className="table">
          <thead><tr><th>Date</th><th>Owes</th><th>To</th><th>Amount</th><th>Reason</th><th>Status</th><th>Settle</th></tr></thead>
          <tbody>
            {d.settlements.map((s) => {
              const fromRefs = refs.filter((r) => r.entity === s.from_entity);
              const toRefs = refs.filter((r) => r.entity === s.to_entity && r.ref.startsWith("account:"));
              return (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">{fmtDate(s.created_at)}</td>
                  <td><EntityBadge entity={s.from_entity} /></td>
                  <td><EntityBadge entity={s.to_entity} /></td>
                  <td className="font-semibold tabular-nums">{inr(Number(s.amount))}</td>
                  <td className="max-w-72 text-xs">{s.reason}</td>
                  <td><Badge tone={s.status === "settled" ? "green" : "amber"}>{s.status === "settled" ? `Settled ${fmtDate(s.settled_on)}` : "Pending"}</Badge></td>
                  <td>
                    {s.status === "pending" && (
                      <ActionForm action={settleAction.bind(null, s.id)} submit="Settle" className="flex flex-wrap items-center gap-1" reset={false}>
                        <select name="from_ref" required aria-label={`Pay from ${ENTITY_SHORT[s.from_entity]}`} className="input w-auto py-1 text-xs">{fromRefs.map((r) => <option key={r.ref} value={r.ref}>{r.label} ({inr(r.balance)})</option>)}</select>
                        <select name="to_ref" required aria-label={`Into ${ENTITY_SHORT[s.to_entity]}`} className="input w-auto py-1 text-xs">{toRefs.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}</select>
                        <input type="hidden" name="date" value={d.today} />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              );
            })}
            {!d.settlements.length && <tr><td colSpan={7} className="text-center text-muted">No inter-entity balances</td></tr>}
          </tbody>
        </table>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Recent payments" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Payee</th><th>Total</th><th>Paid from</th></tr></thead>
            <tbody>
              {d.fundPayments.slice(0, 20).map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{fmtDate(p.paid_on)}</td>
                  <td className="font-medium">{p.payee}<div className="text-[11px] text-muted">{p.reference ?? ""}</div></td>
                  <td className="tabular-nums">{inr(Number(p.total))}</td>
                  <td className="text-xs">{d.sources.filter((s) => s.payment_id === p.id).map((s) => <div key={s.id}>{refLabel(s.source_ref, d.accounts)}: {inr(Number(s.amount))}</div>)}</td>
                </tr>
              ))}
              {!d.fundPayments.length && <tr><td colSpan={4} className="text-center text-muted">No payments yet</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title="Recent transfers" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>From</th><th>To</th><th>Amount</th></tr></thead>
            <tbody>
              {d.transfers.slice(0, 20).map((t) => (
                <tr key={t.id}><td className="whitespace-nowrap">{fmtDate(t.transfer_date)}</td><td className="text-xs">{refLabel(t.from_ref, d.accounts)}</td><td className="text-xs">{refLabel(t.to_ref, d.accounts)}</td><td className="tabular-nums">{inr(Number(t.amount))}</td></tr>
              ))}
              {!d.transfers.length && <tr><td colSpan={4} className="text-center text-muted">No transfers yet</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
