import "server-only";
import { istDate, todayISO } from "./format";
import type { Store } from "./store/types";
import type { Lead, LeadStage, Staff } from "./types";
import {
  BREAKDOWN,
  type Commission,
  type CommissionRule,
  type CommissionStatus,
  DEFAULT_RULES,
  DEFAULT_TARGETS,
  type HrTarget,
  type IncentiveMetric,
  METRICS,
} from "./types-incentives";

const EARNED: CommissionStatus[] = ["approved", "paid"];
export const monthOf = (iso: string) => iso.slice(0, 7);
export function shiftMonthKey(month: string, n: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}
export const monthName = (month: string, style: "long" | "short" = "long") =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: style, year: style === "long" ? "numeric" : undefined, timeZone: "UTC" });

/** Lead stage → the commission rules earned on reaching it (earlier stages are credited too if they were skipped). */
const STAGE_RULES: Partial<Record<LeadStage, string[]>> = {
  interested: ["lead_interested"],
  visited: ["lead_interested", "interested_visited"],
  enrolled: ["lead_interested", "interested_visited", "visited_admission"],
};

/** Total for one metric: tie-ups count entries; everything else adds up quantities. */
export function metricTotal(entries: Commission[], rules: CommissionRule[], metric: IncentiveMetric) {
  const keys = new Set(rules.filter((r) => r.metric === metric && r.kind !== "milestone").map((r) => r.key));
  const rows = entries.filter((e) => keys.has(e.rule_key) && EARNED.includes(e.status));
  return metric === "tieups" ? rows.length : rows.reduce((a, e) => a + Number(e.quantity), 0);
}

