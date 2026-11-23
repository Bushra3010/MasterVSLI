import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  FileSpreadsheet,
  Handshake,
  Home,
  IndianRupee,
  Landmark,
  Lightbulb,
  PieChart,
  Receipt,
  Send,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { EntityBadge, Kpi } from "@/components/finance-bits";
import { Badge, Card, PageHeader } from "@/components/ui";
import { balanceSheet, expenseLines, incomeLines, lastMonths, monthOf, receivablesPayables, refLabel, sumLines, upcomingPayments } from "@/lib/finance";
import { fmtDate, inr } from "@/lib/format";
import { getFinance } from "@/lib/server";
import { ENTITIES, ENTITY_LABEL, ENTITY_SHORT } from "@/lib/types-finance";

export const metadata = { title: "Finance & fund flow" };

const PALETTE = ["#0f2a4a", "#c8102e", "#2563eb", "#059669", "#d97706", "#7c3aed", "#64748b", "#0891b2"];

export default async function FinanceDashboard() {
  const d = await (await getFinance()).load();
  const month = monthOf(d.today);
  const inc = incomeLines(d);
  const exp = expenseLines(d);
  const inMonth = (l: { date: string }) => monthOf(l.date) === month;
  const incomeBy = Object.fromEntries(ENTITIES.map((e) => [e, sumLines(inc, (l) => l.entity === e && inMonth(l))])) as Record<string, number>;
  const expenseBy = Object.fromEntries(ENTITIES.map((e) => [e, sumLines(exp, (l) => l.entity === e && inMonth(l))])) as Record<string, number>;
  const totalIncome = sumLines(inc, inMonth);
  const totalExpense = sumLines(exp, inMonth);

  const cat = new Map<string, number>();
  for (const l of exp.filter(inMonth)) cat.set(l.category, (cat.get(l.category) ?? 0) + l.amount);
  const cats = [...cat.entries()].sort((a, b) => b[1] - a[1]);
  const top = [...cats.slice(0, 7), ...(cats.length > 7 ? [["Other categories", cats.slice(7).reduce((a, c) => a + c[1], 0)] as [string, number]] : [])];
  const ends = top.reduce<number[]>((out, [, v]) => [...out, (out.at(-1) ?? 0) + (totalExpense ? (360 * v) / totalExpense : 0)], []);
  const conic = top.map((_, i) => `${PALETTE[i % PALETTE.length]} ${i ? ends[i - 1] : 0}deg ${ends[i]}deg`).join(", ");

  const sheet = balanceSheet(d);
  const { receivables, payables } = receivablesPayables(d);
  const overdueRec = receivables.filter((r) => r.overdue).reduce((a, r) => a + r.amount, 0);
  const pendingSettle = d.settlements.filter((s) => s.status === "pending");
  const upcoming = upcomingPayments(d, 30).slice(0, 7);
  const months = lastMonths(d.today, 6);
  const trend = months.map((m) => ({ m, i: sumLines(inc, (l) => monthOf(l.date) === m), x: sumLines(exp, (l) => monthOf(l.date) === m) }));
  const maxTrend = Math.max(1, ...trend.flatMap((t) => [t.i, t.x]));
  const multi = d.fundPayments.find((p) => d.sources.filter((s) => s.payment_id === p.id).length > 1);
  const multiSources = multi ? d.sources.filter((s) => s.payment_id === multi.id) : [];
  const pendingApproval = d.expenses.filter((e) => e.status === "pending_approval");

  const incomeDetail: Record<string, string> = {
    mastervlsi: "Student fees + corporate training & other",
    enrich: "Paid project / service invoices",
    property: `${d.tenancies.filter((t) => t.status !== "ended").length} homes occupied`,
  };

  return (
    <>
      <PageHeader
        title="Finance & fund flow"
        subtitle={`Institute · Company · Property (tenants) · Vendors · Expenses — unified accounts. Figures for ${month}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/finance/expenses" className="btn-ghost">+ Expense</Link>
            <Link href="/finance/pay" className="btn-primary">Make payment</Link>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="MasterVLSI income" value={incomeBy.mastervlsi} tone="blue" icon={<IndianRupee size={14} />} hint="this month" />
        <Kpi label="Enrich Silicon income" value={incomeBy.enrich} tone="violet" hint="this month" />
        <Kpi label="Rental income" value={incomeBy.property} tone="green" icon={<Home size={14} />} hint="this month" />
        <Kpi label="Total income" value={totalIncome} tone="navy" hint="this month" />
        <Kpi label="Total expenses" value={totalExpense} tone="red" hint="this month, incl. payroll" />
        <Kpi label="Net surplus" value={totalIncome - totalExpense} tone={totalIncome - totalExpense >= 0 ? "green" : "red"} hint="this month" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Income sources (this month)" icon={<Wallet size={15} />}>
          <ul className="space-y-3">
            {ENTITIES.map((e) => (
              <li key={e} className="flex items-center justify-between gap-3">
                <div><div className="font-medium text-navy">{ENTITY_LABEL[e]}</div><div className="text-[11px] text-muted">{incomeDetail[e]}</div></div>
                <div className="text-right font-semibold tabular-nums">{inr(incomeBy[e])}</div>
              </li>
            ))}
          </ul>
          <Link href="/finance/income" className="mt-3 inline-flex items-center gap-1 text-xs text-navy underline">Income details <ArrowRight size={12} /></Link>
        </Card>

        <Card title="Expense categories (this month)" icon={<PieChart size={15} />}>
          <div className="flex items-center gap-4">
            <div className="relative size-32 shrink-0 rounded-full" style={{ background: totalExpense ? `conic-gradient(${conic})` : "#e2e8f0" }}>
              <div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center">
                <div><div className="text-xs font-semibold tabular-nums text-navy">{inr(totalExpense)}</div><div className="text-[10px] text-muted">total</div></div>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1 text-xs">
              {top.map(([c, v], i) => (
                <li key={c} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5"><span className="size-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate">{c}</span></span>
                  <span className="tabular-nums">{inr(v)}</span>
                </li>
              ))}
              {!top.length && <li className="text-muted">No expenses yet this month</li>}
            </ul>
          </div>
        </Card>

        <Card title="Quick insights" icon={<Lightbulb size={15} />}>
          <dl className="space-y-2 text-sm">
            {[
              ["Income (this month)", inr(totalIncome), ""],
              ["Expenses (this month)", inr(totalExpense), ""],
              ["Net surplus", inr(totalIncome - totalExpense), totalIncome - totalExpense < 0 ? "text-red-600" : "text-emerald-700"],
              ["Overdue receivables", inr(overdueRec), overdueRec ? "text-red-600" : ""],
              ["Inter-entity payable", inr(pendingSettle.reduce((a, s) => a + Number(s.amount), 0)), ""],
              ["Bills waiting for approval", String(pendingApproval.length), pendingApproval.length ? "text-amber-700" : ""],
            ].map(([l, v, c]) => <div key={l} className="flex justify-between"><dt className="text-muted">{l}</dt><dd className={`font-semibold tabular-nums ${c}`}>{v}</dd></div>)}
          </dl>
        </Card>

        <Card title="Example: multi-source vendor payment" icon={<Send size={15} />}>
          {multi ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="space-y-2">
                {multiSources.map((s) => (
                  <div key={s.id} className="rounded-[5px] border border-line px-3 py-2 text-xs">
                    <div className="font-medium">{refLabel(s.source_ref, d.accounts)}</div>
                    <div className="flex items-center justify-between gap-2"><EntityBadge entity={s.entity} /><b className="tabular-nums">{inr(Number(s.amount))}</b></div>
                  </div>
                ))}
              </div>
              <ArrowRight className="text-muted" />
              <div className="rounded-[5px] border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-xs">
                <div className="font-semibold text-emerald-800">Payment completed</div>
                <div className="text-lg font-semibold tabular-nums text-emerald-800">{inr(Number(multi.total))}</div>
                <div>{multi.payee} · {fmtDate(multi.paid_on)}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Pay a bill from several accounts at once — for example ₹30,000 from MasterVLSI&apos;s bank and ₹20,000 from Home 03&apos;s rent.</p>
          )}
          <Link href="/finance/pay" className="mt-3 inline-flex items-center gap-1 text-xs text-navy underline">Make a vendor payment <ArrowRight size={12} /></Link>
        </Card>

        <Card title="Upcoming & recurring payments" icon={<CalendarClock size={15} />} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Due</th><th>Description</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {upcoming.map((u, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap">{fmtDate(u.date)}{u.date < d.today && <div><Badge tone="red">Overdue</Badge></div>}</td>
                  <td>{u.label}<div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted capitalize"><EntityBadge entity={u.entity} /> {u.recurring ? u.kind : "bill"}</div></td>
                  <td className="text-right whitespace-nowrap tabular-nums">{inr(u.amount)}</td>
                </tr>
              ))}
              {!upcoming.length && <tr><td colSpan={3} className="text-center text-muted">Nothing due in the next 30 days</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card title="Accounts & balances" icon={<Landmark size={15} />} bodyClass="p-0">
          <table className="table">
            <tbody>
              {sheet.map((r) => <tr key={r.ref}><td><Link href={`/finance/accounts?ref=${encodeURIComponent(r.ref)}`} className="hover:text-brand">{r.label}</Link></td><td className="text-right font-medium tabular-nums">{inr(r.balance)}</td></tr>)}
              <tr className="font-semibold"><td>Total liquid balance</td><td className="text-right tabular-nums">{inr(sheet.reduce((a, r) => a + r.balance, 0))}</td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Cash flow trend (last 6 months)" icon={<BarChart3 size={15} />} className="xl:col-span-2">
          <div className="flex h-44 items-end gap-3" role="img" aria-label="Income and expenses for the last six months">
            {trend.map((t) => (
              <div key={t.m} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-36 w-full items-end justify-center gap-1">
                  <div className="w-1/3 rounded-t bg-emerald-500" style={{ height: `${(100 * t.i) / maxTrend}%` }} title={`Income ${inr(t.i)}`} />
                  <div className="w-1/3 rounded-t bg-red-500" style={{ height: `${(100 * t.x) / maxTrend}%` }} title={`Expenses ${inr(t.x)}`} />
                </div>
                <div className="text-[10px] text-muted">{t.m.slice(2)}</div>
                <div className={`text-[10px] font-medium tabular-nums ${t.i - t.x < 0 ? "text-red-600" : "text-emerald-700"}`}>{inr(t.i - t.x)}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted"><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-emerald-500" /> Income</span><span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-red-500" /> Expenses</span><span>Net shown under each month</span></div>
        </Card>

        <Card title="Inter-entity settlement / reimbursement" icon={<Handshake size={15} />} bodyClass="p-0">
          <table className="table">
            <tbody>
              {d.settlements.slice(0, 5).map((s) => <tr key={s.id}><td className="text-xs">{ENTITY_SHORT[s.from_entity]} → {ENTITY_SHORT[s.to_entity]}</td><td className="tabular-nums">{inr(Number(s.amount))}</td><td><Badge tone={s.status === "settled" ? "green" : "amber"}>{s.status === "settled" ? "Settled" : "Pending"}</Badge></td></tr>)}
              {!d.settlements.length && <tr><td className="text-center text-muted">Nothing owed between entities</td></tr>}
              <tr className="font-semibold"><td colSpan={2}>Total pending</td><td className="tabular-nums">{inr(pendingSettle.reduce((a, s) => a + Number(s.amount), 0))}</td></tr>
            </tbody>
          </table>
        </Card>
        <Card title="Entity-wise P&L (this month)" icon={<Building2 size={15} />} className="xl:col-span-3" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Entity</th><th className="text-right">Income</th><th className="text-right">Expenses</th><th className="text-right">Profit / loss</th></tr></thead>
            <tbody>
              {ENTITIES.map((e) => <tr key={e}><td><EntityBadge entity={e} /></td><td className="text-right tabular-nums">{inr(incomeBy[e])}</td><td className="text-right tabular-nums">{inr(expenseBy[e])}</td><td className={`text-right font-semibold tabular-nums ${incomeBy[e] - expenseBy[e] < 0 ? "text-red-600" : "text-emerald-700"}`}>{inr(incomeBy[e] - expenseBy[e])}</td></tr>)}
              <tr className="font-semibold"><td>Total</td><td className="text-right tabular-nums">{inr(totalIncome)}</td><td className="text-right tabular-nums">{inr(totalExpense)}</td><td className="text-right tabular-nums">{inr(totalIncome - totalExpense)}</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Key finance modules" className="mt-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {[
            ["/finance/income", "Income entry", "Fees, rent, projects", IndianRupee],
            ["/finance/expenses", "Expense entry", "Rent, electricity, salary…", Receipt],
            ["/vendors", "Vendor & bills", "Vendors and their bills", Building2],
            ["/finance/pay", "Fund transfer", "Between accounts", Send],
            ["/finance/receivables", "Receivables & payables", `${receivables.length} in · ${payables.length} out`, Wallet],
            ["/finance/budgets", "Budgets & approvals", `${pendingApproval.length} waiting`, CalendarClock],
            ["/finance/tenants", "Tenants", "Rent, deposits, bills", Home],
            ["/finance/reports", "Reports & MIS", "P&L, cash flow, exports", FileSpreadsheet],
          ].map(([href, title, sub, Icon]) => {
            const I = Icon as typeof Home;
            return (
              <Link key={href as string} href={href as string} className="rounded-[5px] border border-line p-3 text-center hover:border-navy">
                <I className="mx-auto text-brand" size={20} />
                <div className="mt-1 text-sm font-medium text-navy">{title as string}</div>
                <div className="text-[11px] text-muted">{sub as string}</div>
              </Link>
            );
          })}
        </div>
      </Card>
    </>
  );
}
