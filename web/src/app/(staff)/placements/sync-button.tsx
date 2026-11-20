"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState, useTransition } from "react";
import { syncDriveAction } from "../actions";

export function SyncButton({ driveId, pending }: { driveId: string; pending: number }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex items-center gap-2">
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-brand"}`}>{msg.text}</span>}
      <button
        className="btn-navy py-1.5 text-xs"
        disabled={busy}
        onClick={() =>
          start(async () => {
            try {
              const r = await syncDriveAction(driveId);
              setMsg({ ok: r.ok, text: r.message });
            } catch (e) {
              setMsg({ ok: false, text: e instanceof Error ? e.message : "Sync failed" });
            }
          })
        }
      >
        <FileSpreadsheet size={14} /> {busy ? "Syncing…" : `Sync to Google Sheet (${pending} new)`}
      </button>
    </div>
  );
}
