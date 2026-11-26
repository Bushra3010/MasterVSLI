import "server-only";
import type { Store } from "./store/types";
import type { AmbassadorActivity } from "./types-crm";
import { DEFAULT_REWARD_SETTINGS, type Goodie, type RewardKey, type RewardProgram, type RewardSetting, SOCIAL_PLATFORMS } from "./types-rewards";

/** Activities the office has verified. */
export const VERIFIED: AmbassadorActivity["status"][] = ["approved", "credited", "delivered"];
const num = (v: unknown) => Number(v ?? 0) || 0;

export function createRewardsRepo(db: Store) {
  const repo = {
    async settings(): Promise<RewardSetting[]> {
      const rows = await db.select<RewardSetting>("reward_settings", { order: { column: "sort" } });
      const byKey = new Map(rows.map((r) => [r.key, r]));
      return DEFAULT_REWARD_SETTINGS.map((d) => {
        const r = byKey.get(d.key);
        return r ? { ...d, ...r, target: r.target == null ? null : Number(r.target), reward_amount: Number(r.reward_amount) } : d;
      });
    },
    async setting(key: RewardKey) {
      return (await repo.settings()).find((s) => s.key === key)!;
    },
    async saveSetting(key: RewardKey, patch: Partial<RewardSetting>) {
      const exists = (await db.select<RewardSetting>("reward_settings", { eq: { key } })).length > 0;
      if (exists) await db.update<RewardSetting>("reward_settings", { key }, patch);
      else await db.insert<RewardSetting>("reward_settings", [{ ...DEFAULT_REWARD_SETTINGS.find((d) => d.key === key)!, ...patch }]);
    },
    async program(): Promise<RewardProgram> {
      return (await db.select<RewardProgram>("reward_program", { eq: { id: 1 } }))[0] ?? { id: 1, academic_year: "2026 / 2027" };
    },
    async saveProgram(patch: Partial<RewardProgram>) {
      if ((await db.select<RewardProgram>("reward_program", { eq: { id: 1 } })).length) await db.update<RewardProgram>("reward_program", { id: 1 }, patch);
      else await db.insert<RewardProgram>("reward_program", [{ id: 1, academic_year: "2026 / 2027", ...patch }]);
    },
    activities: (studentId?: string) =>
      db.select<AmbassadorActivity>("ambassador_activities", { ...(studentId ? { eq: { student_id: studentId } } : {}), order: { column: "created_at", ascending: false } }),
    goodies: (studentId?: string) => db.select<Goodie>("reward_goodies", { ...(studentId ? { eq: { student_id: studentId } } : {}), order: { column: "earned_at", ascending: false } }),
    markCollected: (id: string) => db.update<Goodie>("reward_goodies", { id }, { status: "collected", collected_at: new Date().toISOString() }),

    /** Award goodies the student has now earned (never twice for the same thing). */
    async syncGoodies(studentId: string) {
      const [settings, program, rows, have] = await Promise.all([repo.settings(), repo.program(), repo.activities(studentId), repo.goodies(studentId)]);
      const set = (k: RewardKey) => settings.find((s) => s.key === k)!;
      const ok = rows.filter((r) => VERIFIED.includes(r.status));
      const want: { source: string; ref: string; reason: string }[] = [];
      const fb = set("institute_feedback");
      if (fb.active && fb.reward_type === "goodie" && Number(fb.target) > 0) {
        const blocks = Math.floor(ok.filter((r) => r.kind === "feedback").length / Number(fb.target));
        for (let i = 1; i <= blocks; i++) want.push({ source: "institute_feedback", ref: `block-${i}`, reason: `${fb.target} verified feedbacks` });
      }
      const so = set("social_media");
      const social = socialTotals(ok).total;
      if (so.active && so.reward_type === "goodie" && Number(so.target) > 0 && social >= Number(so.target))
        want.push({ source: "social_media", ref: program.academic_year, reason: `${Number(so.target).toLocaleString("en-IN")} social media activities` });
      for (const k of ["mentor", "incident"] as const) {
        const st = set(k === "mentor" ? "mentorship" : "incident");
        if (st.active && st.reward_type === "goodie")
          for (const r of ok.filter((x) => x.kind === k)) want.push({ source: st.key, ref: r.id, reason: k === "mentor" ? "Mentorship approved" : "Incident report verified" });
      }
      const fresh = want.filter((w) => !have.some((g) => g.source === w.source && g.ref === w.ref));
      if (fresh.length) await db.insert<Goodie>("reward_goodies", fresh.map((w) => ({ ...w, student_id: studentId, status: "earned" as const, earned_at: new Date().toISOString() })));
      return fresh.length;
    },
  };
  return repo;
}
export type RewardsRepo = ReturnType<typeof createRewardsRepo>;

