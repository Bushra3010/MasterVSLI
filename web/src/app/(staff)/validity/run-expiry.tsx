"use client";

import { Play } from "lucide-react";
import { useState, useTransition } from "react";
import { runExpiryAction } from "../actions";

export function RunExpiryButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm text-muted">{msg}</span>}
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const { processed, delivery } = await runExpiryAction();
            const parts = [processed.length ? `${processed.length} reminder(s)/expiries recorded` : "Nothing due today"];
            if (delivery?.configured) parts.push(`${delivery.sent} email(s) sent`);
            else if (delivery?.pending) parts.push(`${delivery.pending} waiting — add RESEND_API_KEY to send emails`);
            setMsg(parts.join(" · "));
          })
        }
      >
        <Play size={14} /> {pending ? "Running…" : "Run expiry check now"}
      </button>
    </div>
  );
}
