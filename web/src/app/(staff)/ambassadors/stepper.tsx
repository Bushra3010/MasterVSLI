"use client";

import { useState } from "react";

/** Number box with − / + buttons (the activity target in the admin panel). */
export function Stepper({ name, defaultValue, step = 1, label }: { name: string; defaultValue: number; step?: number; label: string }) {
  const [v, setV] = useState(defaultValue);
  const btn = "grid size-6 place-items-center rounded border border-line bg-white text-sm font-bold text-[#1f2a44] hover:bg-slate-50";
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => setV((x) => Math.max(1, x - step))} className={btn}>−</button>
      <input name={name} type="number" min={1} value={v} onChange={(e) => setV(Number(e.target.value) || 1)} aria-label={label} className="w-16 rounded border border-line px-1 py-0.5 text-center text-[13px] tabular-nums" />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => setV((x) => x + step)} className={btn}>+</button>
    </span>
  );
}
