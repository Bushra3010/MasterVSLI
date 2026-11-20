"use client";

import { useState, useTransition } from "react";
import { payOnlineAction, type PayResult } from "./actions";

/** "Pay now" for one installment: opens Razorpay, or shows a UPI QR for GPay / PhonePe / Paytm. */
export function PayNow({ installmentId }: { installmentId: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<PayResult | null>(null);

  const go = () =>
    start(async () => {
      const r = await payOnlineAction(installmentId);
      if (r.ok && r.kind === "razorpay") window.location.href = r.url;
      else setRes(r);
    });

  return (
    <span className="relative">
      <button onClick={go} disabled={pending} className="rounded bg-brand px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-60">
        {pending ? "…" : "Pay now"}
      </button>
      {res && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-[5px] border border-line bg-white p-3 text-xs shadow-lg">
          <button onClick={() => setRes(null)} className="absolute top-1 right-2 text-muted" aria-label="Close">×</button>
          {res.ok && res.kind === "upi" ? (
            <div className="text-center">
              <div className="mb-1 font-medium text-navy">Scan with any UPI app</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={res.qr} alt="UPI payment QR code" className="mx-auto size-44" />
              <a href={res.link} className="mt-2 block rounded bg-brand px-2 py-1 font-medium text-white">Open UPI app (GPay / PhonePe)</a>
              <p className="mt-2 text-muted">After paying, the office confirms it and your receipt appears here.</p>
            </div>
          ) : (
            <p className="pr-3 text-amber-800">{!res.ok ? res.message : ""}</p>
          )}
        </div>
      )}
    </span>
  );
}
