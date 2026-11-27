import Link from "next/link";
import { Flash } from "@/components/student360";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate, inr, istDateTime, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getStore, requireStaff } from "@/lib/session";
import { createStudent360Repo } from "@/lib/student360";
import { REQUEST_TONE, requestKindLabel, type Installment } from "@/lib/types";
import { decidePaymentAction, decideRequestAction, saveInterviewAction, setInterviewStatusAction } from "./actions";

export const metadata = { title: "Student desk" };

const TABS = [
  ["payments", "Payment verification"],
  ["requests", "Requests & certificates"],
  ["interviews", "Interviews"],
] as const;
const IV_TONE = { scheduled: "blue", attended: "green", missed: "red", cancelled: "slate" } as const;

export default async function StudentDesk({ searchParams }: PageProps<"/student-desk">) {
  const sp = await searchParams;
  await requireStaff();
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as string) : "payments";
  const db = await getStore();
  const r360 = createStudent360Repo(db);
  const repo = await getRepo();
  const [students, subs, requests, interviews] = await Promise.all([repo.students({ status: "all" }), r360.submissions(), r360.requests(), r360.interviews()]);
  const name = new Map(students.map((s) => [s.id, s]));
  const who = (id: string) => {
    const s = name.get(id);
    return s ? <Link href={`/students/${id}`} className="font-medium text-navy hover:underline">{s.full_name}<div className="font-mono text-[11px] font-normal text-muted">{s.enrollment_no}</div></Link> : <span className="text-muted">—</span>;
  };
  const pendingSubs = subs.filter((x) => x.status === "pending");
  const openReq = requests.filter((r) => r.status === "open" || r.status === "in_progress");
  const instIds = [...new Set(pendingSubs.map((x) => x.installment_id).filter(Boolean))] as string[];
  const insts = instIds.length ? await db.select<Installment>("installments", { in: { id: instIds } }) : [];
  const now = todayISO();
  const upcoming = interviews.filter((i) => i.status === "scheduled");
  const explained = interviews.filter((i) => i.status === "missed").sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  const count: Record<string, number> = { payments: pendingSubs.length, requests: openReq.length, interviews: upcoming.length };

  return (
    <>
      <PageHeader title="Student Desk & Approvals" subtitle="Verify student payments, act on requests and certificates, and schedule interviews. Students see each update in their portal." />
      <Flash sp={sp} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Desk sections">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/student-desk?tab=${k}`} className={`rounded-[5px] border px-3 py-1.5 text-sm ${k === tab ? "border-brand bg-brand text-white" : "border-line bg-white text-navy hover:bg-slate-50"}`}>
            {l} <span className="ml-1 rounded-full bg-black/10 px-1.5 text-xs">{count[k]}</span>
          </Link>
        ))}
      </nav>

      {tab === "payments" && (
        <>
          <Card title={`Waiting for verification (${pendingSubs.length})`} bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Student</th><th>Installment</th><th>Amount</th><th>Mode · reference</th><th>Paid on</th><th>Proof</th><th>Office decision</th></tr></thead>
              <tbody>
                {pendingSubs.map((x) => {
                  const inst = insts.find((i) => i.id === x.installment_id);
                  return (
                    <tr key={x.id}>
                      <td>{who(x.student_id)}</td>
                      <td className="text-xs">{inst ? <>#{inst.seq} · due {fmtDate(inst.due_date)}<div className="text-muted">balance {inr(Number(inst.amount) - Number(inst.paid_amount))}</div></> : "—"}</td>
                      <td className="tabular-nums font-medium">{inr(Number(x.amount))}</td>
                      <td className="text-xs">{x.mode}{x.reference ? ` · ${x.reference}` : ""}{x.note && <div className="text-muted">{x.note}</div>}</td>
                      <td className="whitespace-nowrap">{fmtDate(x.paid_on)}</td>
                      <td>{x.document_id ? <a href={`/api/documents/${x.document_id}`} target="_blank" className="text-xs font-medium text-brand underline">View</a> : <span className="text-xs text-muted">—</span>}</td>
                      <td>
                        <form className="flex flex-wrap items-center gap-1">
                          <input name="office_note" placeholder="Note (optional)" aria-label="Office note" className="input w-36 py-1 text-xs" />
                          <button formAction={decidePaymentAction.bind(null, x.id, true)} className="btn bg-emerald-600 px-2 py-1 text-xs text-white">Approve</button>
                          <button formAction={decidePaymentAction.bind(null, x.id, false)} className="btn border border-red-200 px-2 py-1 text-xs text-red-700">Reject</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
                {!pendingSubs.length && <tr><td colSpan={7} className="text-center text-muted">Nothing waiting. All payments verified.</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="Recently decided" className="mt-5" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Student</th><th>Amount</th><th>Decision</th><th>By</th><th>When</th></tr></thead>
              <tbody>
                {subs.filter((x) => x.status !== "pending").slice(0, 15).map((x) => (
                  <tr key={x.id}><td>{who(x.student_id)}</td><td className="tabular-nums">{inr(Number(x.amount))}</td><td><Badge tone={x.status === "approved" ? "green" : "red"}>{x.status}</Badge>{x.office_note && <div className="text-[11px] text-muted">{x.office_note}</div>}</td><td className="text-xs">{x.decided_by}</td><td className="text-xs">{fmtDate(x.decided_at)}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {tab === "requests" && (
        <Card title={`Open requests (${openReq.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>Raised</th><th>Type</th><th>Request</th><th>Status</th><th>Respond</th></tr></thead>
            <tbody>
              {[...openReq, ...requests.filter((r) => !openReq.includes(r)).slice(0, 10)].map((r) => (
                <tr key={r.id}>
                  <td>{who(r.student_id)}</td>
                  <td className="whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="text-xs">{requestKindLabel(r.kind)}</td>
                  <td><div className="font-medium">{r.subject}</div>{r.details && <div className="max-w-xs text-[11px] text-muted">{r.details}</div>}</td>
                  <td><Badge tone={REQUEST_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>{r.decided_by && <div className="text-[11px] text-muted">{r.decided_by}</div>}</td>
                  <td>
                    <form action={decideRequestAction.bind(null, r.id)} className="flex flex-wrap items-center gap-1">
                      <select name="status" defaultValue={r.status === "open" ? (r.kind === "certificate" || r.kind === "validity_extension" ? "approved" : "closed") : r.status} aria-label="Status" className="input w-auto py-1 text-xs">
                        <option value="in_progress">In progress</option>
                        <option value="approved">Approve</option>
                        <option value="rejected">Reject</option>
                        <option value="closed">Close</option>
                      </select>
                      <input name="response" defaultValue={r.response ?? ""} placeholder="Reply to student" aria-label="Reply" className="input w-44 py-1 text-xs" />
                      <button className="btn-navy px-2 py-1 text-xs">Save</button>
                    </form>
                    {r.kind === "validity_extension" && r.status !== "approved" && <div className="mt-1 text-[11px] text-muted">Approving extends validity by {String(r.data?.months ?? 3)} months and restores access.</div>}
                    {r.kind === "certificate" && <Link href={`/documents?subject=student:${r.student_id}`} className="mt-1 inline-block text-[11px] text-brand underline">Issue the certificate →</Link>}
                  </td>
                </tr>
              ))}
              {!requests.length && <tr><td colSpan={6} className="text-center text-muted">No requests yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "interviews" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
          <Card title="Schedule an interview" bodyClass="p-4">
            <form action={saveInterviewAction} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="student_id">Student</label>
                <select id="student_id" name="student_id" required className="input">
                  <option value="">Choose a student…</option>
                  {students.filter((s) => s.status === "active").map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.enrollment_no}</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor="company">Company</label><input id="company" name="company" required className="input" /></div>
              <div><label className="label" htmlFor="role">Role</label><input id="role" name="role" className="input" /></div>
              <div><label className="label" htmlFor="date">Date</label><input id="date" name="date" type="date" required min={now} className="input" /></div>
              <div><label className="label" htmlFor="time">Time (IST)</label><input id="time" name="time" type="time" defaultValue="10:00" className="input" /></div>
              <div><label className="label" htmlFor="round">Round</label><input id="round" name="round" placeholder="Technical round 1" className="input" /></div>
              <div><label className="label" htmlFor="mode">Mode</label><select id="mode" name="mode" className="input"><option>Online</option><option>Offline</option><option>Telephonic</option></select></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="location">Venue / meeting link</label><input id="location" name="location" className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="call_letter_url">Call letter link (https://)</label><input id="call_letter_url" name="call_letter_url" type="url" className="input" /></div>
              <button className="btn-primary sm:col-span-2">Schedule interview</button>
            </form>
          </Card>
          <div className="space-y-5">
            <Card title={`Upcoming & open (${upcoming.length})`} bodyClass="p-0 overflow-x-auto">
              <table className="table">
                <thead><tr><th>Student</th><th>Interview</th><th>Update</th></tr></thead>
                <tbody>
                  {upcoming.map((i) => (
                    <tr key={i.id}>
                      <td>{who(i.student_id)}</td>
                      <td><div className="font-medium">{i.company}{i.round ? ` · ${i.round}` : ""}</div><div className="text-[11px] text-muted">{istDateTime(i.scheduled_at)}{i.mode ? ` · ${i.mode}` : ""}</div></td>
                      <td>
                        <form action={setInterviewStatusAction.bind(null, i.id)} className="flex flex-wrap items-center gap-1">
                          <select name="status" aria-label="Status" className="input w-auto py-1 text-xs"><option value="attended">Attended</option><option value="missed">Missed</option><option value="cancelled">Cancelled</option></select>
                          <input name="outcome" placeholder="Outcome" aria-label="Outcome" className="input w-32 py-1 text-xs" />
                          <button className="btn-navy px-2 py-1 text-xs">Save</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {!upcoming.length && <tr><td colSpan={3} className="text-center text-muted">No interviews scheduled.</td></tr>}
                </tbody>
              </table>
            </Card>
            <Card title={`Missed interviews & explanations (${explained.length})`} bodyClass="p-0 overflow-x-auto">
              <table className="table">
                <thead><tr><th>Student</th><th>Interview</th><th>Explanation</th></tr></thead>
                <tbody>
                  {explained.map((i) => (
                    <tr key={i.id}>
                      <td>{who(i.student_id)}</td>
                      <td><div className="font-medium">{i.company}</div><div className="text-[11px] text-muted">{istDateTime(i.scheduled_at)}</div></td>
                      <td className="text-xs">{i.explanation ? <>{i.explanation}<div className="text-muted">{fmtDate(i.explained_at)}</div></> : <Badge tone="red">Waiting for student</Badge>}</td>
                    </tr>
                  ))}
                  {!explained.length && <tr><td colSpan={3} className="text-center text-muted">No missed interviews.</td></tr>}
                </tbody>
              </table>
            </Card>
            <Card title="Recent interview results" bodyClass="p-0 overflow-x-auto">
              <table className="table">
                <tbody>
                  {interviews.filter((i) => i.status === "attended" || i.status === "cancelled").slice(-8).reverse().map((i) => (
                    <tr key={i.id}><td>{who(i.student_id)}</td><td>{i.company}</td><td><Badge tone={IV_TONE[i.status]}>{i.status}</Badge></td><td className="text-xs">{i.outcome ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