export function createIncentiveRepo(db: Store) {
  const repo = {
    async rules(): Promise<CommissionRule[]> {
      const rows = await db.select<CommissionRule>("hr_commission_rules", { order: { column: "sort" } });
      return (rows.length ? rows : DEFAULT_RULES).map((r) => ({ ...r, amount: Number(r.amount), threshold: r.threshold == null ? null : Number(r.threshold) }));
    },
    async rule(key: string) {
      return (await repo.rules()).find((r) => r.key === key) ?? null;
    },
    saveRule: (key: string, patch: Partial<CommissionRule>) => db.update<CommissionRule>("hr_commission_rules", { key }, { ...patch, updated_at: new Date().toISOString() }),

    // ---- targets ------------------------------------------------------------------
    async targetsFor(staffId: string, month: string): Promise<Record<IncentiveMetric, number>> {
      const rows = await db.select<HrTarget>("hr_targets");
      const out = { ...DEFAULT_TARGETS };
      // most general first, most specific last
      const rank = (t: HrTarget) => (t.staff_id ? 2 : 0) + (t.month ? 1 : 0);
      for (const t of rows.filter((t) => (!t.staff_id || t.staff_id === staffId) && (!t.month || t.month === month)).sort((a, b) => rank(a) - rank(b)))
        out[t.metric] = Number(t.target);
      return out;
    },
    async allTargets() {
      return db.select<HrTarget>("hr_targets");
    },
    async setTarget(staffId: string | null, month: string | null, metric: IncentiveMetric, target: number | null) {
      const rows = (await db.select<HrTarget>("hr_targets", { eq: { metric } })).filter((t) => (t.staff_id ?? null) === staffId && (t.month ?? null) === month);
      for (const r of rows.slice(target == null ? 0 : 1)) await db.remove("hr_targets", { id: r.id });
      if (target == null) return;
      if (rows[0]) await db.update<HrTarget>("hr_targets", { id: rows[0].id }, { target });
      else await db.insert<HrTarget>("hr_targets", [{ staff_id: staffId, month, metric, target }]);
    },

    // ---- ledger ---------------------------------------------------------------------
    async entries(q: { staffId?: string; status?: CommissionStatus } = {}) {
      const eq: Record<string, string> = {};
      if (q.staffId) eq.staff_id = q.staffId;
      if (q.status) eq.status = q.status;
      const rows = await db.select<Commission>("hr_commissions", { eq, order: { column: "occurred_on", ascending: false } });
      return rows.map((r) => ({ ...r, amount: Number(r.amount), quantity: Number(r.quantity) }));
    },
    async entry(id: string) {
      return (await db.select<Commission>("hr_commissions", { eq: { id } }))[0] ?? null;
    },

    /** HR logs an activity; it waits for admin approval. */
    async log(e: { staff_id: string; rule_key: string; quantity: number; occurred_on: string; ref_label?: string | null; note?: string | null; proof_url?: string | null; amount?: number | null; category?: Commission["category"]; created_by: string }) {
      const rule = await repo.rule(e.rule_key);
      if (!rule || !rule.active || !rule.loggable) throw new Error("Pick an activity from the list");
      if (!(e.quantity > 0)) throw new Error("Enter a quantity of 1 or more");
      const amount = rule.unit === "admin configurable" ? Math.max(0, Number(e.amount) || 0) : rule.amount * e.quantity;
      const [row] = await db.insert<Commission>("hr_commissions", [
        { ...e, label: rule.label, amount, status: "pending", category: e.category ?? null, created_at: new Date().toISOString() },
      ]);
      return row;
    },

    /** System credit (lead stages, admissions, milestones): approved at once, never twice for the same thing. */
    async credit(e: { staff_id: string; rule_key: string; ref_id: string; ref_label?: string | null; quantity?: number; category?: Commission["category"]; occurred_on?: string; by?: string }) {
      const rule = await repo.rule(e.rule_key);
      if (!rule || !rule.active) return null;
      const dup = (await db.select<Commission>("hr_commissions", { eq: { rule_key: e.rule_key, ref_id: e.ref_id } })).some((x) => x.status !== "rejected");
      if (dup) return null;
      const qty = e.quantity ?? 1;
      const now = new Date().toISOString();
      const [row] = await db.insert<Commission>("hr_commissions", [
        {
          staff_id: e.staff_id, rule_key: rule.key, label: rule.label, quantity: qty, amount: rule.amount * qty, category: e.category ?? null,
          ref_id: e.ref_id, ref_label: e.ref_label ?? null, occurred_on: e.occurred_on ?? todayISO(), status: "approved",
          created_by: e.by ?? "System", decided_by: "System", decided_at: now, created_at: now,
        },
      ]);
      if (rule.kind !== "milestone") await repo.syncMilestones(e.staff_id, monthOf(row.occurred_on));
      return row;
    },

    async decide(id: string, status: "approved" | "rejected", by: string, amount?: number | null) {
      const e = await repo.entry(id);
      if (!e) throw new Error("Entry not found");
      if (e.status === "paid") throw new Error("Already paid");
      await db.update<Commission>("hr_commissions", { id }, { status, decided_by: by, decided_at: new Date().toISOString(), ...(amount != null && amount >= 0 ? { amount } : {}) });
      await repo.syncMilestones(e.staff_id, monthOf(e.occurred_on));
    },
    async markPaid(staffId: string, month: string) {
      const rows = (await repo.entries({ staffId, status: "approved" })).filter((e) => monthOf(e.occurred_on) === month);
      const now = new Date().toISOString();
      for (const r of rows) await db.update<Commission>("hr_commissions", { id: r.id }, { status: "paid", paid_at: now });
      return { count: rows.length, amount: rows.reduce((a, r) => a + r.amount, 0) };
    },
    remove: (id: string) => db.remove("hr_commissions", { id }),

    /** Credit milestone incentives reached this month (and withdraw ones no longer reached, if not yet paid). */
    async syncMilestones(staffId: string, month: string) {
      const rules = await repo.rules();
      const entries = (await repo.entries({ staffId })).filter((e) => monthOf(e.occurred_on) === month);
      for (const m of rules.filter((r) => r.kind === "milestone" && r.metric && r.threshold)) {
        const reached = metricTotal(entries, rules, m.metric!) >= Number(m.threshold);
        const ref = `${staffId}:${month}`;
        const have = entries.find((e) => e.rule_key === m.key && e.ref_id === ref && e.status !== "rejected");
        if (reached && !have && m.active) {
          const end = shiftMonthKey(month, 1) + "-01";
          const day = todayISO() < end ? todayISO() : new Date(new Date(end + "T00:00:00Z").getTime() - 86400_000).toISOString().slice(0, 10);
          await db.insert<Commission>("hr_commissions", [
            { staff_id: staffId, rule_key: m.key, label: m.label, quantity: 1, amount: m.amount, ref_id: ref, ref_label: `${monthName(month)} milestone`, occurred_on: day < month + "-01" ? month + "-01" : day, status: "approved", created_by: "System", decided_by: "System", decided_at: new Date().toISOString(), created_at: new Date().toISOString() },
          ]);
        } else if (!reached && have && have.status === "approved") await db.remove("hr_commissions", { id: have.id });
      }
    },

    // ---- automatic credits from leads and admissions ------------------------------------
    async creditLeadStage(lead: Lead, stage: LeadStage, opts: { category?: Commission["category"]; studentLabel?: string; by?: string } = {}) {
      const keys = STAGE_RULES[stage];
      if (!keys || !lead.assigned_to) return;
      const staff = await db.select<Staff>("staff");
      const who = staff.find((s) => s.id === lead.assigned_to || s.full_name.trim().toLowerCase() === lead.assigned_to!.trim().toLowerCase());
      if (!who) return;
      for (const key of keys)
        await repo.credit({ staff_id: who.id, rule_key: key, ref_id: lead.id, ref_label: opts.studentLabel ?? lead.full_name, category: key === "visited_admission" ? (opts.category ?? "normal") : null, by: opts.by });
    },
    async creditAdmission(student: { id: string; full_name: string; category: Commission["category"] }, counsellorId: string, ruleKey: string, by?: string) {
      if (!counsellorId || !ruleKey) return;
      await repo.credit({ staff_id: counsellorId, rule_key: ruleKey, ref_id: student.id, ref_label: `${student.full_name} – admission`, category: student.category ?? "normal", by });
    },

    // ---- dashboard numbers ---------------------------------------------------------------
    async summary(staffId: string, month: string) {
      const [rules, mine, targets] = await Promise.all([repo.rules(), repo.entries({ staffId }), repo.targetsFor(staffId, month)]);
      const earned = mine.filter((e) => EARNED.includes(e.status));
      const inMonth = (m: string) => earned.filter((e) => monthOf(e.occurred_on) === m);
      const sum = (rows: Commission[]) => rows.reduce((a, e) => a + e.amount, 0);
      const thisMonth = inMonth(month);
      const byMonth = new Map<string, number>();
      for (const e of earned) byMonth.set(monthOf(e.occurred_on), (byMonth.get(monthOf(e.occurred_on)) ?? 0) + e.amount);
      const best = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0];
      const pending = mine.filter((e) => e.status === "pending");
      const admissionKeys = new Set(rules.filter((r) => r.metric === "admissions").map((r) => r.key));
      const adm = thisMonth.filter((e) => admissionKeys.has(e.rule_key));
      const split = { normal: 0, college: 0, corporate: 0 };
      for (const e of adm) split[e.category ?? "normal"] += Number(e.quantity);
      const monthAll = mine.filter((e) => monthOf(e.occurred_on) === month);
      return {
        rules,
        earnedMonth: sum(thisMonth),
        lastMonth: sum(inMonth(shiftMonthKey(month, -1))),
        pendingAmount: sum(pending),
        pendingCount: pending.length,
        lifetime: sum(earned),
        best: best ? { month: best[0], amount: best[1] } : null,
        admissions: { total: split.normal + split.college + split.corporate, ...split },
        trend: Array.from({ length: 6 }, (_, i) => shiftMonthKey(month, i - 5)).map((m) => ({ month: m, amount: byMonth.get(m) ?? 0 })),
        targets: METRICS.map((m) => ({ ...m, target: targets[m.key], achieved: metricTotal(monthAll, rules, m.key) })),
        breakdown: BREAKDOWN.map((b) => {
          const rows = thisMonth.filter((e) => b.rules.includes(e.rule_key));
          return { ...b, amount: sum(rows), count: b.key === "tieups" ? rows.length : rows.filter((e) => !e.rule_key.startsWith("milestone") && !["lead_interested", "interested_visited"].includes(e.rule_key)).reduce((a, e) => a + Number(e.quantity), 0) };
        }),
        milestones: rules.filter((r) => r.kind === "milestone").map((r) => ({ rule: r, achieved: r.metric ? metricTotal(monthAll, rules, r.metric) : 0, earned: thisMonth.some((e) => e.rule_key === r.key) })),
        recent: mine.slice().sort((a, b) => (b.occurred_on + (b.created_at ?? "")).localeCompare(a.occurred_on + (a.created_at ?? ""))).slice(0, 6),
      };
    },
    async leaderboard(month: string, staff: Staff[]) {
      const rows = (await repo.entries()).filter((e) => EARNED.includes(e.status) && monthOf(e.occurred_on) === month);
      const rules = await repo.rules();
      return staff
        .map((s) => {
          const mine = rows.filter((e) => e.staff_id === s.id);
          return { staff: s, amount: mine.reduce((a, e) => a + e.amount, 0), admissions: metricTotal(mine, rules, "admissions") };
        })
        .filter((x) => x.amount > 0 || x.admissions > 0)
        .sort((a, b) => b.amount - a.amount);
    },
  };
  return repo;
}
export type IncentiveRepo = ReturnType<typeof createIncentiveRepo>;
export const currentMonth = () => monthOf(istDate());
