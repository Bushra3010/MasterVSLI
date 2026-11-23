"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";

type Result = { ok: boolean; message: string } | null;

/** A form bound to a server action that returns { ok, message }; shows the message and resets on success. */
export function ActionForm({
  action,
  children,
  submit = "Save",
  className = "space-y-3",
  reset = true,
}: {
  action: (prev: Result, form: FormData) => Promise<Result>;
  children: ReactNode;
  submit?: string;
  className?: string;
  reset?: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && reset) ref.current?.reset();
  }, [state, reset]);
  return (
    <form ref={ref} action={run} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : submit}</button>
        {state && <span role="status" className={`text-sm ${state.ok ? "text-emerald-700" : "text-brand"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
