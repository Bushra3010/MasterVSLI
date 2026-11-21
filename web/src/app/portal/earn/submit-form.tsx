"use client";

import { useActionState } from "react";
import { submitAmbassadorAction } from "../actions";

export function SubmitActivity() {
  const [state, action, pending] = useActionState(submitAmbassadorAction, null);
  return (
    <form action={action} className="space-y-2 text-[13px]">
      <select name="kind" className="input" aria-label="Activity">
        <option value="referral">Referral – friend&apos;s name &amp; phone</option>
        <option value="review">Google review – link</option>
        <option value="social">Like / subscribe / share – which post</option>
        <option value="mentor">Mentored a student – who &amp; topic</option>
      </select>
      <textarea name="details" required rows={2} className="input" placeholder="e.g. Aditya Kumar 9878011223, interested in DV" aria-label="Details" />
      <input name="proof_url" className="input" placeholder="Proof link (optional) https://…" aria-label="Proof link" />
      <button disabled={pending} className="btn w-full bg-orange-500 text-white hover:bg-orange-600">{pending ? "Submitting…" : "Submit for reward"}</button>
      {state && <p className={state.ok ? "text-emerald-700" : "text-red-600"}>{state.message}</p>}
    </form>
  );
}
