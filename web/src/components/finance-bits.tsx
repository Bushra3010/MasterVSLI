import clsx from "clsx";
import type { ReactNode } from "react";
import { inr } from "@/lib/format";
import { ENTITY_SHORT, type Entity } from "@/lib/types-finance";

const ENTITY_TONE: Record<Entity, string> = {
  mastervlsi: "bg-blue-50 text-blue-700 ring-blue-200",
  enrich: "bg-violet-50 text-violet-700 ring-violet-200",
  property: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function EntityBadge({ entity }: { entity: Entity }) {
  return <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap", ENTITY_TONE[entity])}>{ENTITY_SHORT[entity]}</span>;
}

/** KPI tile matching the finance dashboard's coloured strip. */
export function Kpi({ label, value, hint, tone = "navy", icon }: { label: string; value: number; hint?: string; tone?: "navy" | "green" | "violet" | "red" | "amber" | "blue"; icon?: ReactNode }) {
  const c = { navy: "text-navy", green: "text-emerald-600", violet: "text-violet-600", red: "text-red-600", amber: "text-amber-600", blue: "text-blue-600" }[tone];
  return (
    <div className="rounded-[5px] border border-line bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-muted">
        {label}
        <span className={c}>{icon}</span>
      </div>
      <div className={clsx("mt-1 text-xl font-semibold tabular-nums", c)}>{inr(value)}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

/** Horizontal bar used for category splits and budget vs actual. */
export function Bar({ value, max, tone = "bg-navy" }: { value: number; max: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={clsx("h-full rounded-full", tone)} style={{ width: `${max > 0 ? Math.min(100, (100 * value) / max) : 0}%` }} />
    </div>
  );
}

/** Account / pool picker used by payment, transfer and refund forms. */
export function RefSelect({ name, options, label, required, defaultValue }: { name: string; label: string; required?: boolean; defaultValue?: string; options: { ref: string; label: string; balance: number; entity: Entity }[] }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} required={required} defaultValue={defaultValue ?? ""} className="input">
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.ref} value={o.ref}>
            {o.label} — {inr(o.balance)} ({ENTITY_SHORT[o.entity]})
          </option>
        ))}
      </select>
    </div>
  );
}

export const FIELD = ({ label, name, type = "text", defaultValue, required, placeholder, step, min }: { label: string; name: string; type?: string; defaultValue?: string | number | null; required?: boolean; placeholder?: string; step?: string; min?: number }) => (
  <div>
    <label className="label" htmlFor={name}>{label}</label>
    <input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} step={step} min={min} className="input" />
  </div>
);
