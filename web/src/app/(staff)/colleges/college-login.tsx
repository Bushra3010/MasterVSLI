"use client";

import { useState, useTransition } from "react";
import { collegeLoginAction, type LoginResult } from "../crm-actions";

/** Creates (or resets) a TPO's college-portal login and shows the one-time password. */
export function CollegeLoginButton({ tpoId }: { tpoId: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<LoginResult | null>(null);
  return (
    <span className="relative">
      <button type="button" disabled={pending} onClick={() => start(async () => setRes(await collegeLoginAction(tpoId)))} className="text-xs text-brand hover:underline">
        {pending ? "…" : "Portal login"}
      </button>
      {res && (
        <span className="absolute right-0 z-20 mt-1 block w-64 rounded-[5px] border border-line bg-white p-2 text-[11px] shadow-lg">
          {res.ok ? (
            <>Share once: <b>{res.email}</b><br />Password: <code className="font-mono">{res.password}</code><br /><span className="text-muted">They sign in at the normal login page.</span></>
          ) : (
            <span className="text-amber-800">{res.message}</span>
          )}
          <button type="button" onClick={() => setRes(null)} className="ml-2 text-muted">close</button>
        </span>
      )}
    </span>
  );
}
