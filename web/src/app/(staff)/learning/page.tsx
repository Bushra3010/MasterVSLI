import Link from "next/link";
import { I, Row, Save } from "@/components/form-bits";
import { LearningView, learningSummary } from "@/components/learning-view";
import { Card, PageHeader, Progress } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getRepo } from "@/lib/server";
import type { Assessment, CourseModule, ModuleProgress } from "@/lib/types";
import { deleteRowAction, saveProgressAction, saveRowAction } from "../crm-actions";

export const metadata = { title: "Learning & assessments" };

export default async function LearningPage({ searchParams }: PageProps<"/learning">) {
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "student";
  const repo = await getRepo();
  const [students, batches, courses, mods, prog, tests] = await Promise.all([
    repo.students(),
    repo.batches(),
    repo.courses(),
    repo.list<CourseModule>("course_modules", { order: { column: "seq" } }),
    repo.list<ModuleProgress>("module_progress"),
    repo.list<Assessment>("assessments", { order: { column: "taken_on", ascending: false } }),
  ]);
  const batch = typeof sp.batch === "string" ? sp.batch : "";
  const pool = students.filter((s) => !batch || s.batch_id === batch);
  const sel = students.find((s) => s.id === sp.student) ?? pool[0];
  const myMods = mods.filter((m) => m.course_id === sel?.course_id);
  const myProg = prog.filter((p) => p.student_id === sel?.id);

  return (
    <>
      <PageHeader title="Student Learning & Assessment" subtitle="Track learning progress, video completion, module tests and scores for every student." />
      <nav className="mb-4 flex gap-4 border-b border-line text-[13px]">
        {[["student", "Activity Learning"], ["batch", "Progress Tracker (batch)"], ["modules", "Modules setup"]].map(([k, l]) => (
          <Link key={k} href={`/learning?tab=${k}${batch ? `&batch=${batch}` : ""}`} className={`-mb-px border-b-2 pb-2 ${tab === k ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-brand"}`}>{l}</Link>
        ))}
      </nav>

      {tab !== "modules" && (
        <form className="mb-4 flex flex-wrap gap-2">
          <input type="hidden" name="tab" value={tab} />
          <select name="batch" defaultValue={batch} aria-label="Batch" className="input w-auto"><option value="">All batches</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          {tab === "student" && <select name="student" defaultValue={sel?.id} aria-label="Student" className="input w-auto">{pool.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.enrollment_no})</option>)}</select>}
          <button className="btn-ghost">Show</button>
        </form>
      )}

      {tab === "student" && sel && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-[5px] border border-line bg-white p-4 text-[13px]">
            <span className="grid size-12 place-items-center rounded-full bg-orange-100 text-base font-medium text-orange-700">{sel.full_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}</span>
            <div><div className="text-base font-medium text-navy">{sel.full_name}</div><div className="text-muted">ID {sel.enrollment_no} · {sel.batch_name ?? "—"}</div></div>
            <div className="ml-auto text-muted">Course <b className="text-navy">{sel.course_name}</b> · Joined {fmtDate(sel.admission_date)} · Valid till {fmtDate(sel.validity_end)}</div>
          </div>
          <LearningView
            mods={myMods}
            prog={myProg}
            tests={tests.filter((t) => t.student_id === sel.id)}
            editor={(moduleId, p) => (
              <form action={saveProgressAction.bind(null, sel.id, moduleId)} className="flex items-center gap-1">
                <input name="videos_done" type="number" min={0} defaultValue={p?.videos_done ?? 0} aria-label="Videos done" title="Videos done" className="input w-14 py-1" />
                <input name="test_score" type="number" min={0} step="0.5" defaultValue={p?.test_score ?? ""} placeholder="score" aria-label="Test score" className="input w-14 py-1" />
                <input name="test_max" type="number" min={1} defaultValue={p?.test_max ?? 50} aria-label="Max marks" className="input w-12 py-1" />
                <button className="btn-navy py-1 text-[11px]">Save</button>
              </form>
            )}
          />
        </>
      )}

      {tab === "batch" && (
        <Card title="Progress tracker" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>Batch</th><th className="w-44">Course progress</th><th>Videos</th><th>Modules done</th><th>Overall score</th></tr></thead>
            <tbody>
              {pool.map((s) => {
                const sum = learningSummary(mods.filter((m) => m.course_id === s.course_id), prog.filter((p) => p.student_id === s.id));
                return (
                  <tr key={s.id}>
                    <td><Link href={`/learning?tab=student&student=${s.id}`} className="font-medium text-navy hover:text-brand">{s.full_name}</Link></td>
                    <td>{s.batch_name}</td>
                    <td><div className="flex items-center gap-2"><Progress value={sum.coursePct} /><span className="text-xs">{sum.coursePct}%</span></div></td>
                    <td className="tabular-nums">{sum.done} / {sum.total}</td>
                    <td>{sum.completed} / {sum.rows.length}</td>
                    <td className="tabular-nums">{sum.overall}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "modules" && (
        <div className="grid gap-5 xl:grid-cols-2">
          {courses.map((c) => (
            <Card key={c.id} title={`${c.code} · ${c.name}`}>
              {mods.filter((m) => m.course_id === c.id).map((m) => (
                <Row key={m.id} action={saveRowAction.bind(null, "course_modules")}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="course_id" value={c.id} />
                  <I name="seq" type="number" value={m.seq} w="w-14" placeholder="#" />
                  <I name="name" value={m.name} required w="min-w-40 flex-1" placeholder="Module" />
                  <I name="total_videos" type="number" value={m.total_videos} w="w-20" placeholder="Videos" />
                  <Save />
                  <button formAction={deleteRowAction.bind(null, "course_modules", m.id)} className="text-xs text-muted hover:text-brand">Delete</button>
                </Row>
              ))}
              <Row action={saveRowAction.bind(null, "course_modules")}>
                <input type="hidden" name="course_id" value={c.id} />
                <I name="seq" type="number" value={mods.filter((m) => m.course_id === c.id).length + 1} w="w-14" placeholder="#" />
                <I name="name" required w="min-w-40 flex-1" placeholder="New module, e.g. AXI Protocol" />
                <I name="total_videos" type="number" value={10} w="w-20" placeholder="Videos" />
                <Save label="+ Add" />
              </Row>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
