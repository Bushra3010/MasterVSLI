import { LearningView } from "@/components/learning-view";
import { PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import type { Assessment, AssignmentRow, CourseModule, ModuleProgress, Submission } from "@/lib/types";
import { Badge, Card } from "@/components/ui";
import { submitAssignmentAction } from "../actions";

export const metadata = { title: "My learning" };

export default async function PortalLearning() {
  const s = await requireStudent();
  const repo = await getStudentReadRepo();
  const p = await repo.profile(s.studentId);
  const [assignments, subs] = await Promise.all([
    repo.list<AssignmentRow>("assignments", { eq: { course_id: p?.student.course_id ?? "" }, order: { column: "due_date" } }),
    repo.list<Submission>("assignment_submissions", { eq: { student_id: s.studentId } }),
  ]);
  const [mods, prog, tests] = await Promise.all([
    repo.list<CourseModule>("course_modules", { eq: { course_id: p?.student.course_id ?? "" } }),
    repo.list<ModuleProgress>("module_progress", { eq: { student_id: s.studentId } }),
    repo.list<Assessment>("assessments", { eq: { student_id: s.studentId }, order: { column: "taken_on", ascending: false } }),
  ]);
  return (
    <>
      <PageHeader title="Student Learning & Assessment" subtitle={`${p?.course?.name ?? "Course"} · ${p?.batch?.name ?? ""} · valid until ${fmtDate(p?.student.validity_end)}`} />
      <LearningView mods={mods} prog={prog} tests={tests} />
      <Card title={`Assignments (${assignments.length})`} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Assignment</th><th>Due</th><th>Max</th><th>Status / marks</th><th>Submit</th></tr></thead>
          <tbody>
            {assignments.map((a) => {
              const sub = subs.find((x) => x.assignment_id === a.id);
              return (
                <tr key={a.id}>
                  <td className="font-medium text-navy">{a.title}<div className="text-[11px] font-normal text-muted">{a.instructions}</div></td>
                  <td className="whitespace-nowrap">{fmtDate(a.due_date)}</td>
                  <td>{a.max_marks}</td>
                  <td>{!sub ? <Badge tone="amber">Not submitted</Badge> : sub.status === "graded" ? <><Badge tone="green">{sub.marks} / {a.max_marks}</Badge><div className="text-[11px] text-muted">{sub.feedback}</div></> : sub.status === "resubmit" ? <><Badge tone="red">Resubmit</Badge><div className="text-[11px] text-muted">{sub.feedback}</div></> : <Badge tone="blue">Submitted</Badge>}</td>
                  <td>
                    {sub?.status !== "graded" && (
                      <form action={submitAssignmentAction.bind(null, a.id)} className="flex items-center gap-1">
                        <input name="link" type="url" required defaultValue={sub?.link ?? ""} placeholder="https://… link to your work" aria-label="Submission link" className="input w-56 py-1" />
                        <button className="btn-primary py-1 text-xs">{sub ? "Update" : "Submit"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {!assignments.length && <tr><td colSpan={5} className="text-center text-muted">No assignments yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
