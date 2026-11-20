import { PrintButton } from "@/components/print-button";
import { addDays, fmtDate, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";

export const metadata = { title: "Attendance report" };

export default async function AttendancePrint({ searchParams }: PageProps<"/attendance/print">) {
  const sp = await searchParams;
  const to = typeof sp.to === "string" ? sp.to : todayISO();
  const from = typeof sp.from === "string" ? sp.from : addDays(to, -13);
  const repo = await getRepo();
  const [records, students] = await Promise.all([repo.attendance(from, to), repo.students()]);
  const days = [...new Set(records.map((r) => r.session_date))].sort();

  return (
    <div className="mx-auto max-w-5xl bg-white p-6">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <h1 className="text-xl font-semibold text-navy">MasterVLSI — Attendance report</h1>
      <p className="mb-4 text-sm text-muted">{fmtDate(from)} to {fmtDate(to)} · {days.length} class days</p>
      <table className="table">
        <thead><tr><th>Enrollment</th><th>Student</th><th>Days present</th><th>%</th><th>Zoom</th><th>TeamViewer</th><th>Biometric</th></tr></thead>
        <tbody>
          {students.map((s) => {
            const rs = records.filter((r) => r.student_id === s.id);
            const present = new Set(rs.map((r) => r.session_date)).size;
            return (
              <tr key={s.id}>
                <td className="font-mono text-xs">{s.enrollment_no}</td>
                <td>{s.full_name}</td>
                <td className="tabular-nums">{present}</td>
                <td className="tabular-nums">{days.length ? Math.round((100 * present) / days.length) : 0}%</td>
                <td className="tabular-nums">{rs.filter((r) => r.source === "zoom").length}</td>
                <td className="tabular-nums">{rs.filter((r) => r.source === "teamviewer").length}</td>
                <td className="tabular-nums">{rs.filter((r) => r.source === "biometric").length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
