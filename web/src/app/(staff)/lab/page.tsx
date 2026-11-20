import { Monitor } from "lucide-react";
import Link from "next/link";
import { I, Row, Save } from "@/components/form-bits";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { assignLabSystemAction, removeLabSystemAction, saveLabSystemAction, setLabStatusAction } from "../module-actions";

export const metadata = { title: "System / lab" };

export default async function LabPage() {
  const repo = await getRepo();
  const [systems, students, access] = await Promise.all([repo.labSystems(), repo.students(), repo.accessOverview()]);
  const byId = new Map(students.map((s) => [s.id, s]));
  const taken = new Set(systems.map((l) => l.student_id).filter(Boolean));
  const eligible = students.filter((s) => s.status === "active");
  const tvRef = new Map(access.filter((a) => a.channel === "teamviewer" && a.external_ref).map((a) => [a.student_id, a.external_ref!]));
  const mapped = students.filter((s) => tvRef.has(s.id));

  return (
    <>
      <PageHeader title="System / lab management" subtitle="Lab systems, who each one is allocated to, and the TeamViewer ID mapped to that student." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Systems" value={systems.length} />
        <Stat label="Allocated" value={systems.filter((s) => s.status === "assigned").length} tone="blue" />
        <Stat label="Available" value={systems.filter((s) => s.status === "available").length} tone="green" />
        <Stat label="In maintenance" value={systems.filter((s) => s.status === "maintenance").length} tone="amber" />
      </div>

      <Card title="System allocation" icon={<Monitor size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>System</th><th>Location / specs</th><th>TeamViewer ID</th><th>Status</th><th>Allocated to</th><th>Allocate</th><th /></tr></thead>
          <tbody>
            {systems.map((l) => {
              const s = l.student_id ? byId.get(l.student_id) : undefined;
              return (
                <tr key={l.id}>
                  <td className="font-medium">{l.code}</td>
                  <td className="text-xs">{l.location}<div className="text-muted">{l.specs}</div>{l.notes && <div className="text-amber-700">{l.notes}</div>}</td>
                  <td className="font-mono text-xs">{l.teamviewer_id ?? "—"}</td>
                  <td><Badge tone={l.status === "assigned" ? "blue" : l.status === "available" ? "green" : "amber"}>{l.status === "assigned" ? "Allocated" : l.status === "available" ? "Available" : "Maintenance"}</Badge></td>
                  <td>{s ? <Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.full_name}</Link> : "—"}{l.assigned_at && <div className="text-[11px] text-muted">since {fmtDate(l.assigned_at)}</div>}</td>
                  <td>
                    {l.status !== "maintenance" && (
                      <form key={`${l.id}:${l.student_id ?? ""}`} action={assignLabSystemAction} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={l.id} />
                        <select name="student_id" defaultValue={l.student_id ?? ""} aria-label={`Allocate ${l.code}`} className="input w-44 py-1">
                          <option value="">— Free —</option>
                          {eligible.filter((x) => x.id === l.student_id || !taken.has(x.id)).map((x) => <option key={x.id} value={x.id}>{x.full_name} ({x.enrollment_no})</option>)}
                        </select>
                        <button className="btn-primary py-1">Save</button>
                      </form>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {l.status === "maintenance"
                      ? <form action={setLabStatusAction.bind(null, l.id, "available")} className="inline"><button className="text-emerald-700 hover:underline">Back in service</button></form>
                      : <form action={setLabStatusAction.bind(null, l.id, "maintenance")} className="inline"><button className="text-amber-700 hover:underline">Maintenance</button></form>}
                    {" · "}
                    <form action={removeLabSystemAction.bind(null, l.id)} className="inline"><button className="text-brand hover:underline">Remove</button></form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Add or edit systems">
          {systems.map((l) => (
            <Row key={l.id} action={saveLabSystemAction}>
              <input type="hidden" name="id" value={l.id} />
              <I name="code" value={l.code} w="w-28" required placeholder="Code" />
              <I name="location" value={l.location} w="w-28" placeholder="Location" />
              <I name="specs" value={l.specs} w="min-w-40 flex-1" placeholder="Specs / tools" />
              <I name="teamviewer_id" value={l.teamviewer_id} w="w-36" placeholder="TeamViewer ID" />
              <I name="notes" value={l.notes} w="w-32" placeholder="Notes" />
              <Save />
            </Row>
          ))}
          <Row action={saveLabSystemAction}>
            <I name="code" w="w-28" required placeholder="LAB-PC-06" />
            <I name="location" w="w-28" placeholder="Location" />
            <I name="specs" w="min-w-40 flex-1" placeholder="Specs / tools" />
            <I name="teamviewer_id" w="w-36" placeholder="TeamViewer ID" />
            <I name="notes" w="w-32" placeholder="Notes" />
            <Save label="+ Add" />
          </Row>
        </Card>

        <Card title={`TeamViewer mapping (${mapped.length} students)`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>TeamViewer ID</th><th>Lab system</th></tr></thead>
            <tbody>
              {mapped.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`} className="hover:text-brand">{s.full_name}</Link></td>
                  <td className="font-mono text-xs">{tvRef.get(s.id)}</td>
                  <td>{systems.find((l) => l.student_id === s.id)?.code ?? <span className="text-muted">Own device</span>}</td>
                </tr>
              ))}
              {!mapped.length && <tr><td colSpan={3} className="text-center text-muted">No TeamViewer IDs mapped yet. Allocating a system maps its ID automatically.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
