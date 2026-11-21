import { CheckCircle2, Circle, Lock, PlayCircle, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Card, Progress, Stat } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { Assessment, CourseModule, ModuleProgress } from "@/lib/types";

export function learningSummary(mods: CourseModule[], prog: ModuleProgress[]) {
  const rows = mods
    .sort((a, b) => a.seq - b.seq)
    .map((m) => {
      const p = prog.find((x) => x.module_id === m.id);
      const done = Math.min(m.total_videos, p?.videos_done ?? 0);
      const pct = m.total_videos ? Math.round((100 * done) / m.total_videos) : 0;
      const status = pct >= 100 ? "completed" : done > 0 ? "in_progress" : "not_started";
      const score = p?.test_score != null && p?.test_max ? Math.round((100 * Number(p.test_score)) / Number(p.test_max)) : null;
      return { m, p, done, pct, status, score };
    });
  const total = rows.reduce((a, r) => a + r.m.total_videos, 0);
  const done = rows.reduce((a, r) => a + r.done, 0);
  const scored = rows.filter((r) => r.score !== null);
  return {
    rows,
    total,
    done,
    videoPct: total ? Math.round((100 * done) / total) : 0,
    coursePct: rows.length ? Math.round(rows.reduce((a, r) => a + r.pct, 0) / rows.length) : 0,
    overall: scored.length ? Math.round(scored.reduce((a, r) => a + r.score!, 0) / scored.length) : 0,
    completed: rows.filter((r) => r.status === "completed").length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    notStarted: rows.filter((r) => r.status === "not_started").length,
  };
}

const statusBadge = (s: string) =>
  s === "completed" ? <Badge tone="green"><CheckCircle2 size={11} /> Completed</Badge> : s === "in_progress" ? <Badge tone="blue"><PlayCircle size={11} /> In progress</Badge> : <Badge><Lock size={11} /> Not started</Badge>;

