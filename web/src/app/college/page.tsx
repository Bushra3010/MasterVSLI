import { Briefcase, Download, FileText, GraduationCap, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { learningSummary } from "@/components/learning-view";
import { Badge, Card, PageHeader, Progress, Stat, StatusBadge } from "@/components/ui";
import { daysBetween, fmtDate, todayISO } from "@/lib/format";
import { getServiceRepo } from "@/lib/server";
import { requireCollege } from "@/lib/session";
import type { Assessment, CampusDrive, College, CourseModule, ModuleProgress, Mou } from "@/lib/types";

export const metadata = { title: "College portal" };

/** TPO view: only this college's students, their training progress, assessments, drives and MoUs. */
export default async function CollegePortal({ searchParams }: PageProps<"/college">) {
  const s = await requireCollege();
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";
  const repo = getServiceRepo(); // scoped below to s.collegeId only
  const [college, all, drives, mous, mods, prog, tests, responses, placementDrives] = await Promise.all([
    repo.one<College>("colleges", s.collegeId),
    repo.students(),
    repo.list<CampusDrive>("campus_drives", { eq: { college_id: s.collegeId }, order: { column: "drive_date", ascending: false } }),
    repo.list<Mou>("mous", { eq: { college_id: s.collegeId } }),
    repo.list<CourseModule>("course_modules"),
    repo.list<ModuleProgress>("module_progress"),
    repo.list<Assessment>("assessments", { order: { column: "taken_on", ascending: false } }),
    repo.responses(),
    repo.drives(),
  ]);
  const students = all.filter((x) => x.college_id === s.collegeId);
  const ids = new Set(students.map((x) => x.id));
  const sum = new Map(students.map((x) => [x.id, learningSummary(mods.filter((m) => m.course_id === x.course_id), prog.filter((p) => p.student_id === x.id))]));
  const offers = responses.filter((r) => ids.has(r.student_id) && ["Offered", "Joined"].includes(r.stage ?? ""));

  return (
    <>
      <PageHeader title={college?.name ?? "College portal"} subtitle={`${[college?.city, college?.state].filter(Boolean).join(", ")} · College partner portal (powered by MasterVLSI)`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Students registered" value={students.length} icon={<Users size={18} />} />
        <Stat label="In training" value={students.filter((x) => x.status === "active").length} tone="blue" icon={<GraduationCap size={18} />} />
        <Stat label="Completed" value={students.filter((x) => x.status === "completed").length} tone="green" />
        <Stat label="Campus drives" value={drives.length} tone="amber" icon={<Briefcase size={18} />} />
        <Stat label="Selected / offers" value={drives.reduce((a, d) => a + d.selected, 0) + offers.length} tone="green" icon={<Trophy size={18} />} />
      </div>

      {(tab === "overview" || tab === "students") && (
        <Card title={`Students & training progress (${students.length})`} className="mt-5" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>Course / batch</th><th className="w-40">Course progress</th><th>Attendance</th><th>Avg score</th><th>Status</th></tr></thead>
            <tbody>
              {students.map((x) => {
                const l = sum.get(x.id)!;
                return (
                  <tr key={x.id}>
                    <td className="font-medium text-navy">{x.full_name}<div className="text-[11px] text-muted">{x.enrollment_no}</div></td>
                    <td className="text-xs">{x.course_name}<div className="text-muted">{x.batch_name}</div></td>
                    <td><div className="flex items-center gap-2"><Progress value={l.coursePct} /><span className="text-xs">{l.coursePct}%</span></div></td>
                    <td className="tabular-nums">{x.attendance_pct}%</td>
                    <td className="tabular-nums">{l.overall ? `${l.overall}%` : "—"}</td>
                    <td><StatusBadge status={x.status} /></td>
                  </tr>
                );
              })}
              {!students.length && <tr><td colSpan={6} className="text-center text-muted">No students registered from your college yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "students" && (
        <Card title="Recent assessments" className="mt-5" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Student</th><th>Test</th><th>Marks</th></tr></thead>
            <tbody>
              {tests.filter((t) => ids.has(t.student_id)).slice(0, 30).map((t) => (
                <tr key={t.id}><td>{fmtDate(t.taken_on)}</td><td>{students.find((x) => x.id === t.student_id)?.full_name}</td><td className="text-xs">{t.title}</td><td className="tabular-nums">{t.marks} / {t.max_marks}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(tab === "overview" || tab === "drives") && (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Card title="Campus drives" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Company / role</th><th>Date</th><th>Registered</th><th>Shortlisted</th><th>Selected</th><th>Status</th></tr></thead>
              <tbody>
                {drives.map((d) => (
                  <tr key={d.id}><td className="font-medium">{d.company}<div className="text-[11px] text-muted">{d.job_role}</div></td><td>{fmtDate(d.drive_date)}</td><td>{d.registered}</td><td>{d.shortlisted}</td><td>{d.selected}</td><td className="capitalize">{d.status}</td></tr>
                ))}
                {!drives.length && <tr><td colSpan={6} className="text-center text-muted">No campus drives yet.</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="Placements through MasterVLSI drives" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Student</th><th>Company</th><th>Stage</th></tr></thead>
              <tbody>
                {responses.filter((r) => ids.has(r.student_id) && r.response === "yes").map((r) => {
                  const d = placementDrives.find((x) => x.id === r.drive_id);
                  return <tr key={`${r.drive_id}-${r.student_id}`}><td>{students.find((x) => x.id === r.student_id)?.full_name}</td><td>{d?.company} <span className="text-xs text-muted">{d?.job_role}</span></td><td><Badge tone={r.stage === "Offered" || r.stage === "Joined" ? "green" : "blue"}>{r.stage ?? "Applied"}</Badge></td></tr>;
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {(tab === "overview" || tab === "mou") && (
        <Card title="MoU & agreements" icon={<FileText size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>MoU no.</th><th>Type</th><th>Valid</th><th>Status</th><th>Document</th></tr></thead>
            <tbody>
              {mous.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs">{m.mou_no}</td><td>{m.agreement_type}</td>
                  <td>{fmtDate(m.start_date)} → {fmtDate(m.end_date)}{m.end_date && m.end_date >= todayISO() && <div className="text-[11px] text-muted">{daysBetween(todayISO(), m.end_date)} days left</div>}</td>
                  <td className="capitalize">{m.status}</td>
                  <td>{m.document_path ? <Link href={`/api/mou/${m.id}`} className="inline-flex items-center gap-1 text-xs text-brand hover:underline"><Download size={12} /> Signed copy</Link> : "—"}</td>
                </tr>
              ))}
              {!mous.length && <tr><td colSpan={5} className="text-center text-muted">No agreements yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
