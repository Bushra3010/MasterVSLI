import { Award, BarChart3, CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, Eye, Filter, Gift, GraduationCap, Handshake, IndianRupee, Layers, ListChecks, Star, Target, Trophy, Users, Video } from "lucide-react";
import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { createIncentiveRepo, currentMonth, monthName, shiftMonthKey } from "@/lib/incentives";
import { fmtDate } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession, getStore, isAdmin } from "@/lib/session";
import { STATUS_TONE } from "@/lib/types-incentives";
import { Donut, IncentiveTabs, Kpi, LogActivityForm, money, pct } from "./parts";

export const metadata = { title: "HR Dashboard" };

const box = "rounded-[5px] border border-line bg-white shadow-sm";
const SAVED: Record<string, string> = { logged: "Activity submitted for approval" };
const METRIC_ICON = { admissions: GraduationCap, reviews: Star, feedback_videos: Video, video_views: Eye, interviews: CalendarCheck, tieups: Handshake } as const;

export default async function HrDashboard({ searchParams }: { searchParams: Promise<{ staff?: string; month?: string; saved?: string }> }) {
  const sp = await searchParams;
  const [me, repo] = await Promise.all([getSession(), getRepo()]);
  const admin = isAdmin(me);
  const staff = await repo.staff();
  const mine = (await repo.staffForUser(me?.userId, me?.email)) ?? (me?.demo ? staff[0] : null);
  const viewing = (admin && sp.staff ? staff.find((s) => s.id === sp.staff) : null) ?? mine ?? (admin ? staff[0] : null);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();

  if (!viewing)
    return (
      <>
        <PageHeader title="HR Dashboard" />
        <Empty>Your login ({me?.email ?? "unknown"}) isn&apos;t linked to a staff record yet. An admin can add this email to your record in <Link href="/hr" className="text-brand underline">Staff &amp; HR</Link>.</Empty>
      </>
    );

  const inc = createIncentiveRepo(await getStore());
  const [sum, board] = await Promise.all([inc.summary(viewing.id, month), inc.leaderboard(month, staff)]);
  const q = (p: { staff?: string; month?: string }) => {
    const u = new URLSearchParams();
    const st = p.staff ?? (sp.staff || undefined);
    const mo = p.month ?? month;
    if (st) u.set("staff", st);
    if (mo !== currentMonth()) u.set("month", mo);
    return u.toString() ? `?${u}` : "";
  };
  const rule = (k: string) => sum.rules.find((r) => r.key === k);
  const growth = sum.lastMonth ? Math.round(((sum.earnedMonth - sum.lastMonth) / sum.lastMonth) * 100) : null;
  const maxTrend = Math.max(1, ...sum.trend.map((x) => x.amount));
  const funnelTotal = (rule("lead_interested")?.amount ?? 0) + (rule("interested_visited")?.amount ?? 0) + (rule("visited_admission")?.amount ?? 0);
  const milestoneTotal = sum.milestones.filter((m) => m.earned).reduce((a, m) => a + m.rule.amount, 0);
  const rank = board.findIndex((b) => b.staff.id === viewing.id) + 1;

  return (
    <>
      <PageHeader
        title="HR Dashboard"
        subtitle="Lead to admission, tie-ups, reviews and incentives"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {admin && (
              <form className="flex gap-1" action="/incentives">
                <select name="staff" defaultValue={viewing.id} aria-label="Staff member" className="input w-auto py-1.5 text-xs">
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                {month !== currentMonth() && <input type="hidden" name="month" value={month} />}
                <button className="btn-ghost py-1.5 text-xs">View</button>
              </form>
            )}
            <div className="flex items-center rounded-[5px] border border-line bg-white text-xs">
              <Link href={`/incentives${q({ month: shiftMonthKey(month, -1) })}`} aria-label="Previous month" className="p-2 hover:bg-slate-50"><ChevronLeft size={14} /></Link>
              <span className="px-2 font-medium text-navy">{monthName(month)}</span>
              <Link href={`/incentives${q({ month: shiftMonthKey(month, 1) })}`} aria-label="Next month" className="p-2 hover:bg-slate-50"><ChevronRight size={14} /></Link>
            </div>
          </div>
        }
      />
      <IncentiveTabs active="dashboard" admin={admin} />
      {sp.saved && SAVED[sp.saved] && <div role="status" className="mb-4 rounded-[5px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{SAVED[sp.saved]}.</div>}

      <div className="mb-4 flex items-center gap-3 rounded-[5px] border border-line bg-white p-3 shadow-sm">
        <span className="grid size-11 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{viewing.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-navy">{viewing.full_name}{viewing.id === mine?.id && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}</div>
          <div className="text-xs text-muted">{viewing.designation ?? "Staff"}{viewing.department ? ` · ${viewing.department}` : ""}</div>
        </div>
        {rank > 0 && <Badge tone="amber"><Trophy size={12} /> Rank #{rank} this month</Badge>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
        <Kpi label="This month earned" value={money(sum.earnedMonth)} sub={growth == null ? "First month" : <span className={growth >= 0 ? "text-emerald-700" : "text-red-600"}>{growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}% vs last month</span>} icon={<IndianRupee size={20} className="text-emerald-600" />} tint="border-emerald-200 bg-emerald-50" />
        <Kpi label="Pending commission" value={money(sum.pendingAmount)} sub={`${sum.pendingCount} ${sum.pendingCount === 1 ? "activity" : "activities"} awaiting approval`} icon={<Clock size={20} className="text-blue-600" />} tint="border-blue-200 bg-blue-50" />
        <Kpi label="Lifetime earnings" value={money(sum.lifetime)} icon={<Layers size={20} className="text-violet-600" />} tint="border-violet-200 bg-violet-50" />
        <Kpi label="Best earning month" value={sum.best ? money(sum.best.amount) : "—"} sub={sum.best ? monthName(sum.best.month) : undefined} icon={<Trophy size={20} className="text-amber-600" />} tint="border-amber-200 bg-amber-50" />
        <Kpi label={`Admissions (${monthName(month, "short")})`} value={sum.admissions.total} sub={`Normal ${sum.admissions.normal} · College ${sum.admissions.college} · Corporate ${sum.admissions.corporate}`} icon={<Users size={20} className="text-rose-600" />} tint="border-rose-200 bg-rose-50" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {/* lead flow */}
        <section className={`${box} p-4`}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy"><Filter size={15} /> Lead conversion &amp; admission flow</h2>
          <div className="flex items-stretch gap-1 text-center text-xs">
            {[
              { l: "Lead", s: "(Enquiry)", c: "border-blue-200 bg-blue-50 text-blue-800" },
              { l: "Interested", s: money(rule("lead_interested")?.amount ?? 0), c: "border-orange-200 bg-orange-50 text-orange-800" },
              { l: "Visited", s: money(rule("interested_visited")?.amount ?? 0), c: "border-emerald-200 bg-emerald-50 text-emerald-800" },
              { l: "Admission", s: money(rule("visited_admission")?.amount ?? 0), c: "border-amber-200 bg-amber-50 text-amber-800" },
            ].map((x, i) => (
              <div key={x.l} className="flex flex-1 items-center gap-1">
                <div className={`flex-1 rounded-[5px] border px-1 py-3 ${x.c}`}>
                  <div className="font-semibold">{x.l}</div>
                  <div className="mt-0.5 text-sm font-semibold">{x.s}</div>
                </div>
                {i < 3 && <ChevronRight size={14} className="shrink-0 text-brand" />}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-navy"><Award size={16} className="text-emerald-600" /> Total commission per admission</div>
            <div className="text-2xl font-semibold text-navy">{money(funnelTotal)}</div>
            <div className="text-[11px] text-muted">Individual: Normal / College / Corporate. Credited automatically when the lead moves stage.</div>
          </div>
          <Link href="/leads" className="mt-3 block text-center text-xs text-brand hover:underline">Open Lead Management →</Link>
        </section>

        {/* trend */}
        <section className={`${box} p-4`}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy"><BarChart3 size={15} /> Monthly earnings trend</h2>
          <div className="flex h-52 items-end gap-3 border-b border-line px-1">
            {sum.trend.map((t, i) => (
              <div key={t.month} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold text-navy tabular-nums">{t.amount ? money(t.amount).replace(".00", "") : ""}</span>
                <div className={`w-full rounded-t ${i === 5 ? "bg-orange-500" : t.amount === Math.max(...sum.trend.map((x) => x.amount)) ? "bg-violet-600" : "bg-violet-300"}`} style={{ height: `${Math.max(2, (t.amount / maxTrend) * 170)}px` }} title={`${monthName(t.month)}: ${money(t.amount)}`} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-3 px-1">{sum.trend.map((t) => <span key={t.month} className="flex-1 text-center text-[11px] text-muted">{monthName(t.month, "short")}</span>)}</div>
        </section>

        {/* targets */}
        <section className={`${box} p-4`}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy"><Target size={15} /> Monthly targets &amp; achievement</h2>
          <ul className="space-y-3">
            {sum.targets.map((m) => {
              const p = pct(m.achieved, m.target);
              const Icon = METRIC_ICON[m.key];
              return (
                <li key={m.key} className="flex items-center gap-2 text-xs">
                  <Icon size={16} className="shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2"><span className="truncate text-navy">{m.label} <span className="text-muted">(target {m.target.toLocaleString("en-IN")})</span></span><span className="shrink-0 font-medium tabular-nums">{m.achieved.toLocaleString("en-IN")} / {m.target.toLocaleString("en-IN")}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${p >= 100 ? "bg-emerald-500" : p >= 60 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
                  </div>
                  <span className={`w-12 shrink-0 text-right font-semibold ${p >= 100 ? "text-emerald-600" : "text-muted"}`}>{p >= 100 && <CheckCircle2 size={12} className="mr-0.5 inline" />}{p}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {/* rules */}
        <section className={`${box} overflow-hidden`}>
          <h2 className="flex items-center justify-between gap-2 bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white">
            <span className="flex items-center gap-2"><ListChecks size={15} /> HR commission rules</span>
            {admin && <Link href="/incentives/admin" className="text-[11px] font-normal underline">Edit</Link>}
          </h2>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-line text-left text-muted"><th className="px-3 py-2 font-medium">Activity / achievement</th><th className="px-3 py-2 font-medium">Commission</th></tr></thead>
            <tbody>
              {sum.rules.filter((r) => r.active).map((r) => (
                <tr key={r.key} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 text-navy">{r.label}</td>
                  <td className="px-3 py-1.5 font-medium text-emerald-700">{r.unit === "admin configurable" ? <span className="text-muted">Admin configurable</span> : <>{money(r.amount)} <span className="font-normal text-muted">{r.unit}</span></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="space-y-5">
          {/* breakdown */}
          <section className={`${box} p-4`}>
            <h2 className="mb-3 text-sm font-semibold text-navy">Commission breakdown ({monthName(month, "short")} {month.slice(0, 4)})</h2>
            <div className="flex flex-wrap items-center gap-4">
              <Donut parts={sum.breakdown.map((b) => ({ value: b.amount, color: b.color }))}>
                <div><div className="text-base font-semibold text-navy">{money(sum.earnedMonth)}</div><div className="text-[10px] text-muted">Total earned</div></div>
              </Donut>
              <ul className="min-w-0 flex-1 space-y-1 text-xs">
                {sum.breakdown.map((b) => (
                  <li key={b.key} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: b.color }} />
                    <span className="flex-1 truncate text-navy">{b.label} ({b.count.toLocaleString("en-IN")})</span>
                    <span className="font-medium tabular-nums">{money(b.amount)}</span>
                    <span className="w-9 text-right text-muted">{pct(b.amount, sum.earnedMonth)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          {/* recent */}
          <section className={box}>
            <h2 className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-navy">Recent commission earned <Link href={`/incentives/earnings${q({})}`} className="text-xs font-normal text-brand hover:underline">View all</Link></h2>
            <table className="w-full text-xs">
              <thead><tr className="border-y border-line bg-slate-50 text-left text-muted"><th className="px-3 py-1.5 font-medium">Date</th><th className="px-3 py-1.5 font-medium">Activity</th><th className="px-3 py-1.5 text-right font-medium">Commission</th></tr></thead>
              <tbody>
                {sum.recent.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted">{fmtDate(e.occurred_on)}</td>
                    <td className="px-3 py-1.5"><div className="truncate text-navy">{e.ref_label || e.label}</div><div className="text-[10px] text-muted">{e.label}{e.quantity > 1 ? ` × ${e.quantity}` : ""} · <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge></div></td>
                    <td className="px-3 py-1.5 text-right font-semibold text-emerald-700 tabular-nums">{money(e.amount)}</td>
                  </tr>
                ))}
                {!sum.recent.length && <tr><td colSpan={3} className="px-3 py-3 text-center text-muted">No commission yet.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>

        <div className="space-y-5">
          {/* leaderboard */}
          <section id="leaderboard" className={`${box} p-4`}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy"><Trophy size={15} className="text-amber-500" /> Top HR performers ({monthName(month, "short")})</h2>
            <ol className="space-y-1.5">
              {board.slice(0, 5).map((b, i) => (
                <li key={b.staff.id} className={`flex items-center gap-2 rounded-[5px] px-2 py-1.5 text-xs ${b.staff.id === viewing.id ? "bg-amber-50 ring-1 ring-amber-200" : ""}`}>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full font-semibold ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-300 text-navy" : i === 2 ? "bg-orange-300 text-white" : "bg-slate-100 text-muted"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-navy">{b.staff.full_name}{b.staff.id === mine?.id ? " (you)" : ""}</div>
                    <div className="text-[10px] text-muted">{b.admissions} admissions</div>
                  </div>
                  <span className="font-semibold text-emerald-700 tabular-nums">{money(b.amount)}</span>
                </li>
              ))}
              {!board.length && <li className="text-xs text-muted">No earnings recorded for this month yet.</li>}
            </ol>
          </section>
          {/* milestones */}
          <section className={`${box} p-4`}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy"><Award size={15} className="text-amber-500" /> Monthly achievement summary</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              {sum.milestones.map((m) => (
                <div key={m.rule.key} className={`rounded-[5px] border p-2 ${m.earned ? "border-emerald-300 bg-emerald-50" : "border-line bg-slate-50"}`}>
                  <div className="text-lg font-semibold text-navy tabular-nums">{m.achieved.toLocaleString("en-IN")}</div>
                  <div className="text-[10px] leading-tight text-muted">{m.rule.label.replace("Milestone: ", "of ")}</div>
                  <div className={`mt-1 text-[11px] font-medium ${m.earned ? "text-emerald-700" : "text-muted"}`}>{m.earned ? `✓ ${money(m.rule.amount)}` : `${money(m.rule.amount)} at ${Number(m.rule.threshold).toLocaleString("en-IN")}`}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[5px] border border-pink-200 bg-gradient-to-r from-pink-50 to-amber-50 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium text-navy"><Gift size={18} className="text-pink-500" /> Total achievement incentive</span>
              <span className="text-lg font-semibold text-navy">{money(milestoneTotal)}</span>
            </div>
          </section>
        </div>
      </div>

      <section className={`${box} mt-5 p-4`}>
        <h2 className="mb-1 text-sm font-semibold text-navy">Log an activity</h2>
        <p className="mb-3 text-xs text-muted">Reviews, feedback videos, video views, interviews, bulk admissions and tie-ups. An admin approves each one before it counts. Lead stages and admissions are credited automatically.</p>
        <div className="max-w-2xl"><LogActivityForm rules={sum.rules} back={`/incentives${q({})}`} staff={admin ? staff : undefined} /></div>
      </section>
    </>
  );
}
