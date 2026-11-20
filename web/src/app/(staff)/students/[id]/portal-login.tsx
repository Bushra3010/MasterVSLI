"use client";

import { KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { portalLoginAction, type PortalLoginResult } from "../../actions";

export function PortalLoginButton({ studentId, hasLogin }: { studentId: string; hasLogin: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<PortalLoginResult | null>(null);
  const label = hasLogin || (res?.ok && !res.reset) ? "Reset portal password" : "Create portal login";

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-ghost"
        disabled={pending}
        onClick={() => {
          if (hasLogin && !confirm("Reset this student's portal password? Their current password will stop working.")) return;
          start(async () => setRes(await portalLoginAction(studentId)));
        }}
      >
        <KeyRound size={15} /> {pending ? "Working…" : label}
      </button>
      {res && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-line bg-white p-3 text-sm shadow-lg" role="status">
          {res.ok ? (
            <>
              <div className="font-semibold text-emerald-700">{res.reset ? "Password reset" : "Portal login created"}</div>
              <p className="mt-1 text-xs text-muted">Share these with the student once. They can change the password under Account after signing in. This won&apos;t be shown again.</p>
              <dl className="mt-2 space-y-1 rounded bg-slate-50 p-2 font-mono text-xs">
                <div><dt className="inline text-muted">Email: </dt><dd className="inline select-all">{res.email}</dd></div>
                <div><dt className="inline text-muted">Temporary password: </dt><dd className="inline select-all font-semibold">{res.password}</dd></div>
              </dl>
            </>
          ) : (
            <div className="text-brand">{res.message}</div>
          )}
          <button type="button" className="mt-2 text-xs text-muted underline" onClick={() => setRes(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
