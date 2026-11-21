"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { runAlertsAction } from "../crm-actions";

export function RunAlerts() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() => start(async () => { const r = await runAlertsAction(); setMsg(`${r.created} new · ${r.escalated} escalated`); })}
      >
        <RefreshCw size={15} className={pending ? "animate-spin" : ""} /> Run alert engine
      </button>
    </div>
  );
}
