import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/integrations/crypto";
import { getServiceRepo } from "@/lib/server";

/**
 * Daily validity job. Triggered by the Cloudflare cron worker (workers/cron) with
 *   Authorization: Bearer $CRON_SECRET
 * Creates 30/15/7/1-day reminders and expires students (all access channels disabled).
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const processed = await getServiceRepo().processExpiry();
  // Hook point: deliver notifications (email/SMS/WhatsApp) for `processed` here.
  return NextResponse.json({ ok: true, processed });
}

export const GET = run;
export const POST = run;
