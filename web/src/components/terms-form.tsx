"use client";

import { useState } from "react";

/** Every declaration must be ticked before the submit button enables. */
export function TermsForm({ items, action, cta }: { items: { title: string; body: string }[]; action: (f: FormData) => Promise<void>; cta: string }) {
  const [ticked, setTicked] = useState<boolean[]>(() => items.map(() => false));
  const [final, setFinal] = useState(false);
  const all = ticked.every(Boolean) && final;
  return (
    <form action={action} className="space-y-2">
      {items.map((t, i) => (
        <details key={i} className="rounded-[5px] border border-line bg-white">
          <summary className="flex cursor-pointer list-none items-start gap-2 p-3 text-[13px]">
            <input
              type="checkbox"
              name={`t_${i}`}
              checked={ticked[i]}
              onChange={(e) => setTicked((s) => s.map((v, k) => (k === i ? e.target.checked : v)))}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 size-4 accent-emerald-600"
              aria-label={t.title}
            />
            <span><b className="font-medium text-navy">{i + 1}. {t.title}</b><span className="line-clamp-1 text-xs text-muted">{t.body}</span></span>
          </summary>
          <p className="border-t border-line px-3 py-2 text-xs text-[#515b73]">{t.body}</p>
        </details>
      ))}
      <label className="flex items-start gap-2 rounded-[5px] border border-amber-200 bg-amber-50 p-3 text-[13px]">
        <input type="checkbox" name="final" checked={final} onChange={(e) => setFinal(e.target.checked)} className="mt-0.5 size-4 accent-emerald-600" />
        <span>I have read, understood, and accept all the {items.length} terms &amp; conditions of MasterVLSI. I agree to comply with these terms throughout my training and placement journey. <span className="text-red-600">*</span></span>
      </label>
      <button disabled={!all} className="btn w-full bg-orange-500 py-2.5 text-white hover:bg-orange-600 disabled:opacity-50">✓ {cta}</button>
      {!all && <p className="text-center text-[11px] text-muted">{ticked.filter(Boolean).length} of {items.length} declarations ticked</p>}
    </form>
  );
}
