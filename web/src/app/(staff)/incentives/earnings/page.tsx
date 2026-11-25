import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { createIncentiveRepo, currentMonth, monthName, monthOf } from "@/lib/incentives";
import { fmtDate } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession, getStore, isAdmin } from "@/lib/session";
import { type CommissionStatus, STATUS_TONE } from "@/lib/types-incentives";
import { decideAction, deleteEntryAction } from "../actions";
import { IncentiveTabs, LogActivityForm, money } from "../parts";

export const metadata = { title: "Commission & earnings" };

const SAVED: Record<string, string> = { logged: "Activity submitted for approval", approved: "Approved", rejected: "Rejected", removed: "Removed" };
const STATUSES: CommissionStatus[] = ["pending", "approved", "paid", "rejected"];

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ staff?: string; month?: string; status?: string; saved?: string }> }) {
  const sp = await searchParams;
  const [me, repo] = await Promise.all([getSession(), getRepo()]);
  const admin = isAdmin(me);
  const staff = await repo.staff();
  const mine = (await repo.staffForUser(me?.userId, me?.email)) ?? (me?.demo ? staff[0] : null);
  // Staff see their own ledger; admins see everyone (or one person).
  const staffFilter = admin ? (sp.staff ?? "") : (mine?.id ?? "__none__");
  const month = sp.month === "all" ? "all" : /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const status = STATUSES.includes(sp.status as CommissionStatus) ? (sp.status as CommissionStatus) : undefined;

  const inc = createIncentiveRepo(await getStore());
  const [rules, all] = await Promise.all([inc.rules(), inc.entries({ staffId: staffFilter || undefined, status })]);
  const rows = all.filter((e) => month === "all" || monthOf(e.occurred_on) === month);
  const name = (id: string) => staff.find((s) => s.id === id)?.full_name ?? "—";
  const total = (st: CommissionStatus[]) => rows.filter((e) => st.includes(e.status)).reduce((a, e) => a + e.amount, 0);
  const qs = new URLSearchParams(Object.entries({ staff: sp.staff, month: sp.month, status: sp.status }).filter(([, v]) => v) as [string, string][]).toString();
  const here = `/incentives/earnings${qs ? `?${qs}` : ""}`;
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${currentMonth()}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    return d.toISOString().slice(0, 7);
  });

  return (
    <>
      <PageHeader title="Commission & earnings" subtitle={admin ? "Every commission entry for all HR staff" : `Your commission ledger${mine ? ` — ${mine.full_name}` : ""}`} />
      <IncentiveTabs active="earnings" admin={admin} />
      {sp.saved && SAVED[sp.saved] && <div role="status" className="mb-4 rounded-[5px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{SAVED[sp.saved]}.</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <form action="/incentives/earnings" className="flex flex-wrap gap-2 rounded-[5px] border border-line bg-white p-2 shadow-sm">
            {admin && (
              <select name="staff" defaultValue={sp.staff ?? ""} aria-label="Staff member" className="input w-auto py-1.5 text-xs">
                <option value="">All staff</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            )}
            <select name="month" defaultValue={month} aria-label="Month" className="input w-auto py-1.5 text-xs">
              {months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
              <option value="all">All months</option>
            </select>
            <select name="status" defaultValue={status ?? ""} aria-label="Status" className="input w-auto py-1.5 text-xs">
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
            <button className="btn-ghost py-1.5 text-xs">Filter</button>
          </form>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Earned (approved + paid)", total(["approved", "paid"]), "text-emerald-700"], ["Awaiting approval", total(["pending"]), "text-amber-700"], ["Approved, not yet paid", total(["approved"]), "text-blue-700"], ["Paid out", total(["paid"]), "text-navy"]].map(([l, v, c]) => (
              <div key={l as string} className="rounded-[5px] border border-line bg-white p-3 shadow-sm">
                <div className="text-[11px] text-muted">{l}</div>
                <div className={`text-lg font-semibold tabular-nums ${c}`}>{money(v as number)}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-[5px] border border-line bg-white shadow-sm">
            <table className="w-full min-w-[46rem] text-xs">
              <thead>
                <tr className="border-b border-line bg-slate-50 text-left text-muted">
                  <th className="px-3 py-2 font-medium">Date</th>
                  {admin && <th className="px-3 py-2 font-medium">Staff</th>}
                  <th className="px-3 py-2 font-medium">Activity / details</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Commission</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-line align-top last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{fmtDate(e.occurred_on)}</td>
                    {admin && <td className="px-3 py-2 text-navy">{name(e.staff_id)}</td>}
                    <td className="px-3 py-2">
                      <div className="font-medium text-navy">{e.label}{e.category ? <span className="ml-1 font-normal text-muted capitalize">· {e.category}</span> : null}</div>
                      {e.ref_label && <div className="text-muted">{e.ref_label}</div>}
                      {e.proof_url && <a href={e.proof_url} target="_blank" rel="noreferrer" className="text-brand underline">Proof</a>}
                      <div className="text-[10px] text-muted">by {e.created_by ?? "—"}{e.decided_by && e.status !== "pending" ? ` · ${e.status} by ${e.decided_by}` : ""}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(e.quantity).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700 tabular-nums">{money(e.amount)}</td>
                    <td className="px-3 py-2"><Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge></td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {admin && e.status === "pending" && (
                          <>
                            <form action={decideAction.bind(null, e.id, "approved")} className="flex gap-1">
                              <input type="hidden" name="back" value={here} />
                              <input name="amount" type="number" min={0} defaultValue={e.amount} aria-label={`Amount for ${e.label}`} className="input w-20 py-1 text-xs" />
                              <button className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">Approve</button>
                            </form>
                            <form action={decideAction.bind(null, e.id, "rejected")}>
                              <input type="hidden" name="back" value={here} />
                              <button className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">Reject</button>
                            </form>
                          </>
                        )}
                        {(admin ? e.status !== "paid" : e.status === "pending") && (
                          <form action={deleteEntryAction.bind(null, e.id)}>
                            <input type="hidden" name="back" value={here} />
                            <button className="px-1 py-1 text-[11px] text-muted underline hover:text-red-600">Remove</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={admin ? 7 : 6} className="px-3 py-4 text-center text-muted">No entries for these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          {admin && <p className="text-xs text-muted">Pay out approved commission month-wise from the <Link href="/incentives/admin" className="text-brand underline">Admin Panel</Link>.</p>}
        </div>

        <Card title="Log an activity">
          <LogActivityForm rules={rules} back={here} staff={admin ? staff : undefined} />
        </Card>
      </div>
    </>
  );
}
