import { NextResponse } from "next/server";
import { istDate } from "@/lib/format";
import { z } from "zod";
import { checkApiKey } from "@/lib/integrations/crypto";
import { getServiceRepo } from "@/lib/server";

/**
 * Biometric devices (or the bridge polling them, e.g. eSSL/ZKTeco push) → attendance.
 * POST with header x-api-key: BIOMETRIC_API_KEY
 * { "punches": [{ "device_id": "BIO-HYD-01", "user_code": "MVL2026001", "timestamp": "2026-11-21T04:02:00Z", "direction": "in" }] }
 * First punch of the day is check-in; later punches extend check-out and duration.
 */
const Punch = z.object({
  device_id: z.string(),
  user_code: z.string(),
  timestamp: z.string(),
  direction: z.enum(["in", "out"]).optional(),
});
const Body = z.object({ punches: z.array(Punch).min(1).max(500) });

export async function POST(req: Request) {
  const repo = getServiceRepo();
  if (!checkApiKey(req, process.env.BIOMETRIC_API_KEY, repo.mode === "demo")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const results = [];
  for (const p of parsed.data.punches.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    const student = await repo.findByRef("biometric", p.user_code);
    if (!student) {
      results.push({ user_code: p.user_code, ok: false, reason: "unknown user" });
      continue;
    }
    const day = istDate(p.timestamp);
    const existing = (await repo.attendance(day, day)).find(
      (r) => r.student_id === student.id && r.source === "biometric" && r.external_ref === p.device_id,
    );
    const checkIn = existing?.check_in ?? p.timestamp;
    const res = await repo.recordAttendance({
      student_id: student.id,
      source: "biometric",
      session_date: day,
      check_in: checkIn,
      check_out: existing ? p.timestamp : undefined,
      duration_minutes: existing ? Math.max(0, Math.round((Date.parse(p.timestamp) - Date.parse(checkIn)) / 60000)) : 0,
      external_ref: p.device_id,
    });
    results.push({ user_code: p.user_code, ...res });
  }
  return NextResponse.json({ results });
}
