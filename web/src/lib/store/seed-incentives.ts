import { addDays } from "../format";
import type { Staff } from "../types";
import { type Commission, type CommissionRule, DEFAULT_RULES, DEFAULT_TARGETS, type HrTarget, type IncentiveMetric } from "../types-incentives";

export interface IncentiveTables {
  hr_commission_rules: CommissionRule[];
  hr_commissions: Commission[];
  hr_targets: HrTarget[];
}

/** Six months of believable commission history for the demo staff. */
export function buildIncentiveSeed(today: string, staff: Staff[]): IncentiveTables {
  const rules = DEFAULT_RULES.map((r) => ({ ...r }));
  const rule = (k: string) => rules.find((r) => r.key === k)!;
  const hr_commissions: Commission[] = [];
  let n = 0;
  const add = (staffId: string, key: string, day: string, qty: number, extra: Partial<Commission> = {}) => {
    const r = rule(key);
    hr_commissions.push({
      id: `hc-${++n}`, staff_id: staffId, rule_key: key, label: r.label, quantity: qty, amount: (extra.amount ?? r.amount * qty), occurred_on: day,
      status: day.slice(0, 7) < today.slice(0, 7) ? "paid" : "approved", created_by: "System", decided_by: "System", created_at: day + "T06:00:00Z", ...extra,
    });
  };
  const cats = ["normal", "college", "corporate"] as const;
  staff.slice(0, 3).forEach((s, si) => {
    for (let m = 5; m >= 0; m--) {
      const base = addDays(today.slice(0, 8) + "05", -30 * m);
      const day = (d: number) => {
        const x = addDays(base, d);
        return x > today ? today : x;
      };
      const scale = 1 + (5 - m) * 0.25 - si * 0.2;
      const admissions = Math.max(2, Math.round(6 * scale));
      for (let a = 0; a < admissions; a++) add(s.id, "admission_individual", day(a % 20), 1, { category: cats[a % 3], ref_id: `demo-adm-${s.id}-${m}-${a}`, ref_label: `Demo student ${a + 1} – admission` });
      add(s.id, "review", day(8), Math.round(12 * scale), { ref_label: "Google reviews" });
      add(s.id, "feedback_video", day(10), Math.round(10 * scale), { ref_label: "Student feedback videos" });
      add(s.id, "interview", day(12), Math.round(3 * scale), { ref_label: "Interviews scheduled" });
      if (m % 2 === 0) add(s.id, "college_tieup", day(15), 1, { amount: 5000, ref_label: "MoU with partner college" });
    }
    // pending activities this month
    add(s.id, "review", today, 6 + si, { status: "pending", ref_label: "New reviews to verify", created_by: s.full_name, decided_by: null });
    add(s.id, "interview", today, 1, { status: "pending", ref_label: "Interview – Wipro drive", created_by: s.full_name, decided_by: null });
  });
  const hr_targets: HrTarget[] = (Object.entries(DEFAULT_TARGETS) as [IncentiveMetric, number][]).map(([metric, target], i) => ({ id: `ht-${i}`, staff_id: null, month: null, metric, target }));
  return { hr_commission_rules: rules, hr_commissions, hr_targets };
}
