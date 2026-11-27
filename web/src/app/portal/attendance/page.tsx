import { Kpi } from "@/components/student360";
import { Card, PageHeader } from "@/components/ui";
import { daysBetween, fmtDate, istTime, todayISO } from "@/lib/format";
import { requireStudent } from "@/lib/session";
import { getStudent360 } from "@/lib/student360";
import { ATTENDANCE_GAP_DAYS } from "@/lib/types";

export const metadata = { title: "My attendance" };

const SOURCE: Record<string, string> = { biometric: "Biometric", zoom: "Zoom", teamviewer: "TeamViewer", manual: "Manual" };

export default async function PortalAttendance() {
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const { attendance } = d.p;
  const gap = d.lastAttendance ? daysBetween(d.lastAttendance, todayISO()) : null;

  return (
    <>
      <PageHeader title="Attendance" subtitle="Biometric, Zoom and TeamViewer sessions recorded for you. Holidays and approved leave are not counted as absences." />
      {(gap === null || gap > ATTENDANCE_GAP_DAYS) && d.p.student.status === "active" && (
        <div role="alert" className="mb-4 rounded-[5px] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {gap === null ? "No attendance has been recorded for you yet." : `No attendance recorded for ${gap} days.`} Please attend your classes regularly or inform the office.
        </div>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Kpi label="Attendance (30 days)" value={`${attendance.pct}%`} tone={attendance.pct >= 75 ? "green" : attendance.pct >= 60 ? "amber" : "red"} />
        <Kpi label="Last attendance" value={d.lastAttendance ? fmtDate(d.lastAttendance) : "—"} tone={gap !== null && gap > ATTENDANCE_GAP_DAYS ? "red" : undefined} />
        {(["biometric", "zoom", "teamviewer", "manual"] as const).map((k) => <Kpi key={k} label={SOURCE[k]} value={attendance.bySource[k] ?? 0} />)}
      </div>
      <Card title="Attendance report — recent sessions" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Source</th><th>In</th><th>Out</th><th>Duration</th></tr></thead>
          <tbody>
            {attendance.recent.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{fmtDate(r.session_date)}</td>
                <td>{SOURCE[r.source] ?? r.source}</td>
                <td>{r.check_in ? istTime(r.check_in) : "—"}</td>
                <td>{r.check_out ? istTime(r.check_out) : "—"}</td>
                <td className="tabular-nums">{r.duration_minutes ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m` : "—"}</td>
              </tr>
            ))}
            {!attendance.recent.length && <tr><td colSpan={5} className="text-center text-muted">No sessions recorded yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
