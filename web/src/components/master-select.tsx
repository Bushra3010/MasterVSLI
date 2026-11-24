"use client";

import { Minus, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { addMasterOptionAction, removeMasterOptionAction } from "@/app/(staff)/students/profile-actions";
import type { MasterCategory } from "@/lib/types";

/**
 * A dropdown backed by an admin-managed list. Staff can add a value with "+";
 * admins can remove the selected value with "−". `editable={false}` shows a plain dropdown (student portal).
 */
export function MasterSelect({
  name,
  category,
  options,
  defaultValue,
  label,
  editable = true,
  canRemove = false,
  placeholder = "Select…",
  className = "",
  onChange,
}: {
  name: string;
  category: MasterCategory;
  options: string[];
  defaultValue?: string | null;
  label?: string;
  editable?: boolean;
  canRemove?: boolean;
  placeholder?: string;
  className?: string;
  onChange?: (v: string) => void;
}) {
  const initial = defaultValue && !options.includes(defaultValue) ? [...options, defaultValue] : options;
  const [list, setList] = useState(initial);
  const [value, setValue] = useState(defaultValue ?? "");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const set = (v: string) => {
    setValue(v);
    onChange?.(v);
  };

  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <div className="flex gap-1">
        <select name={name} value={value} onChange={(e) => set(e.target.value)} aria-label={label ?? name} className="input min-w-0 flex-1">
          <option value="">{placeholder}</option>
          {list.map((o) => <option key={o} value={o}>{category === "validity_months" ? `${o} months` : o}</option>)}
        </select>
        {editable && (
          <button type="button" title="Add to this list" aria-label={`Add ${label ?? category}`} onClick={() => { setAdding((a) => !a); setMsg(""); }} className="grid size-9 shrink-0 place-items-center rounded-[5px] border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
            <Plus size={14} />
          </button>
        )}
        {editable && canRemove && value && (
          <button
            type="button"
            title={`Remove “${value}” from the list`}
            aria-label={`Remove ${value} from the list`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await removeMasterOptionAction(category, value);
                if (r.ok) {
                  setList((l) => l.filter((x) => x !== value));
                  set("");
                }
              })
            }
            className="grid size-9 shrink-0 place-items-center rounded-[5px] border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          >
            <Minus size={14} />
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-1 flex gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder={category === "validity_months" ? "Months, e.g. 18" : "New value"}
            aria-label="New value"
            className="input min-w-0 flex-1 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={() =>
              start(async () => {
                const r = await addMasterOptionAction(category, draft);
                if (r.ok && r.value) {
                  setList((l) => (l.includes(r.value!) ? l : [...l, r.value!]));
                  set(r.value);
                  setDraft("");
                  setAdding(false);
                } else setMsg(r.message ?? "Could not add");
              })
            }
            className="btn-navy py-1.5 text-xs"
          >
            Add
          </button>
        </div>
      )}
      {msg && <p className="mt-1 text-[11px] text-red-600">{msg}</p>}
    </div>
  );
}
