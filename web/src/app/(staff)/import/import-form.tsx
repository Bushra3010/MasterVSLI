"use client";

import { useActionState } from "react";
import { importCsvAction } from "../crm-actions";

export function ImportForm({ kind }: { kind: "leads" | "students" }) {
  const [state, action, pending] = useActionState(importCsvAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="file" name="file" accept=".csv,text/csv" required aria-label={`${kind} CSV file`} className="input" />
      <button disabled={pending} className="btn-primary w-full">{pending ? "Importing…" : `Import ${kind}`}</button>
      {state && (
        <div className={`rounded-[5px] p-2 text-xs ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {state.message}
          {state.errors && state.errors.length > 0 && <ul className="mt-1 list-disc pl-4">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
      )}
    </form>
  );
}
