import Link from "next/link";
import type { ReactNode } from "react";
import { inr, todayISO } from "@/lib/format";
import type { CommissionRule } from "@/lib/types-incentives";
import { logActivityAction } from "./actions";

export const money = (n: number) => inr(Math.round(n));
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function IncentiveTabs({ active, admin, query = "" }: { active: "dashboard" | "earnings" | "admin"; admin: boolean; query?: string }) {
  const tabs: [string, string, string][] = [
    ["dashboard", "HR Dashboard", "/incentives"],
    ["earnings", "Commission & Earnings", "/incentives/earnings"],
    ...(admin ? ([["admin", "Admin Panel", "/incentives/admin"]] as [string, string, string][]) : []),
  ];
  return (
    <nav aria-label="HR incentives" className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {tabs.map(([k, l, href]) => (
        <Link key={k} href={href + query} aria-current={k === active ? "page" : undefined} className={`-mb-px border-b-2 px-3 py-2 text-sm ${k === active ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-navy"}`}>
          {l}
        </Link>
      ))}
    </nav>
  );
}

export function Kpi({ label, value, sub, icon, tint }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; tint: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-[5px] border p-4 shadow-sm ${tint}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/80">{icon}</span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-navy">{label}</div>
        <div className="text-xl font-semibold text-navy tabular-nums">{value}</div>
        {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
      </div>
    </div>
  );
}

/** Donut from a CSS conic gradient. */
export function Donut({ parts, children }: { parts: { value: number; color: string }[]; children: ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  let acc = 0;
  const stops = total
    ? parts.filter((p) => p.value > 0).map((p) => {
        const from = (acc / total) * 360;
        acc += p.value;
        return `${p.color} ${from}deg ${(acc / total) * 360}deg`;
      })
    : ["#e9edf4 0deg 360deg"];
  return (
    <div className="relative grid size-40 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
      <div className="grid size-[68%] place-items-center rounded-full bg-white text-center">{children}</div>
    </div>
  );
}

export function LogActivityForm({ rules, back, staff }: { rules: CommissionRule[]; back: string; staff?: { id: string; full_name: string }[] }) {
  const loggable = rules.filter((r) => r.loggable && r.active);
  return (
    <form action={logActivityAction} className="grid gap-2 text-sm sm:grid-cols-2">
      <input type="hidden" name="back" value={back} />
      {staff && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor="la-staff">For staff member</label>
          <select id="la-staff" name="staff_id" className="input">
            <option value="">Me</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="label" htmlFor="la-rule">Activity *</label>
        <select id="la-rule" name="rule_key" required className="input">
          {loggable.map((r) => <option key={r.key} value={r.key}>{r.label} — {r.unit === "admin configurable" ? "amount set by admin" : `${money(r.amount)} ${r.unit}`}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="la-qty">Quantity *</label>
        <input id="la-qty" name="quantity" type="number" min={1} step={1} defaultValue={1} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="la-date">Date *</label>
        <input id="la-date" name="occurred_on" type="date" required min="2000-01-01" max="2100-12-31" defaultValue={todayISO()} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="la-cat">Student type (admissions)</label>
        <select id="la-cat" name="category" className="input">
          <option value="">—</option>
          <option value="normal">Normal</option>
          <option value="college">College</option>
          <option value="corporate">Corporate</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="la-amount">Proposed amount (tie-ups)</label>
        <input id="la-amount" name="amount" type="number" min={0} placeholder="Only for admin-configurable items" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="la-ref">Student / company / details</label>
        <input id="la-ref" name="ref_label" placeholder="e.g. Arjun Patel review, ABC College MoU, Wipro interview" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="la-proof">Proof link</label>
        <input id="la-proof" name="proof_url" type="url" placeholder="Review / video / document link (optional)" className="input" />
      </div>
      <button className="btn-primary sm:col-span-2">Submit for approval</button>
    </form>
  );
}
