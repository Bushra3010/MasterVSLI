import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate, inr } from "@/lib/format";
import { createRewardsRepo } from "@/lib/rewards";
import { getServiceStore, requireStudent } from "@/lib/session";
import { KIND_LABEL } from "@/lib/types-rewards";

export const metadata = { title: "Rewards history" };

export default async function RewardsHistory() {
  const s = await requireStudent();
  const rewards = createRewardsRepo(getServiceStore());
  const [rows, goodies] = await Promise.all([rewards.activities(s.studentId), rewards.goodies(s.studentId)]);
  const money = rows.filter((r) => r.status === "credited" && Number(r.reward_amount) > 0);
  return (
    <>
      <PageHeader title="Rewards History" subtitle="Money credited to you and goodies you've earned." actions={<Link href="/portal/earn" className="btn-ghost">Back to Earn &amp; Rewards</Link>} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={`Cash rewards · ${inr(money.reduce((a, r) => a + Number(r.reward_amount), 0))}`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>For</th><th>Amount</th></tr></thead>
            <tbody>
              {money.map((r) => <tr key={r.id}><td>{fmtDate(r.decided_at ?? r.created_at)}</td><td>{KIND_LABEL[r.kind]} – {r.details}</td><td className="font-medium text-emerald-700">{inr(r.reward_amount)}</td></tr>)}
              {!money.length && <tr><td colSpan={3} className="text-center text-muted">No cash rewards yet</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title={`Goodies · ${goodies.length} earned, ${goodies.filter((g) => g.status === "collected").length} collected`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Earned on</th><th>For</th><th>Status</th></tr></thead>
            <tbody>
              {goodies.map((g) => <tr key={g.id}><td>{fmtDate(g.earned_at)}</td><td>{g.reason}</td><td><Badge tone={g.status === "collected" ? "green" : "amber"}>{g.status === "collected" ? `Collected ${g.collected_at ? fmtDate(g.collected_at) : ""}` : "Collect at the office"}</Badge></td></tr>)}
              {!goodies.length && <tr><td colSpan={3} className="text-center text-muted">No goodies yet</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
