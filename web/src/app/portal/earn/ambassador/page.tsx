import { Crown } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { inr, todayISO } from "@/lib/format";
import { createRewardsRepo, rewardsSummary } from "@/lib/rewards";
import { getServiceRepo } from "@/lib/server";
import { getServiceStore, requireStudent } from "@/lib/session";

export const metadata = { title: "Brand ambassador" };

/** Rank and leaderboard. Only names and totals of other students are shown. */
export default async function Ambassador() {
  const s = await requireStudent();
  const rewards = createRewardsRepo(getServiceStore());
  const [rows, goodies, settings, students] = await Promise.all([rewards.activities(), rewards.goodies(), rewards.settings(), getServiceRepo().students()]);
  const month = todayISO().slice(0, 7);
  const board = students
    .map((st) => ({ st, ...rewardsSummary(rows.filter((r) => r.student_id === st.id), goodies.filter((g) => g.student_id === st.id), settings, month) }))
    .filter((b) => b.lifetime > 0 || b.goodiesEarned > 0)
    .sort((a, b) => b.lifetime + 500 * b.goodiesEarned - (a.lifetime + 500 * a.goodiesEarned))
    .slice(0, 10);
  const me = rewardsSummary(rows.filter((r) => r.student_id === s.studentId), goodies.filter((g) => g.student_id === s.studentId), settings, month);
  return (
    <>
      <PageHeader title="Brand Ambassador" subtitle="Ranks: Bronze → Silver (₹2,000+) → Gold (₹8,000+) → Platinum (₹20,000+). Each goodie counts as ₹500." actions={<Link href="/portal/earn" className="btn-ghost">Back to Earn &amp; Rewards</Link>} />
      <div className="mb-5 flex items-center gap-4 rounded-[10px] border border-amber-200 bg-amber-50 p-4">
        <Crown size={36} className="text-amber-500" />
        <div><div className="text-sm text-muted">Your rank</div><div className="text-2xl font-bold text-[#1f2a44]">{me.rank}</div></div>
        <div className="ml-auto text-right text-sm"><div>{inr(me.lifetime)} earned</div><div>{me.goodiesEarned} goodies</div></div>
      </div>
      <Card title="Top Brand Ambassadors">
        <ol className="space-y-2">
          {board.map((b, i) => (
            <li key={b.st.id} className={`flex items-center gap-3 rounded-[6px] px-3 py-2 text-[13px] ${b.st.id === s.studentId ? "bg-orange-50" : "border border-line"}`}>
              <span className="grid size-6 place-items-center rounded-full bg-amber-100 text-xs">{i + 1}</span>
              <span className="flex-1">{b.st.full_name}</span>
              <span className="text-muted">{b.rank}</span>
              <span className="font-medium text-brand">{inr(b.lifetime)}</span>
            </li>
          ))}
          {!board.length && <li className="text-sm text-muted">No ambassadors yet.</li>}
        </ol>
      </Card>
    </>
  );
}
