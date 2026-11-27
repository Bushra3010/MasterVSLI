import Link from "next/link";
import { Badge, Card, Field, PageHeader, Progress } from "@/components/ui";
import { daysBetween, fmtDate, todayISO } from "@/lib/format";
import { getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import { getStudent360 } from "@/lib/student360";
import type { Assessment, CourseModule, ModuleProgress, Staff } from "@/lib/types";

export const metadata = { title: "Admission & training" };

export default async function PortalTraining() {
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const { p } = d;
  const st = p.student;
  const repo = await getStudentReadRepo();
  const [mods, prog, tests, handler] = await Promise.all([
    st.course_id ? repo.list<CourseModule>("course_modules", { eq: { course_id: st.course_id } }) : Promise.resolve([] as CourseModule[]),
    repo.list<ModuleProgress>("module_progress", { eq: { student_id: s.studentId } }),
    repo.list<Assessment>("assessments", { eq: { student_id: s.studentId } }),
    st.counsellor_id ? repo.list<Staff>("staff", { eq: { id: st.counsellor_id } }).then((r) => r[0]).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const modules = [...mods].sort((a, b) => a.seq - b.seq).map((m) => {
    const pr = prog.find((x) => x.module_id === m.id);
    const pct = m.total_videos ? Math.round((Math.min(m.total_videos, pr?.videos_done ?? 0) / m.total_videos) * 100) : 0;
    return { ...m, pct, score: pr?.test_score != null && pr.test_max ? `${pr.test_score}/${pr.test_max}` : null };
  });
  const overall = modules.length ? Math.round(modules.reduce((a, m) => a + m.pct, 0) / modules.length) : 0;
  const weak = modules.filter((m) => m.score && Number(m.score.split("/")[0]) / Number(m.score.split("/")[1]) < 0.6);
  const left = st.validity_end ? daysBetween(todayISO(), st.validity_end) : null;
  const pendingLearning = d.assignments.filter((a) => !d.learningSubs.some((x) => x.assignment_id === a.id && x.status !== "resubmit"));
  const before = st.extra?.before;

  return (
    <>
      <PageHeader title="Admission & Training" subtitle="Your admission, course and batch, learning progress, skill gaps and training validity." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Admission" bodyClass="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Student ID" value={<span className="font-mono">{st.enrollment_no}</span>} />
            <Field label="Admission date" value={fmtDate(st.admission_date)} />
            <Field label="Admission handled by" value={handler?.full_name ?? "MasterVLSI office"} />
            <Field label="Lead source" value={st.lead_source ?? "—"} />
            <Field label="Referred by" value={st.referred_by ?? "—"} />
            <Field label="Payment plan" value={st.payment_plan ?? "—"} />
          </div>
        </Card>
        <Card title="Course & batch" bodyClass="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Course" value={p.course?.name ?? "—"} />
            <Field label="Batch" value={p.batch?.name ?? "—"} />
            <Field label="Training mode" value={<span className="capitalize">{st.training_mode}</span>} />
            <Field label="Course duration" value={p.course ? `${p.course.duration_months} months` : "—"} />
          </div>
          <p className="mt-3 text-[11px] text-muted">Batch transfers are not available. Contact the office for any change.</p>
        </Card>
        <Card title="Validity & leave" bodyClass="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valid until" value={fmtDate(st.validity_end)} />
            <Field label="Days left" value={left === null ? "—" : left < 0 ? <Badge tone="red">Expired</Badge> : <Badge tone={left <= 30 ? "amber" : "green"}>{left} days</Badge>} />
            <Field label="Complementary months" value={st.extra?.complementary_months ?? 0} />
            <Field label="Validity type" value={st.extra?.validity_type === "extendable" ? "Extendable" : "Fixed"} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/portal/requests?kind=validity_extension" className="btn-ghost">Request validity extension</Link>
            <Link href="/portal/requests?kind=other" className="btn-ghost">Apply for leave</Link>
          </div>
        </Card>
        <Card title="Previous training & experience" bodyClass="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Working status" value={st.professional?.working_status ?? "—"} />
            <Field label="Company" value={st.professional?.company ?? "—"} />
            <Field label="Designation" value={before?.designation ?? "—"} />
            <Field label="Experience" value={st.professional?.total_exp ?? "—"} />
          </div>
        </Card>
      </div>

      <Card title={`Learning progress — ${overall}%`} className="mt-5" actions={<Link href="/portal/learning" className="text-xs underline">Open learning →</Link>} bodyClass="p-4">
        <Progress value={overall} />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {modules.map((m) => (
            <div key={m.id} className="rounded-[5px] border border-line p-2.5">
              <div className="flex justify-between text-[13px]"><span className="font-medium">{m.seq}. {m.name}</span><span className="tabular-nums">{m.pct}%</span></div>
              <div className="mt-1"><Progress value={m.pct} /></div>
              {m.score && <div className="mt-1 text-[11px] text-muted">Test: {m.score}</div>}
            </div>
          ))}
          {!modules.length && <p className="text-sm text-muted">Modules appear once your course is set up.</p>}
        </div>
      </Card>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Card title={`Assessments (${tests.length})`} bodyClass="p-3">
          <ul className="space-y-1 text-[13px]">
            {tests.slice(0, 6).map((t) => <li key={t.id} className="flex justify-between gap-2"><span>{t.title}</span><span className="tabular-nums">{t.marks}/{t.max_marks}</span></li>)}
            {!tests.length && <li className="text-muted">No assessments yet.</li>}
          </ul>
        </Card>
        <Card title="Skill gaps" bodyClass="p-3">
          {weak.length ? <ul className="space-y-1 text-[13px]">{weak.map((m) => <li key={m.id}>{m.name} <span className="text-xs text-red-600">({m.score})</span></li>)}</ul> : <p className="text-sm text-muted">No weak modules — great work.</p>}
        </Card>
        <Card title={`Projects & assignments pending (${pendingLearning.length})`} bodyClass="p-3">
          <ul className="space-y-1 text-[13px]">
            {pendingLearning.slice(0, 6).map((a) => <li key={a.id} className="flex justify-between gap-2"><span>{a.title}</span><span className="text-xs text-muted">{fmtDate(a.due_date)}</span></li>)}
            {!pendingLearning.length && <li className="text-muted">Nothing pending.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