/** Likes / shares / subscribes per platform from verified social activities. */
export function socialTotals(rows: AmbassadorActivity[]) {
  const by = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, { like: 0, share: 0, subscribe: 0, total: 0 }])) as Record<string, { like: number; share: number; subscribe: number; total: number }>;
  for (const r of rows.filter((x) => x.kind === "social")) {
    const p = by[String(r.data?.platform ?? "")];
    if (!p) continue;
    p.like += num(r.data?.likes);
    p.share += num(r.data?.shares);
    p.subscribe += num(r.data?.subscribes);
    p.total = p.like + p.share + p.subscribe;
  }
  return { by, total: Object.values(by).reduce((a, p) => a + p.total, 0) };
}

/** Everything the student's Earn & Rewards page shows. */
export function rewardsSummary(rows: AmbassadorActivity[], goodies: Goodie[], settings: RewardSetting[], month = new Date().toISOString().slice(0, 7)) {
  const set = (k: RewardKey) => settings.find((s) => s.key === k)!;
  const ok = rows.filter((r) => VERIFIED.includes(r.status));
  const paid = rows.filter((r) => r.status === "credited");
  const when = (r: AmbassadorActivity) => (r.decided_at ?? r.created_at).slice(0, 7);
  const lifetime = paid.reduce((a, r) => a + num(r.reward_amount), 0);
  const monthEarned = paid.filter((r) => when(r) === month).reduce((a, r) => a + num(r.reward_amount), 0);
  const score = lifetime + 500 * goodies.length;
  const rank = score >= 20000 ? "Platinum" : score >= 8000 ? "Gold" : score >= 2000 ? "Silver" : rows.length ? "Bronze" : "New";

  const fbTarget = Math.max(1, Number(set("institute_feedback").target ?? 4));
  const feedbacks = rows.filter((r) => r.kind === "feedback" && r.status !== "rejected").reverse(); // oldest first
  const verifiedFb = ok.filter((r) => r.kind === "feedback").length;
  let cycleStart = Math.floor(verifiedFb / fbTarget) * fbTarget;
  // Just completed a set with nothing new submitted yet: keep showing the finished set ("Eligible for Goodie!").
  if (verifiedFb > 0 && verifiedFb % fbTarget === 0 && feedbacks.length === verifiedFb) cycleStart -= fbTarget;
  const cycle = feedbacks.slice(cycleStart, cycleStart + fbTarget);
  const slots = Array.from({ length: fbTarget }, (_, i) => cycle[i] ?? null);
  const cycleVerified = cycle.filter((r) => VERIFIED.includes(r.status)).length;

  const social = socialTotals(ok);
  const socialTarget = Math.max(1, Number(set("social_media").target ?? 10000));
  const refTarget = Math.max(1, Number(set("referral").target ?? 1));
  const referrals = ok.filter((r) => r.kind === "referral").length;
  const mentor = rows.find((r) => r.kind === "mentor" && r.status !== "rejected");
  const parts = [
    Math.min(1, verifiedFb / fbTarget),
    Math.min(1, social.total / socialTarget),
    Math.min(1, referrals / refTarget),
    mentor ? (VERIFIED.includes(mentor.status) ? 1 : 0.5) : 0,
  ];
  return {
    lifetime,
    monthEarned,
    goodiesEarned: goodies.length,
    goodiesCollected: goodies.filter((g) => g.status === "collected").length,
    rank,
    progress: Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100),
    feedback: { target: fbTarget, slots, cycleVerified, eligible: cycleVerified >= fbTarget || (verifiedFb >= fbTarget && cycle.length === 0) },
    social: { ...social, target: socialTarget, pct: Math.min(100, Math.round((social.total / socialTarget) * 100)) },
    mentor,
    counts: { pending: rows.filter((r) => r.status === "pending").length, verified: ok.length, rejected: rows.filter((r) => r.status === "rejected").length },
  };
}
