import { redirect } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { createIncentiveRepo, currentMonth, monthName, monthOf, shiftMonthKey } from "@/lib/incentives";
import { fmtDate } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession, getStore, isAdmin } from "@/lib/session";
import { METRICS } from "@/lib/types-incentives";
import { decideAction, markPaidAction, saveRulesAction, saveTargetsAction } from "../actions";
import { IncentiveTabs, money } from "../parts";

export const metadata = { title: "HR incentives admin" };

const SAVED: Record<string, string> = { approved: "Approved", rejected: "Rejected", paid: "Marked as paid", rules: "Commission rules saved", targets: "Targets saved" };

export default async function IncentiveAdmin({ searchParams }: { searchParams: Promise<{ month?: string; scope_staff?: string; scope_month?: string; saved?: string }> }) {
  const sp = await searchParams;
  const me = await getSession();
  if (!isAdmin(me)) redirect("/incentives");
  const repo = await getRepo();
  const staff = await repo.staff();
  const inc = createIncentiveRepo(await getStore());
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const scopeStaff = sp.scope_staff ?? "";
  const scopeMonth = /^\d{4}-\d{2}$/.test(sp.scope_month ?? "") ? sp.scope_month! : "";
  const [rules, entries, allTargets] = await Promise.all([inc.rules(), inc.entries(), inc.allTargets()]);
  const pending = entries.filter((e) => e.status === "pending");
  const name = (id: string) => staff.find((s) => s.id === id)?.full_name ?? "—";
  const payouts = staff
    .map((s) => {
      const rows = entries.filter((e) => e.staff_id === s.id && monthOf(e.occurred_on) === month);
      const sum = (st: string) => rows.filter((e) => e.status === st).reduce((a, e) => a + e.amount, 0);
      return { staff: s, approved: sum("approved"), paid: sum("paid"), pending: sum("pending") };
    })
    .filter((p) => p.approved || p.paid || p.pending);
  // Targets shown for the chosen scope: its own overrides, falling back to what applies.
  const effective = scopeStaff ? await inc.targetsFor(scopeStaff, scopeMonth || currentMonth()) : null;
  const own = (metric: string) => allTargets.find((t) => (t.staff_id ?? "") === scopeStaff && (t.month ?? "") === scopeMonth && t.metric === metric)?.target;
  const fallback = (metric: string) => (effective ? effective[metric as keyof typeof effective] : allTargets.find((t) => !t.staff_id && !t.month && t.metric === metric)?.target);
  const here = (extra: Record<string, string | undefined> = {}) => {
    const u = new URLSearchParams(Object.entries({ month: sp.month, scope_staff: sp.scope_staff, scope_month: sp.scope_month, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/incentives/admin${u.toString() ? `?${u}` : ""}`;
  };

  return (
    <>
      <PageHeader title="HR incentives — admin panel" subtitle="Approve activities, pay out commission, and set commission rules and monthly targets." />
      <IncentiveTabs active="admin" admin />
      {sp.saved && SAVED[sp.saved] && <div role="status" className="mb-4 rounded-[5px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{SAVED[sp.saved]}.</div>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={`Approval queue (${pending.length})`}>
          {pending.length ? (
            <ul className="divide-y divide-line">
              {pending.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-navy">{name(e.staff_id)} · {e.label}{e.quantity > 1 ? ` × ${Number(e.quantity).toLocaleString("en-IN")}` : ""}</div>
                    <div className="text-muted">{fmtDate(e.occurred_on)}{e.ref_label ? ` · ${e.ref_label}` : ""}{e.proof_url ? " · " : ""}{e.proof_url && <a href={e.proof_url} target="_blank" rel="noreferrer" className="text-brand underline">proof</a>}</div>
                  </div>
                  <form action={decideAction.bind(null, e.id, "approved")} className="flex gap-1">
                    <input type="hidden" name="back" value={here()} />
                    <input name="amount" type="number" min={0} defaultValue={e.amount} aria-label={`Amount for ${e.label}`} className="input w-24 py-1 text-xs" />
                    <button className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">Approve</button>
                  </form>
                  <form action={decideAction.bind(null, e.id, "rejected")}>
                    <input type="hidden" name="back" value={here()} />
                    <button className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">Reject</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Nothing waiting for approval.</p>
          )}
        </Card>

        <Card
          title={`Payouts — ${monthName(month)}`}
          actions={
            <div className="flex gap-2 text-xs">
              <a href={here({ month: shiftMonthKey(month, -1) })} className="text-brand">← Prev</a>
              <a href={here({ month: shiftMonthKey(month, 1) })} className="text-brand">Next →</a>
            </div>
          }
        >
          <table className="w-full text-xs">
            <thead><tr className="border-b border-line text-left text-muted"><th className="py-1.5 font-medium">Staff</th><th className="py-1.5 text-right font-medium">Pending</th><th className="py-1.5 text-right font-medium">To pay</th><th className="py-1.5 text-right font-medium">Paid</th><th /></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.staff.id} className="border-b border-line last:border-0">
                  <td className="py-1.5 text-navy">{p.staff.full_name}</td>
                  <td className="py-1.5 text-right text-amber-700 tabular-nums">{money(p.pending)}</td>
                  <td className="py-1.5 text-right font-semibold text-blue-700 tabular-nums">{money(p.approved)}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(p.paid)}</td>
                  <td className="py-1.5 text-right">
                    {p.approved > 0 ? (
                      <form action={markPaidAction.bind(null, p.staff.id, month)}>
                        <input type="hidden" name="back" value={here()} />
                        <button className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-800">Mark paid</button>
                      </form>
                    ) : (
                      <Badge tone="green">Settled</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {!payouts.length && <tr><td colSpan={5} className="py-3 text-center text-muted">No commission this month.</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card title="Commission rules">
          <form action={saveRulesAction}>
            <input type="hidden" name="back" value={here()} />
            <table className="w-full text-xs">
              <thead><tr className="border-b border-line text-left text-muted"><th className="py-1.5 font-medium">Activity</th><th className="py-1.5 font-medium">Amount (₹)</th><th className="py-1.5 font-medium">Unit</th><th className="py-1.5 font-medium">On</th></tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-2 text-navy">
                      {r.label}
                      {r.kind === "auto" && <span className="ml-1 text-[10px] text-muted">(automatic)</span>}
                      {r.kind === "milestone" && (
                        <label className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">at <input name={`threshold.${r.key}`} type="number" min={1} defaultValue={Number(r.threshold)} aria-label={`Threshold for ${r.label}`} className="input w-20 py-0.5 text-[11px]" /></label>
                      )}
                    </td>
                    <td className="py-1.5 pr-2"><input name={`amount.${r.key}`} type="number" min={0} step="1" defaultValue={r.amount} aria-label={`Amount for ${r.label}`} className="input w-24 py-1 text-xs" /></td>
                    <td className="py-1.5 pr-2 text-muted">{r.unit}</td>
                    <td className="py-1.5"><input type="checkbox" name={`active.${r.key}`} defaultChecked={r.active} aria-label={`${r.label} active`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted">New amounts apply to activities credited or logged from now on. &ldquo;Admin configurable&rdquo; items are priced when you approve them.</p>
            <button className="btn-primary mt-2">Save rules</button>
          </form>
        </Card>

        <Card title="Monthly targets">
          <form action="/incentives/admin" className="mb-3 flex flex-wrap gap-2 text-xs">
            <select name="scope_staff" defaultValue={scopeStaff} aria-label="Targets for" className="input w-auto py-1.5 text-xs">
              <option value="">Everyone (default)</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <select name="scope_month" defaultValue={scopeMonth} aria-label="Month" className="input w-auto py-1.5 text-xs">
              <option value="">Every month</option>
              {Array.from({ length: 6 }, (_, i) => shiftMonthKey(currentMonth(), i - 1)).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
            <button className="btn-ghost py-1.5 text-xs">Choose</button>
          </form>
          <form action={saveTargetsAction} className="space-y-2">
            <input type="hidden" name="back" value={here()} />
            <input type="hidden" name="scope_staff" value={scopeStaff} />
            <input type="hidden" name="scope_month" value={scopeMonth} />
            {METRICS.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-xs">
                <span className="flex-1 text-navy">{m.label}</span>
                <input name={`target.${m.key}`} type="number" min={0} defaultValue={own(m.key) ?? (scopeStaff || scopeMonth ? "" : fallback(m.key))} placeholder={String(fallback(m.key) ?? "")} aria-label={`Target for ${m.label}`} className="input w-28 py-1 text-xs" />
                <span className="w-14 text-muted">{m.unit}</span>
              </label>
            ))}
            <p className="text-[11px] text-muted">
              {scopeStaff || scopeMonth ? "Leave a box empty to use the default (shown in grey)." : "These defaults apply to every HR every month unless overridden."}
            </p>
            <button className="btn-primary">Save targets</button>
          </form>
        </Card>
      </div>
    </>
  );
}
