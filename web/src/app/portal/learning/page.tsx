import { LearningView } from "@/components/learning-view";
import { PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import type { Assessment, CourseModule, ModuleProgress } from "@/lib/types";

export const metadata = { title: "My learning" };

export default async function PortalLearning() {
  const s = await requireStudent();
  const repo = await getStudentReadRepo();
  const p = await repo.profile(s.studentId);
  const [mods, prog, tests] = await Promise.all([
    repo.list<CourseModule>("course_modules", { eq: { course_id: p?.student.course_id ?? "" } }),
    repo.list<ModuleProgress>("module_progress", { eq: { student_id: s.studentId } }),
    repo.list<Assessment>("assessments", { eq: { student_id: s.studentId }, order: { column: "taken_on", ascending: false } }),
  ]);
  return (
    <>
      <PageHeader title="Student Learning & Assessment" subtitle={`${p?.course?.name ?? "Course"} · ${p?.batch?.name ?? ""} · valid until ${fmtDate(p?.student.validity_end)}`} />
      <LearningView mods={mods} prog={prog} tests={tests} />
    </>
  );
}
