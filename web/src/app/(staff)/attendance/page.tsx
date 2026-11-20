import { AlertTriangle, Download, Fingerprint, MonitorPlay, Video } from "lucide-react";
import Link from "next/link";
import { Badge, Card, PageHeader, Progress, Stat } from "@/components/ui";
import { addDays, fmtDate, istTime, todayISO } from "@/lib/format";
import { IRREGULAR_THRESHOLD } from "@/lib/repo";
import { getRepo } from "@/lib/server";
import type { AttendanceSource } from "@/lib/types";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const sp = await searchParams;
  const to = typeof sp.to === "string" ? sp.to : todayISO();
  const from = typeof sp.from === "string" ? sp.from : addDays(to, -13);
  const repo = await getRepo();
  const [records, students] = await Promise.all([repo.attendance(from, to), repo.students()]);
  const name = new Map(students.map((s) => [s.id, s]));

  const days = [...new Set(records.map((r) => r.session_date))].sort().reverse();
  const daily = days.map((d) => {
    const rs = records.filter((r) => r.session_date === d);
    const by = (src: AttendanceSource) => new Set(rs.filter((r) => r.source === src).map((r) => r.student_id)).size;
    return { d, zoom: by("zoom"), teamviewer: by("teamviewer"), biometric: by("biometric"), total: new Set(rs.map((r) => r.student_id)).size };
  });
  const irregular = students.filter((s) => s.status === "active" && s.attendance_pct < IRREGULAR_THRESHOLD).sort((a, b) => a.attendance_pct - b.attendance_pct);
  const totalMinutes = records.reduce((a, r) => a + r.duration_minutes, 0);
  const qs = `from=${from}&to=${to}`;
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";
  const lastMonthEnd = addDays(monthStart, -1);
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "This month", from: monthStart, to: today },
    { label: "Last month", from: lastMonthEnd.slice(0, 8) + "01", to: lastMonthEnd },
  ];

  return (
    <>
      <PageHeader
        title="Three-way attendance"
        subtitle="Zoom (live), TeamViewer (recorded) and Biometric (classroom) sync into one central attendance table."
        actions={
          <>
            <a href={`/api/export/attendance?${qs}`} className="btn-navy"><Download size={15} /> Export CSV (Excel)</a>
            <a href={`/attendance/print?${qs}`} className="btn-ghost">Print / PDF</a>
          </>
        }
      />
      <form className="mb-5 flex flex-wrap items-end gap-2">
        <div><label className="label">From</label><input type="date" name="from" defaultValue={from} className="input" /></div>
        <div><label className="label">To</label><input type="date" name="to" defaultValue={to} className="input" /></div>
        <button className="btn-ghost">Apply</button>
        <div className="flex flex-wrap gap-1 text-xs">
          {presets.map((r) => (
            <Link
              key={r.label}
              href={`/attendance?from=${r.from}&to=${r.to}`}
              className={`rounded-full border px-3 py-1.5 ${r.from === from && r.to === to ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-navy"}`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Zoom sessions" value={records.filter((r) => r.source === "zoom").length} icon={<Video size={16} />} tone="blue" />
        <Stat label="TeamViewer (recorded)" value={records.filter((r) => r.source === "teamviewer").length} icon={<MonitorPlay size={16} />} />
        <Stat label="Biometric check-ins" value={records.filter((r) => r.source === "biometric").length} icon={<Fingerprint size={16} />} />
        <Stat label="Learning hours" value={Math.round(totalMinutes / 60).toLocaleString("en-IN")} tone="green" hint={`${fmtDate(from)} – ${fmtDate(to)}`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Daily report" className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Zoom</th><th>TeamViewer</th><th>Biometric</th><th>Unique present</th></tr></thead>
            <tbody>
              {daily.map((r) => (
                <tr key={r.d}>
                  <td className="font-medium">{fmtDate(r.d)}</td>
                  <td className="tabular-nums">{r.zoom}</td>
                  <td className="tabular-nums">{r.teamviewer}</td>
                  <td className="tabular-nums">{r.biometric}</td>
                  <td className="font-semibold tabular-nums">{r.total}</td>
                </tr>
              ))}
              {!daily.length && <tr><td colSpan={5} className="text-center text-muted">No sessions in this range</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card title={<>Irregular students <Badge tone="red">{irregular.length}</Badge></>} icon={<AlertTriangle size={15} />}>
          <p className="mb-3 text-xs text-muted">Active students under {IRREGULAR_THRESHOLD}% over the last 30 days.</p>
          <ul className="space-y-3">
            {irregular.map((s) => (
              <li key={s.id}>
                <div className="flex justify-between text-sm">
                  <Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.full_name}</Link>
                  <span className="tabular-nums text-brand">{s.attendance_pct}%</span>
                </div>
                <Progress value={s.attendance_pct} />
              </li>
            ))}
            {!irregular.length && <li className="text-sm text-muted">Everyone is above threshold 🎉</li>}
          </ul>
        </Card>

        <Card title="Latest synced records" className="xl:col-span-3" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>Source</th><th>Date</th><th>In (IST)</th><th>Out (IST)</th><th>Duration</th><th>Ref</th></tr></thead>
            <tbody>
              {records.slice(0, 40).map((r) => (
                <tr key={r.id}>
                  <td>{name.get(r.student_id)?.full_name ?? r.student_id}</td>
                  <td><Badge tone={r.source === "zoom" ? "blue" : r.source === "teamviewer" ? "violet" : "slate"}>{r.source}</Badge></td>
                  <td>{fmtDate(r.session_date)}</td>
                  <td className="tabular-nums">{istTime(r.check_in)}</td>
                  <td className="tabular-nums">{istTime(r.check_out)}</td>
                  <td className="tabular-nums">{r.duration_minutes} min</td>
                  <td className="font-mono text-xs text-muted">{r.external_ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
