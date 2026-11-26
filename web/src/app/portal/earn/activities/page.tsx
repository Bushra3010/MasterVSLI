import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate, inr } from "@/lib/format";
import { createRewardsRepo } from "@/lib/rewards";
import { getServiceStore, requireStudent } from "@/lib/session";
import { KIND_LABEL } from "@/lib/types-rewards";
import { ambTone } from "@/components/ambassador";

export const metadata = { title: "My activities" };

export default async function MyActivities() {
  const s = await requireStudent();
  const rows = await createRewardsRepo(getServiceStore()).activities(s.studentId);
  return (
    <>
      <PageHeader title="My Activities" subtitle="Everything you've submitted for Earn & Rewards, and where it stands." actions={<Link href="/portal/earn" className="btn-ghost">Back to Earn &amp; Rewards</Link>} />
      <Card bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Activity</th><th>Details</th><th>Reward</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                <td className="text-xs">{r.kind === "incident" ? "Confidential report" : r.details}{r.proof_url && <> · <a href={r.proof_url} target="_blank" rel="noreferrer" className="text-brand underline">proof</a></>}</td>
                <td>{Number(r.reward_amount) ? inr(r.reward_amount) : (r.gift ?? "—")}</td>
                <td><Badge tone={ambTone(r.status)}>{r.status === "approved" ? "verified" : r.status}</Badge></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="text-center text-muted">Nothing yet. <Link href="/portal/earn" className="text-brand underline">Start earning</Link></td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
