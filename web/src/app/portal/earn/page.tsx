import { Award, CalendarDays, Crown, Gift, Megaphone, Wallet } from "lucide-react";
import { ambassadorStats, ambTone, EARN_WAYS } from "@/components/ambassador";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate, inr } from "@/lib/format";
import { getServiceRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import type { AmbassadorActivity } from "@/lib/types";
import { SubmitActivity } from "./submit-form";

export const metadata = { title: "Earn & rewards" };

export default async function EarnPage() {
  const s = await requireStudent();
  const repo = getServiceRepo(); // the leaderboard needs everyone's totals; only names and totals are shown
  const [all, students] = await Promise.all([repo.list<AmbassadorActivity>("ambassador_activities", { order: { column: "created_at", ascending: false } }), repo.students()]);
  const mine = all.filter((r) => r.student_id === s.studentId);
  const st = ambassadorStats(mine);
  const board = [...new Set(all.map((r) => r.student_id))].map((id) => ({ id, earned: ambassadorStats(all.filter((r) => r.student_id === id)).earned })).sort((a, b) => b.earned - a.earned).slice(0, 5);
  const name = new Map(students.map((x) => [x.id, x.full_name]));
  const counts: Record<string, number> = { referral: st.referrals, review: st.reviews, social: st.social, mentor: st.mentees };

  return (
    <>
      <PageHeader title="MasterVLSI – Brand Ambassador & Earn Program" subtitle="Refer • Review • Like • Subscribe • Mentor • Earn rewards & gifts" />
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex items-center gap-4 rounded-[5px] border border-line bg-white p-4">
          <span className="grid size-16 place-items-center rounded-full bg-orange-100 text-xl font-medium text-orange-700 ring-4 ring-orange-200">{s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}</span>
          <div className="flex-1"><div className="text-lg font-medium text-navy">{s.name}</div><div className="text-xs text-muted">Brand ambassador level</div><span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-300 px-3 py-1 text-sm font-medium text-amber-950"><Crown size={14} /> {st.level}</span></div>
        </div>
        <div className="grid grid-cols-4 gap-2 rounded-[5px] bg-navy-soft p-4 text-center">
          {[["Referrals", st.referrals], ["Reviews", st.reviews], ["Social tasks", st.social], ["Mentees", st.mentees]].map(([l, v]) => <div key={l as string}><div className="text-xl font-medium text-navy">{v}</div><div className="text-[11px] text-muted">{l}</div></div>)}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[[Wallet, "Total earnings", inr(st.earned)], [CalendarDays, "This month", inr(st.monthEarned)], [Gift, "Gifts (this month)", st.monthGifts], [Gift, "Total gifts", st.gifts], [Award, "Ambassador since", st.since ? fmtDate(st.since) : "—"]].map(([Icon, l, v]) => {
          const I = Icon as typeof Wallet;
          return <div key={l as string} className="flex items-center gap-3 rounded-[5px] border border-line bg-white p-3"><I size={22} className="text-brand" /><div><div className="text-[11px] text-muted">{l as string}</div><div className="text-base font-medium text-navy">{v as string}</div></div></div>;
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card title="How to Earn? (Activity & Rewards)">
          <ul className="space-y-2">
            {EARN_WAYS.map((w) => (
              <li key={w.kind} className={`grid items-center gap-2 rounded-[5px] ${w.tint} p-3 sm:grid-cols-[1fr_auto_auto]`}>
                <div><div className="text-[13px] font-medium text-navy">{w.title}</div><div className="text-[11px] text-muted">{w.sub}</div></div>
                <div className="text-center"><div className="text-sm font-medium text-orange-600">{w.reward}</div><div className="text-[10px] text-muted">{w.per}</div></div>
                <div className="text-center text-xs text-navy">{counts[w.kind]} done</div>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-[5px] border border-line p-3">
            <div className="mb-2 text-sm font-medium text-navy">Submit an activity</div>
            <SubmitActivity />
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Top Brand Ambassadors">
            <ol className="space-y-2">{board.map((b, k) => <li key={b.id} className={`flex items-center gap-3 rounded-[5px] px-3 py-2 text-[13px] ${b.id === s.studentId ? "bg-orange-50" : "border border-line"}`}><span className="grid size-6 place-items-center rounded-full bg-amber-100 text-xs">{k + 1}</span><span className="flex-1">{name.get(b.id)}</span><span className="text-brand">{inr(b.earned)}</span></li>)}</ol>
          </Card>
          <div className="flex items-center gap-3 rounded-[5px] border border-orange-200 bg-orange-50 p-4 text-sm font-medium text-orange-800"><Megaphone size={28} /> Keep referring, reviewing, engaging &amp; mentoring to become MasterVLSI&apos;s top Brand Ambassador!</div>
        </div>
      </div>

      <Card title="Recent Activities & Rewards" className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Activity</th><th>Details</th><th>Reward</th><th>Status</th></tr></thead>
          <tbody>
            {mine.map((r) => <tr key={r.id}><td>{fmtDate(r.created_at)}</td><td className="capitalize">{r.kind}</td><td className="text-xs">{r.details}</td><td>{Number(r.reward_amount) ? inr(r.reward_amount) : r.gift ?? "—"}</td><td><Badge tone={ambTone(r.status)}>{r.status}</Badge></td></tr>)}
            {!mine.length && <tr><td colSpan={5} className="text-center text-muted">No activities yet. Submit your first one above.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
