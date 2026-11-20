import { Lock } from "lucide-react";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getRepo, getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import { respondAction } from "../actions";

export const metadata = { title: "Placement drives" };

export default async function PortalDrives() {
  const s = await requireStudent();
  const repo = await getRepo();
  const p = await (await getStudentReadRepo()).profile(s.studentId);
  const allowed = p?.student.status === "active" && p.access.find((a) => a.channel === "placement")?.enabled;
  const drives = allowed ? (await repo.drives()).filter((d) => d.status !== "closed") : [];
  const mine = new Map(p?.responses.map((r) => [r.drive_id, r]) ?? []);

  return (
    <>
      <PageHeader title="Placement drives" subtitle="Tell us if you want to be considered — your “Yes” goes straight to the placement team's sheet." />
      {!allowed ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <Lock size={18} /> Placement applications are blocked for your account. Please contact the admin office.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drives.map((d) => {
            const r = mine.get(d.id);
            return (
              <Card key={d.id} title={d.company} actions={<StatusBadge status={d.status} />}>
                <div className="font-medium">{d.job_role}</div>
                <div className="mt-1 text-sm text-muted">{[d.location, d.drive_date && fmtDate(d.drive_date), d.interview_mode].filter(Boolean).join(" · ")}</div>
                <div className="mt-1 text-sm">CTC: {d.ctc ?? "—"}</div>
                <div className="mt-1 text-xs text-muted">Eligibility: {d.eligibility ?? "—"}</div>
                <div className="mt-4 flex items-center gap-2">
                  {d.status === "open" ? (
                    <>
                      <form action={respondAction.bind(null, d.id, "yes")}>
                        <button className={`btn ${r?.response === "yes" ? "bg-emerald-600 text-white" : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>Yes, interested</button>
                      </form>
                      <form action={respondAction.bind(null, d.id, "no")}>
                        <button className={`btn ${r?.response === "no" ? "bg-brand text-white" : "border border-red-200 text-brand hover:bg-red-50"}`}>No</button>
                      </form>
                    </>
                  ) : (
                    <Badge tone="blue">Opens soon</Badge>
                  )}
                </div>
                {r?.response === "yes" && (
                  <div className="mt-3 text-xs text-muted">
                    Stage: <b>{r.stage ?? "Applied"}</b> · {r.synced_to_sheet ? "Shared with placement team" : "Waiting to sync"}
                  </div>
                )}
              </Card>
            );
          })}
          {!drives.length && <p className="text-sm text-muted">No drives right now.</p>}
        </div>
      )}
    </>
  );
}
