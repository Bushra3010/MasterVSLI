import { Lock } from "lucide-react";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import Link from "next/link";
import { getServiceRepo, getStudentReadRepo } from "@/lib/server";
import { getServiceStore, requireStudent } from "@/lib/session";
import { createStudent360Repo } from "@/lib/student360";
import { respondAction } from "../actions";

export const metadata = { title: "Placement drives" };

const MESSAGES: Record<string, string> = {
  blocked: "Placement applications are blocked for your account. Please contact the admin office.",
  terms: "Accept the Placement Terms & Conditions first (Placement Agreement in the menu).",
  closed: "That drive is no longer accepting answers.",
};

export default async function PortalDrives({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireStudent();
  const p = await (await getStudentReadRepo()).profile(s.studentId);
  const agreed = !(await getServiceRepo().consentFor(s.studentId, "placement")).required;
  const allowed = agreed && p?.student.status === "active" && p.access.find((a) => a.channel === "placement")?.enabled;
  const drives = allowed ? (await getServiceRepo().drives()).filter((d) => d.status !== "closed") : [];
  const mine = new Map(p?.responses.map((r) => [r.drive_id, r]) ?? []);
  const resumes = allowed ? await createStudent360Repo(getServiceStore()).resumes(s.studentId) : [];
  const def = resumes.find((r) => r.is_default)?.id ?? resumes[0]?.id;

  return (
    <>
      <PageHeader title="Placement drives" subtitle="Tell us if you want to be considered — your “Yes” goes straight to the placement team's sheet." />
      {sp.saved === "yes" && <div role="status" className="mb-4 rounded-[5px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Saved — you&apos;re marked as interested and shared with the placement team.</div>}
      {sp.saved === "no" && <div role="status" className="mb-4 rounded-[5px] border border-line bg-slate-50 p-3 text-sm">Saved — you&apos;re marked as not interested in that drive.</div>}
      {typeof sp.error === "string" && MESSAGES[sp.error] && <div role="alert" className="mb-4 rounded-[5px] border border-red-200 bg-red-50 p-3 text-sm text-red-800">{MESSAGES[sp.error]}</div>}
      {!allowed ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <Lock size={18} />
          {agreed ? "Placement applications are blocked for your account. Please contact the admin office." : <span>Your placement profile is not active yet. <Link href="/portal/agreement" className="font-medium underline">Accept the Placement Terms &amp; Conditions</Link> to apply for drives.</span>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drives.map((d) => {
            const r = mine.get(d.id);
            return (
              <div key={d.id} id={`drive-${d.id}`} className="scroll-mt-24">
              <Card title={d.company} actions={<StatusBadge status={d.status} />}>
                <div className="font-medium">{d.job_role}</div>
                <div className="mt-1 text-sm text-muted">{[d.location, d.drive_date && fmtDate(d.drive_date), d.interview_mode].filter(Boolean).join(" · ")}</div>
                <div className="mt-1 text-sm">CTC: {d.ctc ?? "—"}</div>
                <div className="mt-1 text-xs text-muted">Eligibility: {d.eligibility ?? "—"}</div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {d.status === "open" ? (
                    <>
                      <form action={respondAction.bind(null, d.id, "yes")} className="flex flex-wrap items-center gap-2">
                        {resumes.length > 0 && (
                          <select name="resume_id" defaultValue={r?.resume_id ?? def} aria-label="Resume to send" className="input w-auto py-1 text-xs">
                            {resumes.map((x) => <option key={x.id} value={x.id}>{x.title} ({x.version})</option>)}
                          </select>
                        )}
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
                    {r.resume_id && <> · Resume: <b>{resumes.find((x) => x.id === r.resume_id)?.title ?? "—"}</b></>}
                  </div>
                )}
                {d.status === "open" && !resumes.length && <div className="mt-2 text-[11px] text-muted"><Link href="/portal/resumes" className="underline">Add a resume</Link> to choose which one is sent.</div>}
              </Card>
              </div>
            );
          })}
          {!drives.length && <p className="text-sm text-muted">No drives right now.</p>}
        </div>
      )}
    </>
  );
}