/** Module-wise learning progress, video status and test scores (shared by admin and student views). */
export function LearningView({ mods, prog, tests, editor }: { mods: CourseModule[]; prog: ModuleProgress[]; tests: Assessment[]; editor?: (moduleId: string, p?: ModuleProgress) => ReactNode }) {
  const s = learningSummary(mods, prog);
  const name = new Map(mods.map((m) => [m.id, m.name]));
  const next = s.rows.filter((r) => r.status !== "completed").slice(0, 4);
  if (!mods.length) return <p className="text-sm text-muted">No modules are set up for this course yet (Courses &amp; batches › Modules).</p>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Modules" value={mods.length} />
        <Stat label="Total videos" value={s.total} tone="amber" />
        <Stat label="Completed" value={s.done} tone="green" />
        <Stat label="Pending" value={s.total - s.done} tone="blue" />
        <Stat label="Overall score" value={`${s.overall}%`} tone="amber" icon={<Trophy size={16} />} />
        <Stat label="Video progress" value={`${s.videoPct}%`} tone="green" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Module-wise Learning Progress, Video Status & Test Scores" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>#</th><th>Module / topic</th><th>Videos</th><th>Done</th><th className="w-40">Video progress</th><th>Status</th><th>Test score</th>{editor && <th>Update</th>}</tr></thead>
            <tbody>
              {s.rows.map((r) => (
                <tr key={r.m.id}>
                  <td>{r.m.seq}</td>
                  <td className="font-medium text-navy">{r.m.name}</td>
                  <td>{r.m.total_videos}</td>
                  <td>{r.done}</td>
                  <td><div className="flex items-center gap-2"><Progress value={r.pct} tone={r.pct >= 100 ? "green" : "amber"} /><span className="text-xs tabular-nums">{r.pct}%</span></div></td>
                  <td>{statusBadge(r.status)}</td>
                  <td className="whitespace-nowrap tabular-nums">{r.score !== null ? `${r.p!.test_score} / ${r.p!.test_max} (${r.score}%)` : "—"}</td>
                  {editor && <td>{editor(r.m.id, r.p)}</td>}
                </tr>
              ))}
              <tr className="bg-amber-50 font-medium">
                <td /><td>Total</td><td>{s.total}</td><td>{s.done}</td>
                <td><div className="flex items-center gap-2"><Progress value={s.videoPct} /><span className="text-xs">{s.videoPct}%</span></div></td>
                <td colSpan={editor ? 3 : 2}>{s.coursePct}% course progress</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <div className="space-y-5">
          <Card title="Overall Learning Progress">
            <div className="flex items-center gap-5">
              <div className="grid size-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#16a34a ${s.coursePct * 3.6}deg, #e9edf4 0deg)` }}>
                <div className="grid size-20 place-items-center rounded-full bg-white text-center"><div><div className="text-lg font-medium text-navy">{s.coursePct}%</div><div className="text-[10px] text-muted">Course progress</div></div></div>
              </div>
              <ul className="space-y-1.5 text-[13px]">
                <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" /> {s.completed} modules completed</li>
                <li className="flex items-center gap-2"><PlayCircle size={15} className="text-brand" /> {s.inProgress} in progress</li>
                <li className="flex items-center gap-2"><Lock size={15} className="text-muted" /> {s.notStarted} not started</li>
                <li className="mt-2 text-xl font-medium text-orange-600">{s.overall}% <span className="text-xs font-normal text-muted">overall score</span></li>
              </ul>
            </div>
          </Card>
          <Card title="Recent Tests & Assessments" bodyClass="p-0 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Date</th><th>Test</th><th>Marks</th><th>Result</th></tr></thead>
              <tbody>
                {tests.slice(0, 6).map((t) => {
                  const pct = Math.round((100 * Number(t.marks)) / Number(t.max_marks));
                  return <tr key={t.id}><td className="whitespace-nowrap">{fmtDate(t.taken_on)}</td><td className="text-xs">{t.title || name.get(t.module_id ?? "")}</td><td className="tabular-nums">{t.marks} / {t.max_marks}</td><td><Badge tone={pct >= 60 ? "green" : "red"}>{pct >= 60 ? "Pass" : "Retry"} {pct}%</Badge></td></tr>;
                })}
                {!tests.length && <tr><td colSpan={4} className="text-center text-muted">No tests yet.</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title="Next Activities">
            <ul className="space-y-2 text-[13px]">
              {next.map((r) => (
                <li key={r.m.id} className="flex items-center gap-2">
                  {r.status === "in_progress" ? <PlayCircle size={15} className="text-brand" /> : <Circle size={15} className="text-muted" />}
                  {r.status === "in_progress" ? `Continue ${r.m.name} – ${r.m.total_videos - r.done} videos left` : `Start ${r.m.name} – ${r.m.total_videos} videos`}
                </li>
              ))}
              {!next.length && <li className="text-emerald-700">All modules complete 🎉</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Learning Path & Status">
        <ol className="flex flex-wrap items-start gap-y-4">
          {s.rows.map((r, k) => (
            <li key={r.m.id} className="flex flex-1 basis-20 flex-col items-center text-center text-[11px]">
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${k ? (r.status === "not_started" ? "bg-slate-200" : "bg-emerald-400") : "bg-transparent"}`} />
                <span className={`grid size-7 place-items-center rounded-full text-white ${r.status === "completed" ? "bg-emerald-500" : r.status === "in_progress" ? "bg-brand" : "bg-slate-300"}`}>
                  {r.status === "completed" ? <CheckCircle2 size={14} /> : r.status === "in_progress" ? <PlayCircle size={14} /> : <Lock size={12} />}
                </span>
                <span className={`h-0.5 flex-1 ${k < s.rows.length - 1 ? (s.rows[k + 1].status === "not_started" ? "bg-slate-200" : "bg-emerald-400") : "bg-transparent"}`} />
              </div>
              <span className="mt-1 px-1 text-[#515b73]">{r.m.name}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
