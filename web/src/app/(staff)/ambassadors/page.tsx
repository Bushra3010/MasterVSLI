import { BarChart3, Check, Crown, Download, Gift, Settings2, SlidersHorizontal, Target, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { ambTone } from "@/components/ambassador";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { createRewardsRepo, rewardsSummary, VERIFIED } from "@/lib/rewards";
import { getRepo } from "@/lib/server";
import { getSession, getStore, isAdmin } from "@/lib/session";
import type { AmbassadorActivity, Branch } from "@/lib/types";
import { KIND_LABEL, rewardText } from "@/lib/types-rewards";
import { addAmbassadorAction, decideAmbassadorAction } from "../crm-actions";
import { markGoodieCollectedAction, saveRewardProgramAction, saveRewardSettingsAction } from "./rewards-actions";
import { Stepper } from "./stepper";

export const metadata = { title: "Brand ambassadors" };

const FILTERS: [string, string][] = [["pending", "To review"], ["verified", "Verified"], ["credited", "Credited"], ["rejected", "Rejected"], ["all", "All"]];

function detailText(r: AmbassadorActivity) {
  if (r.kind === "incident") return `${r.data?.confidential ? "🔒 Confidential · " : ""}About ${r.data?.about ?? "?"}${r.data?.number ? ` (${r.data.number})` : ""} on ${r.data?.date ?? "?"}: ${r.data?.description ?? r.details}`;
  if (r.kind === "referral" && r.data?.name) return `${r.data.name} · ${r.data.phone}${r.data.email ? ` · ${r.data.email}` : ""}${r.data.college ? ` · ${r.data.college}` : ""}${r.data.join_date ? ` · joining ${r.data.join_date}` : ""}${r.data.info ? ` · ${r.data.info}` : ""}`;
  if (r.kind === "feedback") return String(r.data?.text ?? r.details);
  return r.details;
}

export default async function AmbassadorsPage({ searchParams }: PageProps<"/ambassadors">) {
  const sp = await searchParams;
  const show = typeof sp.show === "string" ? sp.show : "pending";
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const [me, repo] = await Promise.all([getSession(), getRepo()]);
  const admin = isAdmin(me);
  const rewards = createRewardsRepo(await getStore());
  const [rows, students, settings, program, goodies, branches] = await Promise.all([
    rewards.activities(),
    repo.students(),
    rewards.settings(),
    rewards.program(),
    rewards.goodies(),
    repo.list<Branch>("branches", { order: { column: "name" } }),
  ]);
  const name = new Map(students.map((s) => [s.id, s]));
  const month = todayISO().slice(0, 7);
  const board = [...new Set(rows.map((r) => r.student_id))]
    .map((id) => ({ id, ...rewardsSummary(rows.filter((r) => r.student_id === id), goodies.filter((g) => g.student_id === id), settings, month) }))
    .sort((a, b) => b.lifetime + 500 * b.goodiesEarned - (a.lifetime + 500 * a.goodiesEarned))
    .slice(0, 8);
  const shown = rows.filter((r) => show === "all" || (show === "pending" ? r.status === "pending" || (r.status === "approved" && Number(r.reward_amount) > 0) : show === "verified" ? VERIFIED.includes(r.status) : r.status === show));
  const counts = { pending: rows.filter((r) => r.status === "pending").length, verified: rows.filter((r) => VERIFIED.includes(r.status)).length, rejected: rows.filter((r) => r.status === "rejected").length };
  const credited = rows.filter((r) => r.status === "credited").reduce((a, r) => a + Number(r.reward_amount), 0);
  const claims = goodies.filter((g) => g.status === "earned");

  return (
    <>
      <PageHeader title="Earn & Rewards — Brand Ambassador Program" subtitle="Refer • Feedback • Like • Share • Subscribe • Mentor • Report. Verify student activities, credit rewards and hand out goodies." />
      {saved && <div role="status" className="mb-4 rounded-[6px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{saved}.</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Ambassadors" value={board.length} icon={<Crown size={18} />} />
        <Stat label="Rewards credited" value={inr(credited)} tone="green" icon={<Wallet size={18} />} />
        <Stat label="Goodies earned" value={goodies.length} tone="amber" icon={<Gift size={18} />} hint={`${goodies.filter((g) => g.status === "collected").length} collected`} />
        <Stat label="Activities" value={rows.length} tone="blue" hint={(["referral", "feedback", "review", "social", "mentor", "incident"] as const).map((k) => `${rows.filter((r) => r.kind === k).length} ${KIND_LABEL[k].toLowerCase()}`).join(" · ")} />
        <Stat label="Awaiting action" value={rows.filter((r) => r.status === "pending" || r.status === "approved").length} tone="red" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 space-y-5">
          <Card
            title="Activities & rewards"
            bodyClass="p-0 overflow-x-auto"
            actions={<div className="flex gap-1 text-xs">{FILTERS.map(([f, l]) => <Link key={f} href={`/ambassadors?show=${f}`} className={`rounded px-2 py-0.5 ${show === f ? "bg-brand text-white" : "text-muted hover:text-brand"}`}>{l}</Link>)}</div>}
          >
            <table className="table">
              <thead><tr><th>Date</th><th>Student</th><th>Activity</th><th>Details</th><th>Reward</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td><Link href={`/students/${r.student_id}`} className="font-medium text-navy hover:text-brand">{name.get(r.student_id)?.full_name}</Link></td>
                    <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="max-w-72 text-xs">{detailText(r)}{r.proof_url && <> · <a href={r.proof_url} target="_blank" rel="noreferrer" className="text-brand">proof</a></>}</td>
                    <td className="whitespace-nowrap">{Number(r.reward_amount) ? inr(r.reward_amount) : (r.gift ?? "—")}</td>
                    <td><Badge tone={ambTone(r.status)}>{r.status === "approved" ? "verified" : r.status}</Badge></td>
                    <td className="text-xs whitespace-nowrap">
                      {r.status === "pending" && (
                        <form action={decideAmbassadorAction.bind(null, r.id, "approved")} className="inline-flex items-center gap-1">
                          {r.kind === "referral" && <input name="reward_amount" type="number" min={0} placeholder="₹" aria-label="Reward amount" className="input w-20 py-1" />}
                          <button className="text-emerald-700 hover:underline">{r.kind === "referral" ? "Approve" : "Verify"}</button>
                        </form>
                      )}
                      {r.status === "approved" && Number(r.reward_amount) > 0 && (
                        <form action={decideAmbassadorAction.bind(null, r.id, "credited")} className="inline-flex items-center gap-1">
                          <input name="reward_amount" type="number" min={0} defaultValue={Number(r.reward_amount)} aria-label="Reward amount" className="input w-20 py-1" />
                          <button className="text-emerald-700 hover:underline">Mark credited</button>
                        </form>
                      )}
                      {(r.status === "pending" || r.status === "approved") && <> · <form action={decideAmbassadorAction.bind(null, r.id, "rejected")} className="inline"><button className="text-muted hover:text-brand">Reject</button></form></>}
                    </td>
                  </tr>
                ))}
                {!shown.length && <tr><td colSpan={7} className="text-center text-muted">Nothing here.</td></tr>}
              </tbody>
            </table>
            <form action={addAmbassadorAction} className="flex flex-wrap items-center gap-2 border-t border-line p-3">
              <select name="student_id" required aria-label="Student" className="input w-auto py-1.5">{students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
              <select name="kind" aria-label="Activity" className="input w-auto py-1.5">{(["referral", "feedback", "review", "social", "mentor", "incident"] as const).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
              <input name="details" required placeholder="Details" aria-label="Details" className="input min-w-48 flex-1 py-1.5" />
              <input name="reward_amount" type="number" min={0} placeholder="₹ reward (blank = standard)" aria-label="Reward" className="input w-52 py-1.5" />
              <button className="btn-primary py-1.5 text-xs">+ Record activity</button>
            </form>
          </Card>

          <Card title={`Reward claims — goodies to hand out (${claims.length})`} icon={<Gift size={15} />} bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Student</th><th>Goodie for</th><th>Earned on</th><th /></tr></thead>
              <tbody>
                {claims.map((g) => (
                  <tr key={g.id}>
                    <td><Link href={`/students/${g.student_id}`} className="font-medium text-navy hover:text-brand">{name.get(g.student_id)?.full_name}</Link></td>
                    <td>{g.reason}</td>
                    <td>{fmtDate(g.earned_at)}</td>
                    <td><form action={markGoodieCollectedAction.bind(null, g.id)}><button className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">Mark collected</button></form></td>
                  </tr>
                ))}
                {!claims.length && <tr><td colSpan={4} className="text-center text-muted">No goodies waiting to be collected.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>

        {/* admin control panel */}
        <div className="space-y-4">
          <section className="overflow-hidden rounded-[10px] border border-violet-200 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 bg-gradient-to-r from-[#3b2bbf] to-[#5b3fe0] px-4 py-3 text-lg font-semibold text-white"><Settings2 size={22} /> Admin Control Panel</h2>
            <div className="p-3">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-[#1f2a44]"><Target size={18} className="text-red-500" /> Activity Target &amp; Reward Settings</h3>
              <form action={saveRewardSettingsAction}>
                <table className="w-full text-[12.5px]">
                  <thead><tr className="text-left text-[#1f2a44]">{["Activity", "Target / Count", "Reward", "Status"].map((h) => <th key={h} className="pb-1.5 font-semibold">{h}</th>)}</tr></thead>
                  <tbody>
                    {settings.map((s) => (
                      <tr key={s.key} className="border-t border-violet-100 align-middle">
                        <td className="py-1.5 pr-1 text-[#1f2a44]">{s.label}</td>
                        <td className="py-1.5 pr-1">{s.target != null || s.key === "institute_feedback" || s.key === "social_media" || s.key === "referral" ? <Stepper name={`target.${s.key}`} defaultValue={Number(s.target ?? 1)} step={s.key === "social_media" ? 1000 : 1} label={`Target for ${s.label}`} /> : <span className="text-muted">–</span>}</td>
                        <td className="py-1.5 pr-1">
                          <select name={`type.${s.key}`} defaultValue={s.reward_type} aria-label={`Reward type for ${s.label}`} className="w-24 rounded border border-line px-1 py-0.5 text-[12px] font-semibold text-orange-600">
                            <option value="goodie">Goodie</option>
                            <option value="amount">Amount ₹</option>
                            <option value="mentorship">Mentorship</option>
                            <option value="none">None</option>
                          </select>
                          <input name={`amount.${s.key}`} type="number" min={0} defaultValue={s.reward_amount} aria-label={`Reward amount for ${s.label}`} title="Amount (₹), used when the reward type is Amount" className={`mt-1 w-24 rounded border border-line px-1 py-0.5 text-[12px] ${s.reward_type === "amount" ? "" : "opacity-50"}`} />
                        </td>
                        <td className="py-1.5">
                          <label className="relative inline-flex cursor-pointer items-center" title="On / off">
                            <input type="checkbox" name={`active.${s.key}`} defaultChecked={s.active} aria-label={`${s.label} on`} className="peer sr-only" />
                            <span className="h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-emerald-500 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                          </label>
                          <label className="mt-1 flex items-center gap-1 text-[10px] text-muted"><input type="checkbox" name={`paused.${s.key}`} defaultChecked={s.paused} className="size-3" /> Pause</label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {admin ? <button className="mt-2 w-full rounded-[6px] bg-[#4b34d6] py-1.5 text-sm font-semibold text-white">Save settings</button> : <p className="mt-2 text-xs text-muted">Only admins can change these.</p>}
              </form>
            </div>
          </section>

          <section className="overflow-hidden rounded-[10px] border border-violet-200 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 bg-violet-50 px-4 py-3 text-lg font-semibold text-[#1f2a44]"><SlidersHorizontal size={20} className="text-violet-600" /> Program Controls</h2>
            <ul className="space-y-1 px-4 pt-3 text-[13px] text-[#1f2a44]">
              {["Enable / Disable any activity", "Stop / Pause an activity (Temporarily)", "Change reward type (Goodie / Amount / Mentorship)", "Update target anytime (e.g., 10,000 → 110,000)", "Set validity & academic year", "Configure rewards per batch / domain"].map((t) => (
                <li key={t} className="flex items-center gap-2"><span className="grid size-4 place-items-center rounded-sm bg-orange-500 text-white"><Check size={12} strokeWidth={3} /></span>{t}</li>
              ))}
            </ul>
            <form action={saveRewardProgramAction} className="grid grid-cols-2 gap-2 p-4 text-[13px]">
              <label className="col-span-2">Academic year<input name="academic_year" defaultValue={program.academic_year} className="input mt-0.5 py-1.5" /></label>
              <label>Valid from<input name="valid_from" type="date" defaultValue={program.valid_from ?? ""} className="input mt-0.5 py-1.5" /></label>
              <label>Valid to<input name="valid_to" type="date" defaultValue={program.valid_to ?? ""} className="input mt-0.5 py-1.5" /></label>
              <label className="col-span-2">Batch / domain
                <select name="branch_id" defaultValue={program.branch_id ?? ""} className="input mt-0.5 py-1.5">
                  <option value="">All batches & domains</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              {admin && <button className="col-span-2 rounded-[6px] bg-[#4b34d6] py-1.5 text-sm font-semibold text-white">Save program</button>}
            </form>
          </section>

          <section className="overflow-hidden rounded-[10px] border border-violet-200 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 bg-violet-50 px-4 py-3 text-lg font-semibold text-[#1f2a44]"><BarChart3 size={20} className="text-violet-600" /> Reports &amp; Verification</h2>
            <div className="grid grid-cols-3 gap-2 p-3 text-center text-[12px] font-semibold">
              <Link href="/ambassadors?show=pending" className="rounded-[6px] border border-amber-300 bg-amber-50 py-1.5 text-amber-800">Pending Verifications ({counts.pending})</Link>
              <Link href="/ambassadors?show=verified" className="rounded-[6px] border border-emerald-300 bg-emerald-50 py-1.5 text-emerald-800">Verified ({counts.verified})</Link>
              <Link href="/ambassadors?show=rejected" className="rounded-[6px] border border-red-300 bg-red-50 py-1.5 text-red-700">Rejected ({counts.rejected})</Link>
            </div>
            <div className="grid grid-cols-3 gap-2 px-3 pb-3 text-center text-[12px] font-semibold">
              {[["activities", "Activity Report"], ["students", "Student-wise Summary"], ["claims", "Reward Claims"]].map(([t, l]) => (
                <a key={t} href={`/api/export/rewards?type=${t}`} className="flex items-center justify-center gap-1 rounded-[6px] border border-violet-300 py-1.5 text-violet-800 hover:bg-violet-50"><Download size={12} /> {l}</a>
              ))}
            </div>
          </section>

          <Card title="Top Brand Ambassadors" icon={<Trophy size={15} />}>
            <ol className="space-y-2">
              {board.map((b, k) => (
                <li key={b.id} className="flex items-center gap-3 rounded-[5px] border border-line px-3 py-2 text-[13px]">
                  <span className={`grid size-6 place-items-center rounded-full text-xs font-medium ${k === 0 ? "bg-amber-400 text-white" : k === 1 ? "bg-slate-300" : k === 2 ? "bg-orange-300" : "bg-slate-100"}`}>{k + 1}</span>
                  <span className="flex-1 font-medium text-navy">{name.get(b.id)?.full_name}<div className="text-[11px] font-normal text-muted">{b.rank} · {b.goodiesEarned} goodies</div></span>
                  <span className="text-brand tabular-nums">{inr(b.lifetime)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-muted">Rewards now: {settings.filter((s) => s.active).map((s) => `${s.label} – ${rewardText(s)}`).join(" · ")}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
