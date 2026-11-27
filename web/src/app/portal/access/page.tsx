import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import { getStudent360 } from "@/lib/student360";
import type { LabSystem } from "@/lib/types";

export const metadata = { title: "Access & groups" };

const CHANNEL: Record<string, string> = { zoom: "Zoom live classes", teamviewer: "TeamViewer lab access", biometric: "Biometric entry", placement: "Placement applications", portal: "Student portal" };

export default async function PortalAccess() {
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const st = d.p.student;
  const lab = await (await getStudentReadRepo()).list<LabSystem>("lab_systems", { eq: { student_id: s.studentId } }).catch(() => [] as LabSystem[]);
  const group = st.placement_group ?? "none";

  return (
    <>
      <PageHeader title="Access & Groups" subtitle="WhatsApp groups, training access and lab allocation. Access is managed by the office." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Training access" bodyClass="p-0">
          <table className="table">
            <thead><tr><th>Access</th><th>Status</th></tr></thead>
            <tbody>
              {d.p.access.map((a) => (
                <tr key={a.channel}><td>{CHANNEL[a.channel] ?? a.channel}</td><td>{a.enabled ? <Badge tone="green">Active</Badge> : <Badge tone="red">Paused</Badge>}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="space-y-5">
          <Card title="WhatsApp groups" bodyClass="p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>MasterVLSI Placement Group</span>
              {group === "added" ? <Badge tone="green">Added</Badge> : group === "requested" ? <Badge tone="blue">Join requested</Badge> : <Badge tone="slate">Not joined</Badge>}
            </div>
            {group !== "added" && <Link href="/portal/agreement" className="mt-3 inline-block text-xs font-medium text-brand underline">Join from the Placement Agreement page →</Link>}
          </Card>
          <Card title="Lab allocation" bodyClass="p-4 text-sm">
            {lab.length ? (
              <ul className="space-y-1">{lab.map((l) => <li key={l.id}><b className="font-mono">{l.code}</b>{l.location ? ` · ${l.location}` : ""}{l.assigned_at ? <span className="text-xs text-muted"> · since {fmtDate(l.assigned_at)}</span> : null}</li>)}</ul>
            ) : <p className="text-muted">No lab system allocated to you.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
