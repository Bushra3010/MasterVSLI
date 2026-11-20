import { NextResponse } from "next/server";
import { istDate } from "@/lib/format";
import { z } from "zod";
import { checkApiKey } from "@/lib/integrations/crypto";
import { getServiceRepo } from "@/lib/server";

/**
 * Recorded-class access (TeamViewer sessions / LMS player) → attendance.
 * POST with header x-api-key: TEAMVIEWER_API_KEY
 * { "student_ref": "TV-100200" | email | enrollment no, "recording_id": "rec-…", "watched_minutes": 75, "watched_at": "2026-11-20T14:00:00Z" }
 */
const Body = z.object({
  student_ref: z.string(),
  recording_id: z.string(),
  watched_minutes: z.coerce.number().int().min(0),
  watched_at: z.string().optional(),
});

export async function POST(req: Request) {
  const repo = getServiceRepo();
  if (!checkApiKey(req, process.env.TEAMVIEWER_API_KEY, repo.mode === "demo")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;
  const student = await repo.findByRef("teamviewer", b.student_ref);
  if (!student) return NextResponse.json({ error: "unknown student" }, { status: 404 });
  const at = b.watched_at ?? new Date().toISOString();
  const result = await repo.recordAttendance({
    student_id: student.id,
    source: "teamviewer",
    session_date: istDate(at),
    check_in: new Date(Date.parse(at) - b.watched_minutes * 60000).toISOString(),
    check_out: at,
    duration_minutes: b.watched_minutes,
    external_ref: b.recording_id,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
