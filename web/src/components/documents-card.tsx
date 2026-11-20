"use client";

import { FileUp } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { DOC_KINDS } from "@/lib/types";

type UploadState = { ok: true } | { ok: false; message: string } | null;

/** File picker + type selector; `action` is a (bound) server action returning an UploadResult. */
export function UploadForm({ action, kinds = Object.keys(DOC_KINDS) }: { action: (prev: UploadState, form: FormData) => Promise<UploadState>; kinds?: string[] }) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={run} className="mt-3 space-y-2 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        <select name="kind" aria-label="Document type" className="input w-auto py-1.5" defaultValue={kinds[0]}>
          {kinds.map((k) => <option key={k} value={k}>{DOC_KINDS[k]}</option>)}
        </select>
        <input name="file" type="file" required aria-label="File" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="min-w-0 flex-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-navy-soft file:px-2 file:py-1.5 file:text-navy" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">PDF, image or Word · up to 5 MB</span>
        <button className="btn-navy py-1.5 text-xs" disabled={pending}><FileUp size={13} /> {pending ? "Uploading…" : "Upload"}</button>
      </div>
      {state && !state.ok && <p className="text-xs text-brand">{state.message}</p>}
      {state?.ok && <p className="text-xs text-emerald-700">Uploaded.</p>}
    </form>
  );
}
