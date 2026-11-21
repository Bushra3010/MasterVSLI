"use client";

import { useActionState } from "react";
import { signIn } from "../auth-actions";

export function LoginForm({ demo, students }: { demo: boolean; students: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(signIn, null);

  if (demo)
    return (
      <form action={action} className="space-y-4">
        <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
          Supabase isn&apos;t configured, so the ERP runs on built-in demo data. Pick who to sign in as.
        </div>
        <div>
          <label className="label" htmlFor="persona">Sign in as</label>
          <select id="persona" name="persona" className="input">
            <option value="admin">Admin (full ERP)</option>
            <option value="college:col-atme">College TPO — ATME College of Engineering</option>
            {students.map((s) => (
              <option key={s.id} value={`student:${s.id}`}>
                Student — {s.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Signing in…" : "Continue"}
        </button>
      </form>
    );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      {state?.error && <p className="text-sm text-brand">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
