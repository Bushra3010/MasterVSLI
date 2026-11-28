import { NextResponse } from "next/server";
import { istDate } from "@/lib/format";
import { hmacHex, safeEqual } from "@/lib/integrations/crypto";
import { attendanceMeetings, norm } from "@/lib/integrations/zoom";
import { getServiceRepo } from "@/lib/server";

/**
 * Zoom → attendance. Subscribe your Zoom app to:
 *   meeting.participant_joined, meeting.participant_left
 * Endpoint: https://<app>/api/webhooks/zoom   Secret: ZOOM_WEBHOOK_SECRET
 * Only meetings whose topic is in ZOOM_ATTENDANCE_MEETINGS count (comma-separated; default "Regular Meeting").
 * Participants are matched by email (student_access(zoom).external_ref, then students.email), then by an enrollment
 * number in their Zoom display name (e.g. "MVL2026001 Rahul"), then by an exact, unique full name.
 */

export async function POST(req: Request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET;
  const raw = await req.text();
  const body = JSON.parse(raw || "{}");

  if (body.event === "endpoint.url_validation") {
    if (!secret) return NextResponse.json({ error: "ZOOM_WEBHOOK_SECRET not set" }, { status: 500 });
    const plainToken = body.payload?.plainToken;
    return NextResponse.json({ plainToken, encryptedToken: await hmacHex(secret, plainToken) });
  }

  if (secret) {
    const ts = req.headers.get("x-zm-request-timestamp") ?? "";
    const expected = "v0=" + (await hmacHex(secret, `v0:${ts}:${raw}`));
    if (!safeEqual(req.headers.get("x-zm-signature") ?? "", expected)) return NextResponse.json({ error: "bad signature" }, { status: 401 });
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return NextResponse.json({ error: "stale" }, { status: 401 });
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "ZOOM_WEBHOOK_SECRET not set" }, { status: 500 });
  }

  if (!["meeting.participant_joined", "meeting.participant_left"].includes(body.event)) return NextResponse.json({ ignored: body.event });

  const obj = body.payload?.object ?? {};
  // Attendance is taken only from the class meeting(s), e.g. "Regular Meeting".
  if (!attendanceMeetings().includes(norm(obj.topic))) return NextResponse.json({ ignored: `meeting "${obj.topic ?? ""}" is not an attendance meeting` });
  const p = obj.participant ?? {};
  const email: string | undefined = p.email || undefined;
  const display: string = p.user_name ?? "";

  const repo = getServiceRepo();
  let student = email ? await repo.findByRef("zoom", email.toLowerCase()) : null;
  const enrol = display.match(/\bMVL\s*-?\s*\d{5,}\b/i)?.[0].replace(/[\s-]/g, "").toUpperCase();
  if (!student && enrol) student = await repo.findByRef("zoom", enrol);
  if (!student && norm(display)) {
    const same = (await repo.students({ status: "all" })).filter((s) => norm(s.full_name) === norm(display));
    if (same.length === 1) student = same[0];
  }
  if (!student) return NextResponse.json({ ignored: "unknown participant", name: display || null });

  const joined: string = p.join_time ?? new Date().toISOString();
  const left: string | undefined = body.event === "meeting.participant_left" ? (p.leave_time ?? new Date().toISOString()) : undefined;
  const result = await repo.recordAttendance({
    student_id: student.id,
    source: "zoom",
    session_date: istDate(joined),
    check_in: joined,
    check_out: left,
    duration_minutes: left ? Math.max(0, Math.round((Date.parse(left) - Date.parse(joined)) / 60000)) : 0,
    external_ref: String(obj.uuid ?? obj.id ?? "zoom"),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
