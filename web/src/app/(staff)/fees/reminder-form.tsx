"use client";

import { BellRing } from "lucide-react";
import { useActionState } from "react";
import { feeReminderAction, type ReminderResult } from "../crm-actions";

/** Bulk or single-student fee reminder over WhatsApp, email or SMS. */
export function ReminderForm({ studentId, compact }: { studentId?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState<ReminderResult | null, FormData>(feeReminderAction, null);
  return (
    <form action={action} className={compact ? "inline-flex items-center gap-1" : "space-y-2"}>
      {studentId && <input type="hidden" name="student_id" value={studentId} />}
      <select name="channel" aria-label="Channel" className={`input ${compact ? "w-auto py-1" : ""}`}>
        <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option>
      </select>
      {!studentId && (
        <select name="scope" aria-label="Who" className="input">
          <option value="overdue">Overdue installments</option><option value="due_soon">Due in the next 3 days</option>
        </select>
      )}
      <button disabled={pending} className={compact ? "btn-ghost py-1 text-xs" : "btn-primary w-full"}><BellRing size={14} /> {pending ? "Sending…" : compact ? "Remind" : "Send fee reminders"}</button>
      {state && !compact && (
        <div className={`rounded-[5px] p-2 text-xs ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {state.message}
          {state.links && <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">{state.links.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">WhatsApp {l.name}</a></li>)}</ul>}
        </div>
      )}
      {state && compact && <span className={`text-[11px] ${state.ok ? "text-emerald-700" : "text-amber-700"}`}>{state.links?.[0] ? <a href={state.links[0].url} target="_blank" rel="noreferrer" className="underline">open WhatsApp</a> : state.ok ? "sent" : "not set up"}</span>}
    </form>
  );
}
