import { NextResponse } from "next/server";
import { istDate } from "@/lib/format";
import { hmacHex, safeEqual } from "@/lib/integrations/crypto";
import { getServiceRepo } from "@/lib/server";

/**
 * Zoom → attendance. Subscribe your Zoom app to:
 *   meeting.participant_joined, meeting.participant_left
 * Endpoint: https://<app>/api/webhooks/zoom   Secret: ZOOM_WEBHOOK_SECRET
 * Participants are matched by email against student_access(zoom).external_ref, then students.email.
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
  const p = obj.participant ?? {};
  const email: string | undefined = p.email;
  if (!email) return NextResponse.json({ ignored: "participant has no email" });

  const repo = getServiceRepo();
  const student = await repo.findByRef("zoom", email.toLowerCase());
  if (!student) return NextResponse.json({ ignored: "unknown participant" });

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
