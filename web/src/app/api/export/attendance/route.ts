import { addDays, istDateTime, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession } from "@/lib/session";

/** CSV export of synced attendance (opens directly in Excel). */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role === "student") return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? todayISO();
  const from = url.searchParams.get("from") ?? addDays(to, -30);
  const repo = await getRepo();
  const [records, students] = await Promise.all([repo.attendance(from, to), repo.students()]);
  const byId = new Map(students.map((x) => [x.id, x]));
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["Date", "Enrollment No", "Student", "Batch", "Source", "Check-in (IST)", "Check-out (IST)", "Duration (min)", "Reference"].map(esc).join(","),
    ...records.map((r) => {
      const st = byId.get(r.student_id);
      return [r.session_date, st?.enrollment_no, st?.full_name, st?.batch_name, r.source, istDateTime(r.check_in), istDateTime(r.check_out), r.duration_minutes, r.external_ref].map(esc).join(",");
    }),
  ];
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="attendance_${from}_to_${to}.csv"`,
    },
  });
}
