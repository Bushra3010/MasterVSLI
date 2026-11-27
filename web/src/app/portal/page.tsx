import { AlertTriangle, Bell, Briefcase, CalendarClock, ListChecks } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { noticeText } from "@/lib/notify";
import { ProfilePhoto } from "@/components/profile-photo";
import { ActionList, ActionStrip, Kpi } from "@/components/student360";
import { Badge, Card, Progress, StatusBadge } from "@/components/ui";
import { daysBetween, fmtDate, inr, istDateTime, todayISO } from "@/lib/format";
import { getServiceRepo, getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import { getStudent360, isAlumni } from "@/lib/student360";
import type { CourseModule, ModuleProgress } from "@/lib/types";

export const metadata = { title: "My dashboard" };

const CATEGORY: Record<string, string> = { normal: "Normal Student", college: "College Student", corporate: "Corporate Student" };

export default async function PortalHome({ searchParams }: PageProps<"/portal">) {
  const sp = await searchParams;
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const { p, completion, actions, interviews, drives: allDrives } = d;
  const st = p.student;
  // After training validity ends, the Alumni Profile opens automatically until it is filled in.
  if (isAlumni(st) && !st.extra?.alumni?.updated_at) redirect("/portal/alumni?first=1");

  const repo = await getStudentReadRepo();
  const svc = getServiceRepo();
  const [notices, general, placement, mods, prog] = await Promise.all([
    repo.studentNotifications(s.studentId),
    svc.consentFor(s.studentId, "general"),
    svc.consentFor(s.studentId, "placement"),
    st.course_id ? repo.list<CourseModule>("course_modules", { eq: { course_id: st.course_id } }) : Promise.resolve([] as CourseModule[]),
    repo.list<ModuleProgress>("module_progress", { eq: { student_id: s.studentId } }),
  ]);
  const totalVideos = mods.reduce((a, m) => a + Number(m.total_videos), 0);
  const doneVideos = mods.reduce((a, m) => a + Math.min(Number(m.total_videos), Number(prog.find((x) => x.module_id === m.id)?.videos_done ?? 0)), 0);
  const learning = totalVideos ? Math.round((doneVideos / totalVideos) * 100) : 0;
  const today = todayISO();
  const drives = allDrives.filter((x) => x.status !== "closed" && (!x.drive_date || x.drive_date >= today)).sort((a, b) => (a.drive_date ?? "9999").localeCompare(b.drive_date ?? "9999")).slice(0, 6);
  const upcoming = interviews.filter((i) => i.status === "scheduled" && i.scheduled_at.slice(0, 10) >= today);
  const missed = interviews.filter((i) => i.status === "missed");
  const left = st.validity_end ? daysBetween(today, st.validity_end) : null;
  const photo = p.documents.find((x) => x.kind === "photo");
  const sections = [...new Set(completion.checks.map((c) => c.section))];

  return (
    <>
      <section className="mb-5 rounded-[5px] border border-line bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <ProfilePhoto src={photo ? `/api/documents/${photo.id}` : null} name={st.full_name} className="size-16 rounded-[6px] border border-line" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-navy">{st.full_name}</h1>
            <div className="text-xs text-muted"><span className="font-mono">{st.enrollment_no}</span> · {p.course?.name ?? "Course"}{p.batch ? ` · ${p.batch.name}` : ""}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge status={st.status} />
              <Badge tone="blue">{CATEGORY[st.category ?? "normal"]}</Badge>
              {isAlumni(st) && <Badge tone="green">Alumni</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/portal/profile" className="btn-ghost">Update profile</Link>
            {isAlumni(st) && <Link href="/portal/alumni" className="btn-ghost">Alumni Profile</Link>}
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-navy">{`Profile completion: ${completion.pct}%`}</span><span className="text-muted">{completion.done} of {completion.total} required details</span></div>
          <Progress value={completion.pct} />
        </div>
        {st.validity_end && <div className="mt-2 text-[11px] text-muted">Validity: {fmtDate(st.admission_date)} to {fmtDate(st.validity_end)}</div>}
      </section>
      <ActionStrip items={actions} />

      {general.required && (
        <Link href="/portal/terms" className="mb-5 flex items-center justify-between gap-3 rounded-[5px] border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <span><b>Action needed:</b> please read and accept the MasterVLSI Terms &amp; Conditions.</span><span className="btn-primary">Review &amp; accept</span>
        </Link>
      )}
      {placement.required && (
        <Link href="/portal/agreement" className="mb-5 flex items-center justify-between gap-3 rounded-[5px] border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          <span>Your <b>Placement Profile is not active</b>. Accept the placement terms to apply for company drives and join the placement group.</span><span className="btn bg-orange-500 text-white">Activate</span>
        </Link>
      )}
      {st.status !== "active" && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="shrink-0" size={18} />
          Your account is <b>{st.status.replace("_", " ")}</b>. Zoom, recorded classes, biometric entry, placement applications and
          training materials are paused until the institute re-activates or renews your access.
        </div>
      )}
      {sp.paid && (
        <div className="mb-5 rounded-[5px] border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Thank you! Your payment is being confirmed. The receipt appears under Fees &amp; Payments within a minute.
        </div>
      )}

      <div className="mb-1 text-[11px] text-muted">Student Management / Overview / Dashboard</div>
      <h2 className="mb-3 text-lg font-semibold text-navy">Overview</h2>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Profile completion" value={`${completion.pct}%`} tone={completion.pct < 100 ? "amber" : "green"} />
        <Kpi label="Pending activities" value={actions.length} tone={actions.length ? "red" : "green"} />
        <Kpi label="Upcoming interviews" value={upcoming.length} />
        <Kpi label="Missed interviews" value={missed.length} tone={missed.length ? "red" : undefined} />
        <Kpi label="Last attendance" value={d.lastAttendance ? fmtDate(d.lastAttendance) : "—"} />
        <Kpi label="Outstanding fee" value={inr(Math.max(0, p.fee.balance))} tone={p.fee.balance > 0 ? "amber" : "green"} />
        <Kpi label="Learning progress" value={`${learning}%`} />
        <Kpi label="Training expiry" value={st.validity_end ? fmtDate(st.validity_end) : "—"} tone={left !== null && left <= 30 ? "amber" : undefined} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card title={`My pending activities (${actions.length})`} icon={<ListChecks size={15} />} className="scroll-mt-20" bodyClass="p-3">
          <div id="actions" className="scroll-mt-24" />
          <ActionList items={actions} back="/portal" />
        </Card>
        <div className="space-y-5">
          <Card title="Profile completion" bodyClass="p-3">
            <ul className="space-y-1.5 text-[13px]">
              {sections.map((sec) => {
                const cs = completion.checks.filter((c) => c.section === sec);
                const ok = cs.filter((c) => c.ok).length;
                const miss = cs.find((c) => !c.ok);
                return (
                  <li key={sec} className="flex items-center justify-between gap-2">
                    <span>{sec}</span>
                    {miss ? <Link href={miss.href} className="text-xs font-medium text-amber-700 underline">{ok}/{cs.length} · complete</Link> : <Badge tone="green">Done</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title="Upcoming interviews" icon={<CalendarClock size={15} />} actions={<Link href="/portal/interviews" className="text-xs underline">All interviews →</Link>} bodyClass="p-3">
            {upcoming.length ? (
              <ul className="space-y-2 text-[13px]">
                {upcoming.slice(0, 4).map((i) => (
                  <li key={i.id} className="flex justify-between gap-2"><span><b>{i.company}</b>{i.round ? ` · ${i.round}` : ""}</span><span className="shrink-0 text-xs text-muted">{istDateTime(i.scheduled_at)}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No interviews scheduled.</p>}
          </Card>
          {notices.length > 0 && (
            <Card title="Notifications" icon={<Bell size={15} />} bodyClass="p-3">
              <ul className="space-y-2 text-sm">
                {notices.slice(0, 5).map((n) => (
                  <li key={n.id} className="flex justify-between gap-3">
                    <span>{noticeText(n.kind, st.full_name, st.validity_end).subject}</span>
                    <span className="shrink-0 text-xs text-muted">{fmtDate(n.created_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {drives.length > 0 && (
        <Card title="Upcoming company drives" icon={<Briefcase size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto" actions={<Link href="/portal/drives" className="text-xs underline">Respond to drives →</Link>}>
          <table className="table">
            <thead><tr><th>Date</th><th>Company</th><th>Role</th><th>Location · mode</th><th>Status</th><th>My answer</th></tr></thead>
            <tbody>
              {drives.map((x) => {
                const mine = p.responses.find((r) => r.drive_id === x.id);
                return (
                  <tr key={x.id}>
                    <td className="whitespace-nowrap">{x.drive_date ? fmtDate(x.drive_date) : "Date TBA"}{x.drive_date && <div className="text-[11px] text-muted">in {daysBetween(today, x.drive_date)} days</div>}</td>
                    <td className="font-medium">{x.company}</td>
                    <td>{x.job_role}{x.ctc && <div className="text-[11px] text-muted">CTC {x.ctc}</div>}</td>
                    <td className="text-xs">{[x.location, x.interview_mode].filter(Boolean).join(" · ") || "—"}</td>
                    <td><StatusBadge status={x.status} /></td>
                    <td>{mine && mine.response !== "pending" ? <StatusBadge status={mine.response} /> : x.status === "open" ? <Link href="/portal/drives" className="text-xs font-medium text-navy underline">Answer now</Link> : <span className="text-xs text-muted">Opens soon</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
