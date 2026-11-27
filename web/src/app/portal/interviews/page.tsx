import { Flash, Kpi } from "@/components/student360";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { fmtDate, istDateTime } from "@/lib/format";
import { requireStudent } from "@/lib/session";
import { getStudent360 } from "@/lib/student360";
import type { StudentInterview } from "@/lib/types";
import { explainMissedAction } from "../actions-360";

export const metadata = { title: "Interviews & offers" };

const IV_TONE = { scheduled: "blue", attended: "green", missed: "red", cancelled: "slate" } as const;

function Details({ i }: { i: StudentInterview }) {
  return (
    <>
      <div className="font-semibold text-navy">{i.company}{i.role ? <span className="font-normal text-muted"> · {i.role}</span> : null}</div>
      <div className="text-xs text-muted">{istDateTime(i.scheduled_at)}{i.round ? ` · ${i.round}` : ""}{i.mode ? ` · ${i.mode}` : ""}{i.location ? ` · ${i.location}` : ""}</div>
    </>
  );
}

export default async function PortalInterviews({ searchParams }: PageProps<"/portal/interviews">) {
  const sp = await searchParams;
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const { interviews, applications, p } = d;
  const upcoming = interviews.filter((i) => i.status === "scheduled");
  const missed = interviews.filter((i) => i.status === "missed");
  const past = interviews.filter((i) => i.status === "attended" || i.status === "cancelled").reverse();
  const offers = applications.filter((a) => a.status === "selected" || a.status === "placed");
  const yes = p.responses.filter((r) => r.response === "yes").length;

  return (
    <>
      <PageHeader title="Interviews & Offers" subtitle="Upcoming interviews, missed interviews, applications, offers and placement performance." />
      <Flash sp={sp} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Drives applied (Yes)" value={yes} />
        <Kpi label="Applications" value={applications.length} />
        <Kpi label="Upcoming interviews" value={upcoming.length} />
        <Kpi label="Missed interviews" value={missed.length} tone={missed.length ? "red" : undefined} />
        <Kpi label="Offers" value={offers.length} tone={offers.length ? "green" : undefined} />
      </div>

      <Card title={`Upcoming interviews (${upcoming.length})`} className="mb-5" bodyClass="p-3">
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.map((i) => (
              <li key={i.id} id={`iv-${i.id}`} className="flex scroll-mt-24 flex-wrap items-center justify-between gap-2 rounded-[5px] border border-sky-200 bg-sky-50/60 px-3 py-2">
                <div><Details i={i} /></div>
                {i.call_letter_url ? <a href={i.call_letter_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">Call letter</a> : <span className="text-[11px] text-muted">Call letter: shared by the placement team</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No interviews scheduled right now.</p>}
      </Card>

      <Card title={`Missed interviews (${missed.length})`} className="mb-5" bodyClass="p-3">
        {missed.length ? (
          <ul className="space-y-3">
            {missed.map((i) => (
              <li key={i.id} id={`iv-${i.id}`} className="scroll-mt-24 rounded-[5px] border border-red-200 bg-red-50/60 p-3">
                <Details i={i} />
                {i.explanation ? (
                  <div className="mt-2 text-sm"><Badge tone="slate">Explanation submitted {fmtDate(i.explained_at)}</Badge><p className="mt-1 text-[13px]">{i.explanation}</p></div>
                ) : (
                  <form action={explainMissedAction.bind(null, i.id)} className="mt-2 space-y-2">
                    <label className="label" htmlFor={`exp-${i.id}`}>Why did you miss this interview?</label>
                    <textarea id={`exp-${i.id}`} name="explanation" required minLength={10} rows={3} className="input" />
                    <button className="btn-primary">Submit explanation</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No missed interviews. Keep it up!</p>}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Applications (${applications.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Company</th><th>Applied</th><th>Rounds</th><th>Status</th></tr></thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}><td className="font-medium">{a.company}<div className="text-[11px] text-muted">{a.role}</div></td><td className="whitespace-nowrap">{fmtDate(a.applied_on)}</td><td>{a.rounds}</td><td><StatusBadge status={a.status} /></td></tr>
              ))}
              {!applications.length && <tr><td colSpan={4} className="text-center text-muted">No applications recorded yet.</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title={`Offers (${offers.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Company</th><th>Package</th><th>Joining</th><th>Location</th></tr></thead>
            <tbody>
              {offers.map((a) => (
                <tr key={a.id}><td className="font-medium">{a.company}<div className="text-[11px] text-muted">{a.role}</div></td><td>{a.package ?? "—"}</td><td>{a.doj ? fmtDate(a.doj) : "—"}</td><td>{a.job_location ?? "—"}</td></tr>
              ))}
              {!offers.length && <tr><td colSpan={4} className="text-center text-muted">No offers yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      {past.length > 0 && (
        <Card title="Interview history" className="mt-5" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>Company</th><th>Round</th><th>Status</th><th>Outcome</th></tr></thead>
            <tbody>
              {past.map((i) => (
                <tr key={i.id}><td className="whitespace-nowrap">{istDateTime(i.scheduled_at)}</td><td className="font-medium">{i.company}</td><td>{i.round ?? "—"}</td><td><Badge tone={IV_TONE[i.status]}>{i.status}</Badge></td><td className="text-xs">{i.outcome ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
