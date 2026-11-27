import { NextResponse } from "next/server";
import { createCalendarRepo } from "@/lib/calendar";
import { runDailyLeadReport } from "@/lib/leads";
import { safeEqual } from "@/lib/integrations/crypto";
import { getServiceRepo } from "@/lib/server";
import { getServiceStore } from "@/lib/session";

/**
 * Hourly calendar reminders (1 day before / same day / 1 hour before) over WhatsApp and email.
 * Triggered by the Cloudflare cron worker (workers/cron) with Authorization: Bearer $CRON_SECRET.
 * Dashboard reminders need no job: the calendar and dashboard show them as soon as they fall due.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const staff = await getServiceRepo().staff();
  const result = await createCalendarRepo(getServiceStore()).sendDue(staff);
  // Daily lead report for the super admin (8:30 PM India time unless changed in Lead Management).
  const leads = await runDailyLeadReport(getServiceStore(), Date.now()).catch((e) => ({ report: "failed", error: String(e) }));
  return NextResponse.json({ ok: true, ...result, leads });
}

export const GET = run;
export const POST = run;
