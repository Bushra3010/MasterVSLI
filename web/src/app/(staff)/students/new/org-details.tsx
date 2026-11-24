"use client";

import { Building2, GraduationCap, Info, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { MasterSelect } from "@/components/master-select";
import type { Client, College } from "@/lib/types";
import { INDIAN_STATES } from "@/lib/types-profile";
import { removeOrgAction } from "../profile-actions";

type Org = { id: string; name: string; city?: string | null; state?: string | null };

function OrgPicker({ kind, orgs, canRemove }: { kind: "college" | "client"; orgs: Org[]; canRemove: boolean }) {
  const noun = kind === "college" ? "college" : "company";
  const [list, setList] = useState(orgs);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const match = list.find((o) => o.name.trim().toLowerCase() === name.trim().toLowerCase());
  const pick = (v: string) => {
    setName(v);
    const m = list.find((o) => o.name.trim().toLowerCase() === v.trim().toLowerCase());
    if (m) {
      setCity(m.city ?? "");
      setState(m.state ?? "");
      setEditing(false);
    }
    setMsg("");
  };
  const lockedCity = Boolean(match) && !editing;
  const p = kind === "college" ? "college" : "company";

  return (
    <div className="space-y-3">
      <input type="hidden" name={`${p}_id`} value={match?.id ?? ""} />
      <input type="hidden" name={`${p}_edit`} value={match && editing ? "1" : ""} />
      <div>
        <label className="label" htmlFor={`${p}_name`}>{kind === "college" ? "College name" : "Company name"} *</label>
        <div className="flex flex-wrap gap-1">
          <input id={`${p}_name`} name={`${p}_name`} list={`${p}-list`} required value={name} onChange={(e) => pick(e.target.value)} placeholder={`Search or type a ${noun}…`} className="input min-w-48 flex-1" autoComplete="off" />
          <datalist id={`${p}-list`}>{list.map((o) => <option key={o.id} value={o.name}>{[o.city, o.state].filter(Boolean).join(", ")}</option>)}</datalist>
          <button type="button" onClick={() => { setName(""); setCity(""); setState(""); setEditing(false); }} className="btn border border-emerald-300 bg-emerald-50 py-1.5 text-xs text-emerald-800"><Plus size={13} /> Add {noun}</button>
          <button type="button" disabled={!match} onClick={() => setEditing((e) => !e)} className="btn border border-blue-200 bg-blue-50 py-1.5 text-xs text-blue-800 disabled:opacity-40"><Pencil size={13} /> {editing ? "Editing" : "Edit"}</button>
          {canRemove && (
            <button
              type="button"
              disabled={!match || pending}
              onClick={() =>
                match &&
                start(async () => {
                  const r = await removeOrgAction(kind, match.id);
                  if (r.ok) {
                    setList((l) => l.filter((o) => o.id !== match.id));
                    setName(""); setCity(""); setState("");
                  }
                  setMsg(r.message);
                })
              }
              className="btn border border-red-200 bg-red-50 py-1.5 text-xs text-red-700 disabled:opacity-40"
            >
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {match ? (editing ? `Changes to city/state will update this ${noun} in the master.` : `Existing ${noun} selected.`) : name ? `New ${noun} — it will be added to the master with this admission.` : `Start typing to search existing ${noun === "college" ? "colleges" : "companies"}.`}
        </p>
        {msg && <p className="mt-1 text-[11px] text-red-600">{msg}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${p}_city`}>City / location *</label>
          <input id={`${p}_city`} name={`${p}_city`} required value={city} readOnly={lockedCity} onChange={(e) => setCity(e.target.value)} placeholder="Enter city / location" className={`input ${lockedCity ? "bg-slate-50" : ""}`} />
        </div>
        <div>
          <label className="label" htmlFor={`${p}_state`}>State *</label>
          <select id={`${p}_state`} name={`${p}_state`} required value={state} disabled={lockedCity && Boolean(state)} onChange={(e) => setState(e.target.value)} className="input">
            <option value="">Select state…</option>
            <optgroup label="States">{INDIAN_STATES.slice(0, 28).map((x) => <option key={x}>{x}</option>)}</optgroup>
            <optgroup label="Union territories">{INDIAN_STATES.slice(28).map((x) => <option key={x}>{x}</option>)}</optgroup>
          </select>
          {lockedCity && Boolean(state) && <input type="hidden" name={`${p}_state`} value={state} />}
        </div>
      </div>
    </div>
  );
}

export function CollegeDetails({ colleges, canRemove }: { colleges: College[]; canRemove: boolean }) {
  return (
    <section className="overflow-hidden rounded-[5px] border border-orange-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-navy"><GraduationCap size={16} className="text-orange-600" /> College details</header>
      <div className="p-4"><OrgPicker kind="college" orgs={colleges} canRemove={canRemove} /></div>
    </section>
  );
}

export function CompanyDetails({ clients, designations, canRemove }: { clients: Client[]; designations: string[]; canRemove: boolean }) {
  const [rows, setRows] = useState([0]);
  return (
    <section className="overflow-hidden rounded-[5px] border border-violet-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-navy"><Building2 size={16} className="text-violet-600" /> Company details</header>
      <div className="space-y-3 p-4">
        <OrgPicker kind="client" orgs={clients} canRemove={canRemove} />
        <MasterSelect name="company_designation" category="designation" label="Employee designation *" options={designations} placeholder="e.g. Design Engineer, DV Engineer…" canRemove={canRemove} />
        <div className="rounded-[5px] border border-line">
          <div className="flex items-center gap-2 border-b border-line bg-slate-50 px-3 py-2 text-xs font-semibold text-navy"><Users size={14} /> HR / company contact details</div>
          <div className="space-y-2 p-3">
            {rows.map((k, i) => (
              <div key={k} className="grid items-end gap-2 sm:grid-cols-[auto_1fr_1fr_1fr_1fr_auto]">
                <span className="grid size-7 place-items-center rounded bg-blue-50 text-xs font-semibold text-blue-700">{i + 1}</span>
                <div><label className="label" htmlFor={`hr.${k}.name`}>HR name{i === 0 ? " *" : ""}</label><input id={`hr.${k}.name`} name={`hr.${k}.name`} required={i === 0} placeholder="Enter full name" className="input" /></div>
                <div><label className="label" htmlFor={`hr.${k}.designation`}>Designation</label><input id={`hr.${k}.designation`} name={`hr.${k}.designation`} placeholder="Enter designation" className="input" /></div>
                <div><label className="label" htmlFor={`hr.${k}.email`}>Email ID</label><input id={`hr.${k}.email`} name={`hr.${k}.email`} type="email" placeholder="Enter email address" className="input" /></div>
                <div><label className="label" htmlFor={`hr.${k}.phone`}>Phone no.</label><input id={`hr.${k}.phone`} name={`hr.${k}.phone`} type="tel" placeholder="+91 mobile number" className="input" /></div>
                <button type="button" disabled={rows.length === 1} onClick={() => setRows((r) => r.filter((x) => x !== k))} aria-label={`Remove contact ${i + 1}`} className="grid size-9 place-items-center rounded-[5px] border border-red-200 bg-red-50 text-red-700 disabled:opacity-30"><Trash2 size={14} /></button>
              </div>
            ))}
            <input type="hidden" name="hr_rows" value={rows.join(",")} />
            {rows.length < 6 && <button type="button" onClick={() => setRows((r) => [...r, Math.max(...r) + 1])} className="w-full rounded-[5px] border border-dashed border-blue-300 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50">+ Add another HR / contact person</button>}
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted"><Info size={13} /> Company and HR information will be saved in the Company Master for future use.</p>
      </div>
    </section>
  );
}
