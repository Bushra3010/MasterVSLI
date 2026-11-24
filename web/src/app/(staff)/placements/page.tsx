import { FileSpreadsheet, Plus } from "lucide-react";
import Link from "next/link";
import { Badge, Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { SHEET_COLUMNS } from "@/lib/integrations/google-sheets";
import { getRepo } from "@/lib/server";
import type { Consent } from "@/lib/types";
import { setPlacementGroupAction } from "../crm-actions";
import { createDriveAction, recordResponseAction, setDriveStatusAction, setStageAction } from "../actions";
import { SyncButton } from "./sync-button";

export const metadata = { title: "Placements" };

const STAGES = ["Applied", "Shortlisted", "Interview", "No-show", "Offered", "Rejected", "Joined"];

export default async function PlacementsPage({ searchParams }: PageProps<"/placements">) {
  const sp = await searchParams;
  const repo = await getRepo();
  const [drives, responses, students, consents, placementTerms] = await Promise.all([repo.drives(), repo.responses(), repo.students(), repo.list<Consent>("consents", { eq: { kind: "placement" } }), repo.activeTerms("placement")]);
  const agreed = new Set(consents.filter((c) => c.version === placementTerms?.version).map((c) => c.student_id));
  const activeStudents = students.filter((s) => s.status === "active");
  const groupQueue = students.filter((s) => s.placement_group === "requested");
  const selected = drives.find((d) => d.id === sp.drive) ?? drives.find((d) => d.status === "open") ?? drives[0];
  const student = new Map(students.map((s) => [s.id, s]));
  const rs = responses.filter((r) => r.drive_id === selected?.id);
  const eligible = students.filter((s) => s.status === "active" && s.placement_consent);
  const responded = new Set(rs.map((r) => r.student_id));
  const notResponded = eligible.filter((s) => !responded.has(s.id));
  const yes = responses.filter((r) => r.response === "yes");
  // Everyone who can answer, plus anyone who already did — answered "yes" first.
  const roster = [...new Map([...eligible, ...rs.map((r) => student.get(r.student_id)).filter((x): x is NonNullable<typeof x> => Boolean(x))].map((x) => [x.id, x])).values()]
    .map((x) => ({ s: x, r: rs.find((r) => r.student_id === x.id) }))
    .sort((a, b) => Number(b.r?.response === "yes") - Number(a.r?.response === "yes") || a.s.full_name.localeCompare(b.s.full_name));

  return (
    <>
      <PageHeader title="Placement management" subtitle="Admin creates a drive → all eligible students see it → “Yes” responses auto-sync to Google Sheets." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open drives" value={drives.filter((d) => d.status === "open").length} tone="green" />
        <Stat label="Interested (yes)" value={yes.length} tone="blue" />
        <Stat label="Synced to sheet" value={yes.filter((r) => r.synced_to_sheet).length} />
        <Stat label="Offers" value={responses.filter((r) => r.stage === "Offered" || r.stage === "Joined").length} tone="green" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {drives.map((d) => {
              const r = responses.filter((x) => x.drive_id === d.id);
              return (
                <Link
                  key={d.id}
                  href={`/placements?drive=${d.id}`}
                  className={`rounded-xl border bg-white p-4 shadow-sm ${d.id === selected?.id ? "border-brand ring-2 ring-brand/15" : "border-line hover:border-navy"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-navy">{d.company}</div>
                      <div className="text-sm">{d.job_role}</div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="mt-2 text-xs text-muted">{[d.location, d.drive_date && fmtDate(d.drive_date), d.interview_mode, d.ctc].filter(Boolean).join(" · ")}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="green">{r.filter((x) => x.response === "yes").length} interested</Badge>
                    <Badge tone="red">{r.filter((x) => x.response === "no").length} not interested</Badge>
                    <span className="text-[11px] text-muted">Open to record answers →</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {selected && (
            <Card
              title={`Drive participation — ${selected.company}`}
              bodyClass="p-0 overflow-x-auto"
              actions={
                <div className="flex items-center gap-2">
                  {(["upcoming", "open", "closed"] as const).filter((s) => s !== selected.status).map((s) => (
                    <form key={s} action={setDriveStatusAction.bind(null, selected.id, s)}>
                      <button className="rounded bg-white/10 px-2 py-0.5 text-xs capitalize hover:bg-white/20">Mark {s}</button>
                    </form>
                  ))}
                </div>
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
                <span className="text-sm text-muted">
                  {[selected.eligibility, `${notResponded.length} eligible students haven't responded`].filter(Boolean).join(" · ")}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/api/export/drive?drive=${selected.id}`} className="btn-ghost py-1.5 text-xs">Download sheet (Excel)</a>
                  <SyncButton driveId={selected.id} pending={rs.filter((r) => r.response === "yes" && !r.synced_to_sheet).length} />
                </div>
              </div>
              <table className="table">
                <thead><tr><th>Student</th><th>Interested?</th><th>Stage</th><th>Google Sheet</th></tr></thead>
                <tbody>
                  {roster.map(({ s: st, r }) => (
                    <tr key={st.id}>
                      <td>
                        <Link href={`/students/${st.id}`} className="font-medium hover:text-brand">{st.full_name}</Link>
                        <div className="text-xs text-muted">{st.enrollment_no} · {st.course_name}</div>
                      </td>
                      <td>
                        {selected.status === "closed" ? (
                          r ? <StatusBadge status={r.response} /> : <span className="text-xs text-muted">No answer</span>
                        ) : (
                          <form action={recordResponseAction.bind(null, selected.id)} className="flex gap-1">
                            <input type="hidden" name="student_id" value={st.id} />
                            <button name="response" value="yes" aria-pressed={r?.response === "yes"} className={`btn py-1 text-xs ${r?.response === "yes" ? "bg-emerald-600 text-white" : "border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"}`}>Yes</button>
                            <button name="response" value="no" aria-pressed={r?.response === "no"} className={`btn py-1 text-xs ${r?.response === "no" ? "bg-red-600 text-white" : "border border-red-200 bg-white text-red-700 hover:bg-red-50"}`}>No</button>
                          </form>
                        )}
                      </td>
                      <td>
                        {r?.response === "yes" ? (
                          <form action={async (f: FormData) => { "use server"; await setStageAction(selected.id, st.id, String(f.get("stage"))); }} className="flex gap-1">
                            <select name="stage" defaultValue={r.stage ?? "Applied"} aria-label="Stage" className="input w-auto py-1 text-xs">
                              {STAGES.map((x) => <option key={x}>{x}</option>)}
                            </select>
                            <button className="btn-ghost py-1 text-xs">Save</button>
                          </form>
                        ) : "—"}
                      </td>
                      <td>
                        {r?.response !== "yes" ? "—" : r.synced_to_sheet ? <Badge tone="green">Synced {fmtDate(r.synced_at)}</Badge> : <Badge tone="amber">Not synced</Badge>}
                      </td>
                    </tr>
                  ))}
                  {!roster.length && <tr><td colSpan={4} className="text-center text-muted">No active students with placement consent yet</td></tr>}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Create placement drive" icon={<Plus size={15} />}>
            <form action={createDriveAction} className="space-y-3">
              <div><label className="label">Company name *</label><input name="company" required className="input" placeholder="e.g. Intel" /></div>
              <div><label className="label">Job role *</label><input name="job_role" required className="input" placeholder="Design Verification Engineer" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Location</label><input name="location" className="input" /></div>
                <div><label className="label">Drive date</label><input name="drive_date" type="date" className="input" /></div>
                <div>
                  <label className="label">Interview mode</label>
                  <select name="interview_mode" className="input"><option>Online</option><option>Offline</option><option>Hybrid</option></select>
                </div>
                <div><label className="label">CTC</label><input name="ctc" className="input" placeholder="6–8 LPA" /></div>
              </div>
              <div><label className="label">Eligibility</label><input name="eligibility" className="input" placeholder="B.Tech ECE, 2023–25, DV trained" /></div>
              <div>
                <label className="label">Visibility</label>
                <select name="status" className="input"><option value="open">Open — visible to students now</option><option value="upcoming">Upcoming</option></select>
              </div>
              <button className="btn-primary w-full">Create drive</button>
            </form>
          </Card>

          <Card title="Google Sheet columns" icon={<FileSpreadsheet size={15} />}>
            <p className="mb-2 text-xs text-muted">Each drive gets its own tab. Every “Yes” is appended with the full profile:</p>
            <div className="flex flex-wrap gap-1">
              {SHEET_COLUMNS.map((c) => <Badge key={c}>{c}</Badge>)}
            </div>
          </Card>
        </div>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title={`Placement agreement status (${activeStudents.filter((s) => agreed.has(s.id)).length} / ${activeStudents.length} active students)`} bodyClass="p-0 overflow-x-auto max-h-96">
          <table className="table">
            <thead><tr><th>Student</th><th>Placement profile</th><th>Group</th></tr></thead>
            <tbody>
              {activeStudents.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.full_name}</Link></td>
                  <td>{agreed.has(s.id) || !placementTerms ? <span className="text-xs text-emerald-700">Active (terms accepted)</span> : <span className="text-xs text-red-600">Not active – terms pending</span>}</td>
                  <td className="text-xs capitalize">{s.placement_group ?? "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title={`WhatsApp Placement Group – add requests (${groupQueue.length})`}>
          <p className="mb-2 text-xs text-muted">Students who accepted the placement terms and pressed “Join Placement Group”. Add their number to the group (the link is never shown to students), then mark them added.</p>
          <ul className="space-y-2">
            {groupQueue.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-[5px] border border-line px-3 py-2 text-[13px]">
                <span><b className="font-medium text-navy">{s.full_name}</b> · {s.phone ?? "no phone"}</span>
                <form action={setPlacementGroupAction.bind(null, s.id, "added")}><button className="btn-primary py-1 text-xs">Mark added</button></form>
              </li>
            ))}
            {!groupQueue.length && <li className="text-sm text-muted">No pending requests.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
