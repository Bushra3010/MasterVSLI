import { ArrowDownCircle, ArrowUpCircle, Handshake, Landmark } from "lucide-react";
import Link from "next/link";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { addFinanceEntryAction, removeFinanceEntryAction } from "../module-actions";

export const metadata = { title: "Accounts & finance" };

const EXPENSE_CATS = ["Rent", "Salaries", "Software licenses", "Utilities", "Marketing", "Equipment", "Travel", "Other"];
const INCOME_CATS = ["Corporate training", "Workshop", "Consulting", "Interest", "Other"];

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  const sp = await searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : "";
  const repo = await getRepo();
  const [{ vendors, allocations, installments, payments }, entries] = await Promise.all([repo.ledger(), repo.financeEntries()]);
  const inMonth = (d: string) => !month || d.startsWith(month);

  const feeIncome = payments.filter((p) => inMonth(p.paid_at.slice(0, 10))).reduce((a, p) => a + Number(p.amount), 0);
  const shown = entries.filter((e) => inMonth(e.entry_date));
  const sum = (k: string) => shown.filter((e) => e.kind === k).reduce((a, e) => a + Number(e.amount), 0);
  const otherIncome = sum("income");
  const expense = sum("expense");
  const settled = sum("settlement");
  const net = feeIncome + otherIncome - expense - settled;

  const byCat = new Map<string, number>();
  for (const e of shown.filter((x) => x.kind === "expense")) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
  const maxCat = Math.max(1, ...byCat.values());

  const allocVendor = new Map(allocations.map((a) => [a.id, a.vendor_id]));
  const parents = vendors.filter((v) => !v.parent_id);
  const settlement = parents.map((v) => {
    const collected = installments.filter((i) => allocVendor.get(i.allocation_id) === v.id).reduce((a, i) => a + Number(i.paid_amount), 0);
    const paidOut = entries.filter((e) => e.kind === "settlement" && e.vendor_id === v.id).reduce((a, e) => a + Number(e.amount), 0);
    return { v, collected, paidOut };
  });
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));

  const months = [...new Set([...payments.map((p) => p.paid_at.slice(0, 7)), ...entries.map((e) => e.entry_date.slice(0, 7))])].sort().reverse().slice(0, 12);

  return (
    <>
      <PageHeader
        title="Accounts & finance"
        subtitle="Fee income plus other income, institute expenses and vendor settlements, in one cash book."
        actions={
          <div className="flex flex-wrap gap-1 text-xs">
            <Link href="/accounts" className={`rounded-md border px-2 py-1 ${!month ? "border-navy bg-navy text-white" : "border-line bg-white"}`}>All time</Link>
            {months.slice(0, 6).map((m) => (
              <Link key={m} href={`/accounts?month=${m}`} className={`rounded-md border px-2 py-1 ${month === m ? "border-navy bg-navy text-white" : "border-line bg-white"}`}>{m}</Link>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Fee income" value={inr(feeIncome)} tone="green" icon={<ArrowDownCircle size={16} />} />
        <Stat label="Other income" value={inr(otherIncome)} tone="green" />
        <Stat label="Expenses" value={inr(expense)} tone="red" icon={<ArrowUpCircle size={16} />} />
        <Stat label="Vendor settlements" value={inr(settled)} tone="amber" icon={<Handshake size={16} />} />
        <Stat label="Net cash" value={inr(net)} tone={net >= 0 ? "blue" : "red"} icon={<Landmark size={16} />} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Record income / expense / settlement" className="xl:col-span-2">
          <form action={addFinanceEntryAction} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-muted">Type
              <select name="kind" className="input mt-1 py-1.5" defaultValue="expense">
                <option value="expense">Expense</option><option value="income">Other income</option><option value="settlement">Vendor settlement</option>
              </select>
            </label>
            <label className="text-xs text-muted">Category
              <input name="category" list="fin-cats" required placeholder="e.g. Rent" className="input mt-1 py-1.5" />
              <datalist id="fin-cats">{[...EXPENSE_CATS, ...INCOME_CATS, "Vendor settlement"].map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="text-xs text-muted">Amount (₹)
              <input name="amount" type="number" min={1} step="0.01" required className="input mt-1 py-1.5" />
            </label>
            <label className="text-xs text-muted">Date
              <input name="entry_date" type="date" required defaultValue={todayISO()} className="input mt-1 py-1.5" />
            </label>
            <label className="text-xs text-muted">Vendor (for settlements)
              <select name="vendor_id" className="input mt-1 py-1.5" defaultValue="">
                <option value="">—</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.parent_id ? `↳ ${v.name}` : v.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted">Reference
              <input name="reference" placeholder="Invoice / UTR" className="input mt-1 py-1.5" />
            </label>
            <label className="text-xs text-muted sm:col-span-2">Note
              <input name="note" className="input mt-1 py-1.5" />
            </label>
            <div className="flex items-end"><button className="btn-primary w-full">Save entry</button></div>
          </form>
        </Card>

        <Card title="Expenses by category">
          {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => (
            <div key={c} className="mb-2 text-sm">
              <div className="flex justify-between"><span>{c}</span><span className="tabular-nums">{inr(v)}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand" style={{ width: `${(100 * v) / maxCat}%` }} /></div>
            </div>
          ))}
          {!byCat.size && <p className="text-sm text-muted">No expenses recorded{month && ` in ${month}`}.</p>}
        </Card>
      </div>

      <Card title="Vendor settlement" icon={<Handshake size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Vendor</th><th>Collected from students</th><th>Settled to vendor</th><th>Balance to settle</th></tr></thead>
          <tbody>
            {settlement.map(({ v, collected, paidOut }) => (
              <tr key={v.id}>
                <td className="font-medium">{v.name}</td>
                <td className="tabular-nums">{inr(collected)}</td>
                <td className="tabular-nums">{inr(paidOut)}</td>
                <td className="tabular-nums font-semibold">{collected - paidOut > 0 ? <span className="text-amber-700">{inr(collected - paidOut)}</span> : <Badge tone="green">Settled</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={`Cash book${month ? ` · ${month}` : ""}`} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Details</th><th className="text-right">Amount</th><th /></tr></thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id}>
                <td>{fmtDate(e.entry_date)}</td>
                <td><Badge tone={e.kind === "income" ? "green" : e.kind === "expense" ? "red" : "amber"}>{e.kind}</Badge></td>
                <td>{e.category}</td>
                <td className="text-sm text-muted">{[e.vendor_id && vendorName.get(e.vendor_id), e.note, e.reference].filter(Boolean).join(" · ") || "—"}</td>
                <td className={`text-right tabular-nums ${e.kind === "income" ? "text-emerald-700" : "text-brand"}`}>{e.kind === "income" ? "+" : "−"} {inr(e.amount)}</td>
                <td><form action={removeFinanceEntryAction.bind(null, e.id)}><button className="text-xs text-muted hover:text-brand">Delete</button></form></td>
              </tr>
            ))}
            <tr className="bg-slate-50">
              <td colSpan={4} className="text-sm">Student fee payments ({payments.filter((p) => inMonth(p.paid_at.slice(0, 10))).length}) — see <Link href="/fees" className="text-brand hover:underline">Fees</Link></td>
              <td className="text-right tabular-nums text-emerald-700">+ {inr(feeIncome)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </Card>
    </>
  );
}
