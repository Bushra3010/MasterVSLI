"use client";

import { useActionState, useState } from "react";
import { inr } from "@/lib/format";
import { ENTITY_LABEL, ENTITY_SHORT, type Entity } from "@/lib/types-finance";
import { makePaymentAction } from "../actions";

type Ref = { ref: string; label: string; balance: number; entity: Entity };
type Bill = { id: string; label: string; due: number; entity: Entity; payee: string; vendor_id: string | null };
type TenancyOpt = { id: string; label: string };

export function PaymentForm({ refs, bills, tenancies, preselect, today }: { refs: Ref[]; bills: Bill[]; tenancies: TenancyOpt[]; preselect?: string; today: string }) {
  const [state, run, pending] = useActionState(makePaymentAction, null);
  const [billId, setBillId] = useState(preselect ?? "");
  const bill = bills.find((b) => b.id === billId);
  const [rows, setRows] = useState([{ ref: "", amount: bill?.due ?? 0, tenancy: "" }]);
  const [behalf, setBehalf] = useState<Entity>(bill?.entity ?? "mastervlsi");
  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const payer = bill?.entity ?? behalf;
  const crossEntity = rows.filter((r) => r.ref && refs.find((x) => x.ref === r.ref)?.entity !== payer);
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((s) => s.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <form action={run} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="expense_id">Bill to pay</label>
          <select
            id="expense_id"
            name="expense_id"
            value={billId}
            onChange={(e) => {
              setBillId(e.target.value);
              const b = bills.find((x) => x.id === e.target.value);
              if (b) setRows((s) => (s.length === 1 ? [{ ...s[0], amount: b.due }] : s));
            }}
            className="input"
          >
            <option value="">— No bill: one-off payment —</option>
            {bills.map((b) => <option key={b.id} value={b.id}>{b.label} — {inr(b.due)} due ({ENTITY_SHORT[b.entity]})</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="payee">Payee *</label>
          <input id="payee" name="payee" required key={bill?.id ?? "none"} defaultValue={bill?.payee ?? ""} className="input" placeholder="ABC Electricals" />
          <input type="hidden" name="vendor_id" value={bill?.vendor_id ?? ""} />
        </div>
        {!bill && (
          <div>
            <label className="label" htmlFor="on_behalf_of">Paid on behalf of</label>
            <select id="on_behalf_of" name="on_behalf_of" value={behalf} onChange={(e) => setBehalf(e.target.value as Entity)} className="input">
              {(Object.keys(ENTITY_LABEL) as Entity[]).map((e) => <option key={e} value={e}>{ENTITY_LABEL[e]}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="paid_on">Paid on</label>
          <input id="paid_on" name="paid_on" type="date" defaultValue={today} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="reference">Reference</label>
          <input id="reference" name="reference" className="input" placeholder="NEFT / UTR / cheque no." />
        </div>
      </div>

      <div className="rounded-[5px] border border-line">
        <div className="border-b border-line bg-slate-50 px-3 py-2 text-xs font-semibold text-muted uppercase">Pay from (one or more sources)</div>
        <div className="space-y-2 p-3">
          {rows.map((r, i) => {
            const src = refs.find((x) => x.ref === r.ref);
            const short = src && Number(r.amount) > src.balance;
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                <div>
                  <select name={`src_${i}`} value={r.ref} onChange={(e) => set(i, { ref: e.target.value })} aria-label={`Source ${i + 1}`} className="input">
                    <option value="">Select account / collection…</option>
                    {refs.map((o) => <option key={o.ref} value={o.ref}>{o.label} — {inr(o.balance)} ({ENTITY_SHORT[o.entity]})</option>)}
                  </select>
                  {r.ref === "pool:rent" && (
                    <select name={`tenancy_${i}`} value={r.tenancy} onChange={(e) => set(i, { tenancy: e.target.value })} aria-label="Whose rent" className="input mt-1 text-xs">
                      <option value="">Rent from any tenant</option>
                      {tenancies.map((t) => <option key={t.id} value={t.id}>Rent from {t.label}</option>)}
                    </select>
                  )}
                  {short && <p className="mt-1 text-[11px] text-red-600">Only {inr(src.balance)} available here</p>}
                </div>
                <input name={`amt_${i}`} type="number" min={1} value={r.amount || ""} onChange={(e) => set(i, { amount: Number(e.target.value) })} aria-label={`Amount ${i + 1}`} placeholder="₹" className="input" />
                {rows.length > 1 && <button type="button" onClick={() => setRows((s) => s.filter((_, k) => k !== i))} className="btn-ghost py-1.5 text-xs">Remove</button>}
              </div>
            );
          })}
          {rows.length < 4 && <button type="button" onClick={() => setRows((s) => [...s, { ref: "", amount: Math.max(0, (bill?.due ?? 0) - total), tenancy: "" }])} className="text-xs font-medium text-navy underline">+ Add another source</button>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-sm">
          <span>Total <b className="tabular-nums">{inr(total)}</b>{bill && <> of <b className="tabular-nums">{inr(bill.due)}</b> due</>}</span>
          {bill && total > bill.due && <span className="text-xs text-red-600">More than the amount due</span>}
          {bill && total > 0 && total < bill.due && <span className="text-xs text-amber-700">Part payment — {inr(bill.due - total)} will stay due</span>}
        </div>
      </div>

      {crossEntity.length > 0 && (
        <p className="rounded-[5px] bg-amber-50 p-2 text-xs text-amber-900">
          This bill belongs to <b>{ENTITY_SHORT[payer]}</b>, but {crossEntity.map((r) => ENTITY_SHORT[refs.find((x) => x.ref === r.ref)!.entity]).filter((v, k, a) => a.indexOf(v) === k).join(" and ")} money is used. An inter-entity settlement will be recorded so {ENTITY_SHORT[payer]} pays it back.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending || total <= 0}>{pending ? "Paying…" : `Pay ${inr(total)}`}</button>
        {state && <span role="status" className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
