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
            const out = await runExpiryAction();
            setMsg(out.length ? `${out.length} notifications/expiries processed` : "Nothing due today");
          })
        }
      >
        <Play size={14} /> {pending ? "Running…" : "Run expiry check now"}
      </button>
    </div>
  );
}
