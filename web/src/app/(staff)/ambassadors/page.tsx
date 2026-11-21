import { Crown, Gift, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { ambassadorStats, ambTone, EARN_WAYS } from "@/components/ambassador";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { fmtDate, inr } from "@/lib/format";
import { getRepo } from "@/lib/server";
import type { AmbassadorActivity } from "@/lib/types";
import { addAmbassadorAction, decideAmbassadorAction } from "../crm-actions";

export const metadata = { title: "Brand ambassadors" };

export default async function AmbassadorsPage({ searchParams }: PageProps<"/ambassadors">) {
  const sp = await searchParams;
  const show = typeof sp.show === "string" ? sp.show : "pending";
  const repo = await getRepo();
  const [rows, students] = await Promise.all([repo.list<AmbassadorActivity>("ambassador_activities", { order: { column: "created_at", ascending: false } }), repo.students()]);
  const name = new Map(students.map((s) => [s.id, s]));
  const board = [...new Set(rows.map((r) => r.student_id))]
    .map((id) => ({ id, ...ambassadorStats(rows.filter((r) => r.student_id === id)) }))
    .sort((a, b) => b.earned - a.earned)
    .slice(0, 10);
  const shown = rows.filter((r) => show === "all" || (show === "pending" ? r.status === "pending" || r.status === "approved" : r.status === show));
  const total = ambassadorStats(rows);

  return (
    <>
      <PageHeader title="Brand Ambassador & Earn Program" subtitle="Refer • Review • Like • Subscribe • Mentor. Approve student activities and credit rewards & gifts." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Ambassadors" value={board.length} icon={<Crown size={18} />} />
        <Stat label="Rewards credited" value={inr(total.earned)} tone="green" icon={<Wallet size={18} />} />
        <Stat label="Gifts delivered" value={total.gifts} tone="amber" icon={<Gift size={18} />} />
        <Stat label="Referrals" value={total.referrals} tone="blue" />
        <Stat label="Awaiting action" value={rows.filter((r) => r.status === "pending" || r.status === "approved").length} tone="red" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title="Activities & rewards"
          bodyClass="p-0 overflow-x-auto"
          actions={<div className="flex gap-1 text-xs">{["pending", "credited", "delivered", "rejected", "all"].map((f) => <Link key={f} href={`/ambassadors?show=${f}`} className={`rounded px-2 py-0.5 capitalize ${show === f ? "bg-brand text-white" : "text-muted hover:text-brand"}`}>{f === "pending" ? "To review" : f}</Link>)}</div>}
        >
          <table className="table">
            <thead><tr><th>Date</th><th>Student</th><th>Activity</th><th>Details</th><th>Reward</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td><Link href={`/students/${r.student_id}`} className="font-medium text-navy hover:text-brand">{name.get(r.student_id)?.full_name}</Link></td>
                  <td className="capitalize">{r.kind}</td>
                  <td className="max-w-64 text-xs">{r.details}{r.proof_url && <> · <a href={r.proof_url} target="_blank" rel="noreferrer" className="text-brand">proof</a></>}</td>
                  <td className="whitespace-nowrap">{Number(r.reward_amount) ? inr(r.reward_amount) : r.gift ?? "—"}</td>
                  <td><Badge tone={ambTone(r.status)}>{r.status}</Badge></td>
                  <td className="whitespace-nowrap text-xs">
                    {r.status === "pending" && (
                      <form action={decideAmbassadorAction.bind(null, r.id, "approved")} className="inline-flex items-center gap-1">
                        <input name="reward_amount" type="number" min={0} placeholder="₹" aria-label="Reward amount" className="input w-20 py-1" />
                        <button className="text-emerald-700 hover:underline">Approve</button>
                      </form>
                    )}
                    {r.status === "approved" && (Number(r.reward_amount) > 0
                      ? <form action={decideAmbassadorAction.bind(null, r.id, "credited")} className="inline"><button className="text-emerald-700 hover:underline">Mark credited</button></form>
                      : <form action={decideAmbassadorAction.bind(null, r.id, "delivered")} className="inline"><button className="text-blue-700 hover:underline">Gift delivered</button></form>)}
                    {(r.status === "pending" || r.status === "approved") && <> · <form action={decideAmbassadorAction.bind(null, r.id, "rejected")} className="inline"><button className="text-muted hover:text-brand">Reject</button></form></>}
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={7} className="text-center text-muted">Nothing here.</td></tr>}
            </tbody>
          </table>
          <form action={addAmbassadorAction} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
            <select name="student_id" required aria-label="Student" className="input w-auto py-1.5">{students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
            <select name="kind" aria-label="Activity" className="input w-auto py-1.5"><option value="referral">Referral</option><option value="review">Google review</option><option value="social">Like / subscribe / share</option><option value="mentor">Mentor</option></select>
            <input name="details" required placeholder="Details" aria-label="Details" className="input min-w-48 flex-1 py-1.5" />
            <input name="reward_amount" type="number" min={0} placeholder="₹ reward" aria-label="Reward" className="input w-28 py-1.5" />
            <button className="btn-primary py-1.5 text-xs">+ Record activity</button>
          </form>
        </Card>

        <div className="space-y-5">
          <Card title="Top Brand Ambassadors" icon={<Trophy size={15} />}>
            <ol className="space-y-2">
              {board.map((b, k) => (
                <li key={b.id} className="flex items-center gap-3 rounded-[5px] border border-line px-3 py-2 text-[13px]">
                  <span className={`grid size-6 place-items-center rounded-full text-xs font-medium ${k === 0 ? "bg-amber-400 text-white" : k === 1 ? "bg-slate-300" : k === 2 ? "bg-orange-300" : "bg-slate-100"}`}>{k + 1}</span>
                  <span className="flex-1 font-medium text-navy">{name.get(b.id)?.full_name}<div className="text-[11px] font-normal text-muted">{b.level}</div></span>
                  <span className="tabular-nums text-brand">{inr(b.earned)}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="How students earn">
            <ul className="space-y-2">
              {EARN_WAYS.map((w) => (
                <li key={w.kind} className={`rounded-[5px] ${w.tint} p-3 text-xs`}>
                  <div className="font-medium text-navy">{w.title}</div>
                  <div className="text-muted">{w.sub}</div>
                  <div className="mt-1 font-medium text-orange-600">{w.reward} <span className="font-normal text-muted">{w.per}</span></div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
