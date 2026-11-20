import { BookOpen, Layers, ListChecks } from "lucide-react";
import { I, Row, Save } from "@/components/form-bits";
import { Card, PageHeader, Progress, Stat } from "@/components/ui";
import { addMonths, daysBetween, fmtDate, inr, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { saveBatchAction, saveCourseAction } from "../actions";
import { saveSyllabusAction } from "../module-actions";

export const metadata = { title: "Courses & batches" };

export default async function CoursesPage() {
  const repo = await getRepo();
  const [courses, batches, students] = await Promise.all([repo.courses(), repo.batches(), repo.students()]);
  const today = todayISO();

  const courseSel = (v?: string) => (
    <select name="course_id" defaultValue={v ?? courses[0]?.id} aria-label="Course" required className="input w-auto py-1.5">
      {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
    </select>
  );
  const modeSel = (v?: string) => (
    <select name="mode" defaultValue={v ?? "hybrid"} aria-label="Mode" className="input w-auto py-1.5">
      <option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option>
    </select>
  );

  const progress = batches.map((b) => {
    const c = courses.find((x) => x.id === b.course_id);
    const mine = students.filter((s) => s.batch_id === b.id);
    const end = b.start_date && c ? addMonths(b.start_date, c.duration_months) : null;
    const span = b.start_date && end ? daysBetween(b.start_date, end) : 0;
    const done = b.start_date && span ? Math.min(100, Math.max(0, Math.round((100 * daysBetween(b.start_date, today)) / span))) : 0;
    const active = mine.filter((s) => s.status === "active");
    const att = active.length ? Math.round(active.reduce((a, s) => a + s.attendance_pct, 0) / active.length) : 0;
    return { b, c, end, done, count: mine.length, active: active.length, att };
  });

  return (
    <>
      <PageHeader title="Courses & batches" subtitle="Courses, syllabus, batches and how far each batch has progressed." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Courses" value={courses.length} />
        <Stat label="Batches" value={batches.length} tone="blue" />
        <Stat label="Running batches" value={progress.filter((p) => p.done > 0 && p.done < 100).length} tone="green" />
        <Stat label="Students in batches" value={students.filter((s) => s.batch_id).length} tone="amber" />
      </div>

      <Card title="Batch progress" icon={<ListChecks size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Batch</th><th>Course</th><th>Mode</th><th>Start → end</th><th className="w-48">Progress</th><th>Students</th><th>Avg attendance</th></tr></thead>
          <tbody>
            {progress.map(({ b, c, end, done, count, active, att }) => (
              <tr key={b.id}>
                <td className="font-medium">{b.name}</td>
                <td>{c?.code}</td>
                <td className="capitalize">{b.mode}</td>
                <td className="text-xs">{fmtDate(b.start_date)} → {fmtDate(end)}</td>
                <td>
                  <div className="flex items-center gap-2"><Progress value={done} tone={done >= 100 ? "green" : "amber"} /><span className="text-xs tabular-nums">{done}%</span></div>
                </td>
                <td className="tabular-nums">{active} active <span className="text-muted">/ {count}</span></td>
                <td className="tabular-nums">{active ? `${att}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-5 grid gap-5 2xl:grid-cols-2">
        <Card title="Courses" icon={<BookOpen size={15} />}>
          <div className="mb-1 grid grid-cols-[5rem_1fr_5rem_5rem_7rem_auto] gap-2 text-[11px] font-medium text-muted max-sm:hidden">
            <span>Code</span><span>Name</span><span>Months</span><span>Valid (m)</span><span>Fee (₹)</span><span />
          </div>
          {courses.map((c) => (
            <Row key={c.id} action={saveCourseAction}>
              <input type="hidden" name="id" value={c.id} />
              <I name="code" value={c.code} w="w-20" required placeholder="Code" />
              <I name="name" value={c.name} w="min-w-40 flex-1" required placeholder="Course name" />
              <I name="duration_months" type="number" value={c.duration_months} w="w-20" placeholder="Months" />
              <I name="validity_months" type="number" value={c.validity_months} w="w-20" placeholder="Valid months" />
              <I name="fee" type="number" value={c.fee} w="w-28" placeholder="Fee" />
              <Save />
            </Row>
          ))}
          <Row action={saveCourseAction}>
            <I name="code" w="w-20" required placeholder="Code" />
            <I name="name" w="min-w-40 flex-1" required placeholder="New course name" />
            <I name="duration_months" type="number" value={6} w="w-20" placeholder="Months" />
            <I name="validity_months" type="number" value={12} w="w-20" placeholder="Valid months" />
            <I name="fee" type="number" w="w-28" required placeholder="Fee" />
            <Save label="+ Add" />
          </Row>
        </Card>

        <Card title="Batches" icon={<Layers size={15} />}>
          {batches.map((b) => (
            <Row key={b.id} action={saveBatchAction}>
              <input type="hidden" name="id" value={b.id} />
              {courseSel(b.course_id)}
              <I name="name" value={b.name} w="min-w-40 flex-1" required placeholder="Batch name" />
              {modeSel(b.mode)}
              <I name="start_date" type="date" value={b.start_date} w="w-40" placeholder="Start date" />
              <Save />
            </Row>
          ))}
          <Row action={saveBatchAction}>
            {courseSel()}
            <I name="name" w="min-w-40 flex-1" required placeholder="New batch, e.g. DV-Online-Mar26" />
            {modeSel()}
            <I name="start_date" type="date" w="w-40" placeholder="Start date" />
            <Save label="+ Add" />
          </Row>
        </Card>
      </div>

      <Card title="Syllabus" icon={<ListChecks size={15} />} className="mt-5">
        <p className="mb-3 text-xs text-muted">One module per line (or separated by “;”). Shown here and used as the course outline.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {courses.map((c) => {
            const modules = (c.syllabus ?? "").split(/\n|;/).map((x) => x.trim()).filter(Boolean);
            return (
              <form key={c.id} action={saveSyllabusAction} className="rounded-lg border border-line p-3">
                <input type="hidden" name="id" value={c.id} />
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.code} · {c.name}</div>
                    <div className="text-xs text-muted">{c.duration_months} months · {inr(c.fee)} · {modules.length} modules</div>
                  </div>
                  <Save />
                </div>
                <textarea name="syllabus" defaultValue={modules.join("\n")} rows={Math.max(4, modules.length + 1)} aria-label={`${c.code} syllabus`} placeholder="Module 1&#10;Module 2" className="input font-mono text-xs" />
              </form>
            );
          })}
        </div>
      </Card>
    </>
  );
}
