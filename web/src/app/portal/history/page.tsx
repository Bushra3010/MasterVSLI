import { Card, PageHeader } from "@/components/ui";
import { fmtDate, inr } from "@/lib/format";
import { templateMeta } from "@/lib/letters";
import { requireStudent } from "@/lib/session";
import { getStudent360 } from "@/lib/student360";
import { requestKindLabel } from "@/lib/types";

export const metadata = { title: "My history" };

type Ev = { at: string; group: string; text: string };
const DOT: Record<string, string> = { Admission: "bg-blue-600", Finance: "bg-emerald-600", Placement: "bg-violet-600", Office: "bg-amber-500", Requests: "bg-sky-500", Documents: "bg-slate-500" };

export default async function PortalHistory() {
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const { p } = d;
  const ev: Ev[] = [
    { at: p.student.admission_date, group: "Admission", text: `Admitted to ${p.course?.name ?? "the course"} (${p.student.enrollment_no})` },
    ...p.payments.map((x) => ({ at: x.paid_at, group: "Finance", text: `Payment of ${inr(Number(x.amount))} received (${x.mode})` })),
    ...d.submissions.map((x) => ({ at: x.created_at ?? x.paid_on, group: "Finance", text: `Submitted payment of ${inr(Number(x.amount))} — ${x.status === "pending" ? "awaiting verification" : x.status}` })),
    ...p.responses.filter((r) => r.response !== "pending").map((r) => ({ at: r.updated_at ?? "", group: "Placement", text: `Answered ${r.response === "yes" ? "Yes" : "No"} to ${r.drive.company} drive` })),
    ...d.interviews.map((i) => ({ at: i.scheduled_at, group: "Placement", text: `Interview with ${i.company}${i.round ? ` (${i.round})` : ""} — ${i.status}` })),
    ...d.applications.map((a) => ({ at: a.applied_on, group: "Placement", text: `Application to ${a.company} — ${a.status.replace("_", " ")}` })),
    ...d.requests.map((r) => ({ at: r.created_at ?? "", group: "Requests", text: `${requestKindLabel(r.kind)}: ${r.subject} — ${r.status.replace("_", " ")}` })),
    ...p.letters.map((l) => ({ at: l.issued_at, group: "Documents", text: `${templateMeta(l.template)?.title ?? "Document"} issued (${l.serial_no})` })),
    ...p.events.map((e) => ({ at: e.created_at, group: "Office", text: `${e.action.replace(/_/g, " ")}${e.reason ? ` — ${e.reason}` : ""}` })),
  ]
    .filter((e) => e.at)
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PageHeader title="My History" subtitle="Activity timeline, office actions and interactions — your Student ID stays the same for life." />
      <Card title={`Activity timeline (${ev.length})`} bodyClass="p-4">
        <ol className="relative space-y-3 border-l border-line pl-5">
          {ev.slice(0, 120).map((e, i) => (
            <li key={i} className="relative">
              <span className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ${DOT[e.group] ?? "bg-slate-400"}`} />
              <div className="text-[13px]">{e.text}</div>
              <div className="text-[11px] text-muted">{fmtDate(e.at)} · {e.group}</div>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
