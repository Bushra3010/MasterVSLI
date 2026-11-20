"use client";

import { useActionState, useState } from "react";
import { broadcastAction, type BroadcastResult } from "../module-actions";

export function BroadcastForm({ audiences, batches }: { audiences: Record<string, string>; batches: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<BroadcastResult | null, FormData>(broadcastAction, null);
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");

  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2">
        {(["whatsapp", "email"] as const).map((c) => (
          <label key={c} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${channel === c ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>
            <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} className="sr-only" />
            {c === "whatsapp" ? "WhatsApp" : "Email"}
          </label>
        ))}
      </div>
      <label className="block text-xs text-muted">Send to
        <select name="audience" className="input mt-1 py-1.5" defaultValue="active">
          {Object.entries(audiences).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <optgroup label="Batch">
            {batches.map((b) => <option key={b.id} value={`batch:${b.id}`}>{b.name}</option>)}
          </optgroup>
        </select>
      </label>
      {channel === "email" && (
        <label className="block text-xs text-muted">Subject
          <input name="subject" required className="input mt-1 py-1.5" placeholder="Class schedule update" />
        </label>
      )}
      <label className="block text-xs text-muted">Message
        <textarea name="body" required rows={5} className="input mt-1" placeholder="Hi {name}, tomorrow's class starts at 7 PM." />
      </label>
      <p className="text-[11px] text-muted">Use {"{name}"} and {"{enrollment}"} to personalise.</p>
      <button disabled={pending} className="btn-primary w-full">{pending ? "Sending…" : "Send"}</button>
      {state && (
        <div className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {state.message}
          {state.links && state.links.length > 0 && (
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
              {state.links.map((l) => (
                <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">WhatsApp {l.name}</a></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
