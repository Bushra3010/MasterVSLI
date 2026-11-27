import { AlertTriangle, BadgeCheck, CalendarDays, CheckCircle2, ClipboardCheck, Clock, Coins, Eye, Gift, GraduationCap, Info, Lock, MessageSquareText, Send, Share2, ShieldAlert, Star, Trophy, Upload, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { createRewardsRepo, rewardsSummary, VERIFIED } from "@/lib/rewards";
import { getServiceRepo, getStudentReadRepo } from "@/lib/server";
import { getServiceStore, requireStudent } from "@/lib/session";
import type { AmbassadorActivity, College, RewardSetting } from "@/lib/types";
import { MENTOR_DOMAINS, rewardText, SOCIAL_PLATFORMS } from "@/lib/types-rewards";
import { applyMentorshipAction, reportIncidentAction, submitFeedbackAction, submitReferralAction, submitSocialAction } from "../actions";

export const metadata = { title: "Earn & Rewards" };

const card = "overflow-hidden rounded-[10px] border border-[#e2e8f2] bg-white shadow-sm";
const label = "mb-1 block text-[13px] font-semibold text-[#1f2a44]";
const input = "input";

function Head({ icon, title, right }: { icon: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#eef1f6] px-4 py-3">
      <span className="text-orange-500 [&_svg]:size-6">{icon}</span>
      <h2 className="text-[17px] font-semibold text-[#1f2a44]">{title}</h2>
      {right && <span className="ml-auto text-right">{right}</span>}
    </div>
  );
}
const statusPill = (r: AmbassadorActivity) =>
  VERIFIED.includes(r.status) ? (
    <span className="flex items-center gap-1 text-[13px] font-semibold text-emerald-600"><CheckCircle2 size={16} /> Verified</span>
  ) : r.status === "rejected" ? (
    <span className="text-[13px] font-semibold text-red-600">Rejected</span>
  ) : (
    <span className="flex items-center gap-1 text-[13px] text-muted"><Clock size={15} /> Pending</span>
  );

export default async function EarnPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; tab?: string }> }) {
  const sp = await searchParams;
  const s = await requireStudent();
  const rewards = createRewardsRepo(getServiceStore());
  const service = getServiceRepo();
  const [rows, goodies, settings, program, profile, colleges, students] = await Promise.all([
    rewards.activities(s.studentId),
    rewards.goodies(s.studentId),
    rewards.settings(),
    rewards.program(),
    (await getStudentReadRepo()).profile(s.studentId),
    service.list<College>("colleges", { order: { column: "name" } }),
    service.students(),
  ]);
  const sum = rewardsSummary(rows, goodies, settings, todayISO().slice(0, 7));
  // §3 One workspace: totals computed from approved transactions, never entered.
  const amount = (r: AmbassadorActivity) => Number(r.reward_amount) || 0;
  const earned = rows.filter((r) => VERIFIED.includes(r.status)).reduce((a, r) => a + amount(r), 0);
  const paidOut = rows.filter((r) => r.status === "credited" || r.status === "delivered").reduce((a, r) => a + amount(r), 0);
  const ledger = [...rows].sort((a, b) => (b.decided_at ?? b.created_at).localeCompare(a.decided_at ?? a.created_at));
  const KIND: Record<string, string> = { referral: "Referral", review: "Google review", social: "Social media", mentor: "Mentoring", feedback: "Institute feedback", incident: "Incident report" };
  const set = (k: RewardSetting["key"]) => settings.find((x) => x.key === k)!;
  const open = (k: RewardSetting["key"]) => set(k).active && !set(k).paused;
  const batchmates = profile?.student.batch_id ? students.filter((x) => x.batch_id === profile.student.batch_id && x.id !== s.studentId) : [];
  const fbTarget = sum.feedback.target;
  const tab = sp.tab === "review" ? "review" : "feedback";
  const referral = set("referral");
  const closed = (k: RewardSetting["key"]) =>
    !open(k) && <p className="m-4 flex items-center gap-2 rounded-[6px] bg-slate-100 p-2 text-xs text-muted"><Lock size={14} /> {set(k).paused ? "Paused by the office for now." : "Not open right now."}</p>;

  return (
    <>
      {/* title */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="grid size-12 place-items-center rounded-[10px] bg-orange-50 text-orange-500"><Gift size={30} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#1f2a44]">Earn &amp; Rewards</h1>
          <p className="text-sm text-[#475569]">Refer • Feedback • Like • Share • Subscribe • Mentor • Report • Earn Goodies</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 rounded-[6px] border border-line bg-white px-3 py-1.5 text-sm text-[#1f2a44]"><CalendarDays size={15} /> Academic Year : {program.academic_year}</span>
      </div>
      {sp.saved && <div role="status" className="mb-4 rounded-[6px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{sp.saved}</div>}
      {sp.error && <div role="alert" className="mb-4 rounded-[6px] border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{sp.error}</div>}

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-y-3 rounded-[10px] border-2 border-orange-300 bg-gradient-to-r from-orange-50 via-white to-orange-50 p-3 sm:grid-cols-3 xl:grid-cols-6 xl:divide-x xl:divide-orange-200">
        {[
          { l: "This Month Earned", v: inr(sum.monthEarned), i: <Coins size={30} /> },
          { l: "Lifetime Earnings", v: inr(sum.lifetime), i: <Trophy size={30} /> },
          { l: "Goodies Earned", v: sum.goodiesEarned, i: <Gift size={30} /> },
          { l: "Goodies Collected", v: sum.goodiesCollected, i: <ClipboardCheck size={30} /> },
          { l: "Ambassador Rank", v: sum.rank, i: <Star size={30} /> },
        ].map((k) => (
          <div key={k.l} className="flex items-center gap-3 px-3">
            <span className="text-amber-500">{k.i}</span>
            <div><div className="text-[13px] font-semibold text-[#1f2a44]">{k.l}</div><div className="text-xl font-bold text-[#1f2a44]">{k.v}</div></div>
          </div>
        ))}
        <div className="flex items-center gap-3 px-3">
          <span className="text-amber-500"><Star size={30} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-[#1f2a44]">Overall Progress</div>
            <div className="flex items-center gap-2"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${sum.progress}%` }} /></div><span className="text-lg font-bold text-[#1f2a44]">{sum.progress}%</span></div>
          </div>
        </div>
      </div>

      {/* §3 Earnings & Rewards — single workspace */}
      <section className={`mb-4 ${card}`}>
        <Head icon={<Coins />} title="Earnings & Rewards" right={<span className="text-[12px] text-muted">Totals are calculated from approved transactions</span>} />
        <div className="grid grid-cols-2 gap-3 border-b border-[#eef1f6] p-3 sm:grid-cols-4">
          {[
            ["Lifetime earned", inr(earned)],
            ["Available", inr(Math.max(0, earned - paidOut))],
            ["Paid", inr(paidOut)],
            ["Hampers", String(goodies.length)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-[6px] border border-line bg-white px-3 py-2">
              <div className="text-[11px] text-muted">{l}</div>
              <div className="text-xl font-bold tabular-nums text-[#1f2a44]">{v}</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50"><tr>{["Date", "Activity", "Details", "Reward", "Status"].map((h) => <th key={h} className="px-3 py-1.5 text-left text-[11px] font-semibold text-muted uppercase">{h}</th>)}</tr></thead>
            <tbody>
              {ledger.slice(0, 25).map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(r.decided_at ?? r.created_at)}</td>
                  <td className="px-3 py-1.5">{KIND[r.kind] ?? r.kind}</td>
                  <td className="px-3 py-1.5 text-muted">{r.details}</td>
                  <td className="px-3 py-1.5 font-semibold text-orange-600">{amount(r) ? inr(amount(r)) : r.gift ? r.gift : "—"}</td>
                  <td className="px-3 py-1.5">{statusPill(r)}</td>
                </tr>
              ))}
              {!ledger.length && <tr className="border-t border-line"><td colSpan={5} className="px-3 py-3 text-muted">Nothing earned yet — complete an activity below.</td></tr>}
            </tbody>
          </table>
        </div>
        {ledger.length > 25 && <p className="border-t border-line px-3 py-2 text-[11px] text-muted">Showing the 25 most recent of {ledger.length}. <Link href="/portal/earn/history" className="text-brand underline">Full history</Link>.</p>}
      </section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          {/* promo tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {[
              { href: "#refer", icon: <Users />, t: "Refer a Student", s: "Bring a friend & earn", pill: `${rewardText(referral)} / Admission`, bg: "from-orange-50 to-amber-50" },
              { href: "#feedback", icon: <MessageSquareText />, t: "Feedback / Review", s: "Share your experience", pill: `${fbTarget} Feedbacks = Goodie`, bg: "from-rose-50 to-orange-50", stars: true },
              { href: "#social", icon: <Share2 />, t: "Like • Share • Subscribe", s: "Support MasterVLSI online", pill: `Target: ${Number(set("social_media").target ?? 0).toLocaleString("en-IN")} Activities`, bg: "from-sky-50 to-blue-50" },
              { href: "#mentorship", icon: <GraduationCap />, t: "Become a Mentor", s: "Guide & support juniors", pill: "Min. 4 Months + Agreement", bg: "from-emerald-50 to-lime-50" },
              { href: "#incident", icon: <ShieldAlert />, t: "Report an Incident", s: "Keep institute & studies healthy", pill: "Verified = Goodie", bg: "from-red-50 to-rose-50" },
            ].map((p) => (
              <a key={p.t} href={p.href} className={`flex flex-col justify-between gap-2 rounded-[10px] border border-[#f1e2d4] bg-gradient-to-br ${p.bg} p-3 shadow-sm hover:shadow-md`}>
                <div className="flex items-start justify-between">
                  <span className="text-orange-500 [&_svg]:size-9">{p.icon}</span>
                  {p.stars && <span className="text-amber-400">★★★★</span>}
                </div>
                <div><div className="text-[15px] font-bold text-[#1f2a44]">{p.t}</div><div className="text-[12px] text-[#475569]">{p.s}</div></div>
                <span className="w-fit rounded-full bg-white px-3 py-1 text-[12px] font-bold text-red-600 shadow-sm">{p.pill}</span>
              </a>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {/* refer */}
            <section id="refer" className={`${card} scroll-mt-20 xl:row-span-2`}>
              <Head icon={<UserPlus />} title="Refer a Student" right={<><div className="text-[17px] font-bold text-orange-600">Earn {rewardText(referral)}</div><div className="text-[11px] text-orange-600">per eligible admission</div></>} />
              {closed("referral")}
              <form action={submitReferralAction} className="space-y-3 p-4 text-sm">
                <div><label className={label} htmlFor="r-name">Student Name <span className="text-red-500">*</span></label><input id="r-name" name="name" required minLength={2} placeholder="Friend's full name" className={input} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={label} htmlFor="r-phone">Mobile Number <span className="text-red-500">*</span></label><input id="r-phone" name="phone" required type="tel" inputMode="tel" placeholder="10-digit mobile" className={input} /></div>
                  <div><label className={label} htmlFor="r-email">Email ID</label><input id="r-email" name="email" type="email" placeholder="name@gmail.com" className={input} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={label} htmlFor="r-college">College Name</label>
                    <select id="r-college" name="college" className={input}>
                      <option value="">Select college…</option>
                      {colleges.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div><label className={label} htmlFor="r-join">Expected Joining Date</label><input id="r-join" name="join_date" type="date" min={todayISO()} max="2100-12-31" className={input} /></div>
                </div>
                <div><label className={label} htmlFor="r-info">Additional Information</label><textarea id="r-info" name="info" rows={3} maxLength={250} placeholder="e.g. B.E (ECE) – 2026, interested in ASIC/SoC DV." className={input} /><div className="text-right text-[11px] text-muted">max 250 characters</div></div>
                <div className="rounded-[8px] border border-orange-200 bg-orange-50 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[#1f2a44]"><Info size={17} className="text-orange-500" /> Referral Eligibility</div>
                  <ul className="space-y-1 text-[12.5px] text-[#334155]">
                    {["Register referral at least 7 days before admission.", "Mobile number or email ID is mandatory.", "Reward after successful admission & payment verification."].map((t) => <li key={t} className="flex gap-1.5"><CheckCircle2 size={15} className="mt-0.5 shrink-0 fill-orange-500 text-white" />{t}</li>)}
                  </ul>
                </div>
                <button disabled={!open("referral")} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-orange-500 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"><Send size={17} /> Submit Referral</button>
              </form>
            </section>

            {/* feedback */}
            <section id="feedback" className={`${card} scroll-mt-20`}>
              <Head icon={<MessageSquareText />} title="Feedback / Review Submission" />
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-2 text-center text-sm font-semibold">
                  <Link href="?tab=feedback#feedback" className={`rounded-[8px] py-2 ${tab === "feedback" ? "bg-orange-500 text-white" : "border border-line text-[#1f2a44]"}`}>Institute Feedback</Link>
                  <Link href="?tab=review#feedback" className={`rounded-[8px] py-1 leading-tight ${tab === "review" ? "bg-orange-500 text-white" : "border border-line text-[#1f2a44]"}`}><span className="font-bold text-blue-600">G</span> Google Review<div className="text-[11px] font-normal">(Voluntary)</div></Link>
                </div>
                {tab === "feedback" ? (
                  <>
                    <div className="mx-auto w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[13px] font-semibold text-red-600">Target: {fbTarget} Feedbacks = 1 Goodie</div>
                    <ul className="space-y-2">
                      {sum.feedback.slots.map((r, i) => (
                        <li key={i} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-[13px]">
                          <span className="font-medium text-[#1f2a44]">Feedback {i + 1}</span>
                          {r ? statusPill(r) : <span className="text-[13px] text-slate-400">Not submitted</span>}
                          {r ? (
                            <details className="relative text-right">
                              <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] text-brand">View <Eye size={15} /></summary>
                              <div className="absolute right-0 z-10 mt-1 w-60 rounded-[6px] border border-line bg-white p-2 text-left text-xs shadow-lg">{String(r.data?.text ?? r.details)}</div>
                            </details>
                          ) : (
                            <a href="#feedback-form" className="flex items-center gap-1 text-[13px] text-brand">Upload <Upload size={15} /></a>
                          )}
                        </li>
                      ))}
                    </ul>
                    <form id="feedback-form" action={submitFeedbackAction.bind(null, "feedback")} className="space-y-2">
                      <textarea name="text" required minLength={10} maxLength={1000} rows={2} placeholder="Your feedback about trainers, labs, classes, placement support…" aria-label="Your feedback" className={input} />
                      <button disabled={!open("institute_feedback") || sum.feedback.slots.every(Boolean)} className="w-full rounded-[8px] border border-orange-300 bg-orange-50 py-1.5 text-sm font-semibold text-orange-700 disabled:opacity-50">Submit feedback</button>
                    </form>
                    <div className={`flex items-center justify-center gap-3 rounded-[8px] border p-3 ${sum.feedback.cycleVerified >= fbTarget ? "border-emerald-300 bg-emerald-50" : "border-emerald-200 bg-emerald-50/60"}`}>
                      <Gift size={34} className="text-orange-400" />
                      <div className="text-center">
                        <div className="text-lg font-bold text-emerald-800">{sum.feedback.cycleVerified >= fbTarget ? "Eligible for Goodie!" : "Goodie progress"}</div>
                        <div className="text-sm text-emerald-800">({sum.feedback.cycleVerified} / {fbTarget} verified)</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <form action={submitFeedbackAction.bind(null, "review")} className="space-y-2 text-sm">
                    <p className="text-[13px] text-[#475569]">Post a genuine review on Google for MasterVLSI and paste its link here. Reviews are voluntary.</p>
                    <input name="proof_url" type="url" required placeholder="https://g.co/kgs/…" aria-label="Google review link" className={input} />
                    <input name="text" maxLength={300} placeholder="Note (optional)" aria-label="Note" className={input} />
                    <button disabled={!open("google_review")} className="w-full rounded-[8px] bg-orange-500 py-2 font-semibold text-white disabled:opacity-50">Submit Google review</button>
                    <ul className="space-y-1 pt-1">{rows.filter((r) => r.kind === "review").slice(0, 4).map((r) => <li key={r.id} className="flex justify-between text-xs"><span>{fmtDate(r.created_at)}</span>{statusPill(r)}</li>)}</ul>
                  </form>
                )}
              </div>
              {closed(tab === "review" ? "google_review" : "institute_feedback")}
            </section>

            {/* social */}
            <section id="social" className={`${card} scroll-mt-20`}>
              <Head icon={<Share2 />} title="Social Media Activity" />
              <div className="space-y-3 p-4">
                <div className="mx-auto w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[13px] font-semibold text-red-600">Target: {sum.social.target.toLocaleString("en-IN")} Activities</div>
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-[#1f2a44]">{["Platform", "Like", "Share", "Subscribe", "Total"].map((h) => <th key={h} className="pb-1 font-semibold">{h}</th>)}</tr></thead>
                  <tbody>
                    {SOCIAL_PLATFORMS.map((p) => {
                      const v = sum.social.by[p.key];
                      return (
                        <tr key={p.key}>
                          <td className="py-1"><span className="flex items-center gap-1.5"><span className={`size-4 rounded ${p.color}`} />{p.label}</span></td>
                          {[v.like, v.share, v.subscribe].map((n, i) => <td key={i} className="py-1"><span className="inline-block min-w-12 rounded border border-line px-1.5 py-0.5 text-center tabular-nums">{n.toLocaleString("en-IN")}</span></td>)}
                          <td className="py-1 font-bold text-emerald-700 tabular-nums">{v.total.toLocaleString("en-IN")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="text-[13px] font-semibold text-[#1f2a44]">Total Activities: <span className="float-right">{sum.social.total.toLocaleString("en-IN")} / {sum.social.target.toLocaleString("en-IN")} ({sum.social.pct}%)</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${sum.social.pct}%` }} /></div>
                <div className={`flex items-center justify-center gap-3 rounded-[8px] border p-3 ${sum.social.pct >= 100 ? "border-emerald-300 bg-emerald-50" : "border-line bg-slate-50"}`}>
                  <Gift size={34} className="text-orange-400" />
                  <div className="text-center">
                    <div className={`flex items-center gap-1 text-lg font-bold ${sum.social.pct >= 100 ? "text-emerald-800" : "text-[#475569]"}`}>{sum.social.pct >= 100 && <CheckCircle2 size={18} />}{sum.social.pct >= 100 ? "Eligible for Goodie!" : "Keep going!"}</div>
                    <div className="text-sm text-[#475569]">{sum.social.pct >= 100 ? "(Target Achieved)" : `${(sum.social.target - sum.social.total).toLocaleString("en-IN")} more to go`}</div>
                  </div>
                </div>
                <details>
                  <summary className="cursor-pointer text-center text-[13px] font-semibold text-brand">+ Add my likes / shares / subscribes</summary>
                  <form action={submitSocialAction} className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <select name="platform" required aria-label="Platform" className={`${input} col-span-3`}>{SOCIAL_PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
                    <input name="likes" type="number" min={0} placeholder="Likes" aria-label="Likes" className={input} />
                    <input name="shares" type="number" min={0} placeholder="Shares" aria-label="Shares" className={input} />
                    <input name="subscribes" type="number" min={0} placeholder="Subscribes" aria-label="Subscribes" className={input} />
                    <input name="proof_url" type="url" placeholder="Proof link (screenshot / post)" aria-label="Proof link" className={`${input} col-span-3`} />
                    <button disabled={!open("social_media")} className="col-span-3 rounded-[8px] bg-orange-500 py-2 font-semibold text-white disabled:opacity-50">Submit activity</button>
                  </form>
                </details>
              </div>
              {closed("social_media")}
            </section>

            {/* mentorship */}
            <section id="mentorship" className={`${card} scroll-mt-20`}>
              <Head icon={<GraduationCap />} title="Mentorship Application" />
              {closed("mentorship")}
              {sum.mentor ? (
                <div className="space-y-2 p-4 text-sm">
                  <p className="text-[#334155]">Your application: <b>{String(sum.mentor.data?.domain ?? "")}</b>, {fmtDate(String(sum.mentor.data?.start ?? ""))} to {fmtDate(String(sum.mentor.data?.end ?? ""))}.</p>
                  {statusPill(sum.mentor)}
                </div>
              ) : (
                <form action={applyMentorshipAction} className="space-y-3 p-4 text-sm">
                  <div><label className={label} htmlFor="m-domain">Mentorship Domain</label><select id="m-domain" name="domain" required className={input}><option value="">Select domain…</option>{MENTOR_DOMAINS.map((d) => <option key={d}>{d}</option>)}</select></div>
                  <div className="text-[13px] font-semibold text-[#1f2a44]">Duration (Minimum 4 Months)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={label} htmlFor="m-start">Start Date</label><input id="m-start" name="start" type="date" required min={todayISO()} max="2100-12-31" className={input} /></div>
                    <div><label className={label} htmlFor="m-end">End Date</label><input id="m-end" name="end" type="date" required min={todayISO()} max="2100-12-31" className={input} /></div>
                  </div>
                  <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" name="agree_duration" required className="mt-0.5 size-4 accent-orange-500" /> I agree to provide mentorship for minimum 4 months.</label>
                  <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" name="agree_terms" required className="mt-0.5 size-4 accent-orange-500" /> I accept the MasterVLSI Mentorship Agreement.</label>
                  <button disabled={!open("mentorship")} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-orange-500 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"><Users size={17} /> Apply for Mentorship</button>
                </form>
              )}
            </section>

            {/* incident */}
            <section id="incident" className={`${card} scroll-mt-20`}>
              <Head icon={<ShieldAlert />} title="Report an Incident" right={<span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[12px] font-semibold text-violet-700"><Lock size={12} /> Confidential</span>} />
              {closed("incident")}
              <form action={reportIncidentAction} className="space-y-2.5 p-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={label} htmlFor="i-about">About Whom (Student Name) <span className="text-red-500">*</span></label>
                    <input id="i-about" name="about" list="i-batchmates" required minLength={2} placeholder="Select / type student" autoComplete="off" className={input} />
                    <datalist id="i-batchmates">{batchmates.map((b) => <option key={b.id} value={b.full_name} />)}</datalist>
                  </div>
                  <div><label className={label} htmlFor="i-number">Student Number (Optional)</label><input id="i-number" name="number" placeholder="Enter number" className={input} /></div>
                </div>
                <div className="w-1/2 pr-1"><label className={label} htmlFor="i-date">Incident Date <span className="text-red-500">*</span></label><input id="i-date" name="date" type="date" required max={todayISO()} min="2000-01-01" defaultValue={todayISO()} className={input} /></div>
                <div><label className={label} htmlFor="i-desc">Description of the Incident <span className="text-red-500">*</span></label><textarea id="i-desc" name="description" required minLength={15} maxLength={500} rows={3} placeholder="Describe what happened (related to institute, training, classes, studies or student behaviour)…" className={input} /><div className="text-right text-[11px] text-muted">max 500 characters</div></div>
                <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" name="confidential" defaultChecked className="mt-0.5 size-4 accent-orange-500" /> Keep my name confidential. My identity will not be shared with the reported student.</label>
                <button disabled={!open("incident")} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-orange-500 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"><AlertTriangle size={17} /> Submit Report</button>
                <p className="flex gap-1.5 rounded-[6px] bg-amber-50 p-2 text-[12px] text-amber-900"><Info size={15} className="mt-0.5 shrink-0" /> If the complaint is found true (related to institute / training / student studies), you will win a <b className="text-orange-600">Goodie</b>.</p>
              </form>
            </section>
          </div>
        </div>

        {/* right: rules + my verification (read-only for students) */}
        <aside className="space-y-4">
          <section className="overflow-hidden rounded-[10px] border border-violet-200 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 bg-gradient-to-r from-[#3b2bbf] to-[#5b3fe0] px-4 py-3 text-lg font-semibold text-white"><BadgeCheck size={22} /> Activity Targets &amp; Rewards</h2>
            <table className="w-full text-[12.5px]">
              <thead><tr className="bg-violet-50 text-left text-[#1f2a44]">{["Activity", "Target", "Reward", "Status"].map((h) => <th key={h} className="px-3 py-1.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {settings.map((r) => (
                  <tr key={r.key} className="border-t border-violet-100">
                    <td className="px-3 py-1.5 text-[#1f2a44]">{r.label}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.target ? Number(r.target).toLocaleString("en-IN") : "–"}</td>
                    <td className="px-3 py-1.5 font-semibold text-orange-600">{rewardText(r)}</td>
                    <td className="px-3 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${!r.active ? "bg-slate-100 text-slate-600" : r.paused ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{!r.active ? "Off" : r.paused ? "Paused" : "Open"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-violet-100 px-3 py-2 text-[11px] text-muted">Academic year {program.academic_year}{program.valid_to ? ` · open till ${fmtDate(program.valid_to)}` : ""}. Targets and rewards are set by the MasterVLSI office.</p>
          </section>
          <section className="overflow-hidden rounded-[10px] border border-violet-200 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 bg-violet-50 px-4 py-3 text-lg font-semibold text-[#1f2a44]"><ClipboardCheck size={22} className="text-violet-600" /> My Verification</h2>
            <div className="grid grid-cols-3 gap-2 p-3 text-center text-[12px] font-semibold">
              <span className="rounded-[6px] border border-amber-300 bg-amber-50 py-1.5 text-amber-800">Pending ({sum.counts.pending})</span>
              <span className="rounded-[6px] border border-emerald-300 bg-emerald-50 py-1.5 text-emerald-800">Verified ({sum.counts.verified})</span>
              <span className="rounded-[6px] border border-red-300 bg-red-50 py-1.5 text-red-700">Rejected ({sum.counts.rejected})</span>
            </div>
            <div className="grid grid-cols-3 gap-2 px-3 pb-3 text-center text-[12px] font-semibold">
              <Link href="/portal/earn/activities" className="rounded-[6px] border border-violet-300 py-1.5 text-violet-800 hover:bg-violet-50">My Activities</Link>
              <Link href="/portal/earn/history" className="rounded-[6px] border border-violet-300 py-1.5 text-violet-800 hover:bg-violet-50">Rewards History</Link>
              <Link href="/portal/earn/ambassador" className="rounded-[6px] border border-violet-300 py-1.5 text-violet-800 hover:bg-violet-50">Brand Ambassador</Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
