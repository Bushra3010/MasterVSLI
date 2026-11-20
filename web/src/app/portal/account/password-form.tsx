"use client";

import { useActionState } from "react";
import { changePasswordAction } from "../actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" className="input" />
      </div>
      {state && <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-brand"}`}>{state.message}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Update password"}</button>
    </form>
  );
}
