import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/integrations/crypto";
import { deliverPendingNotifications } from "@/lib/notify";
import { getServiceRepo } from "@/lib/server";

/**
 * Daily validity job. Triggered by the Cloudflare cron worker (workers/cron) with
 *   Authorization: Bearer $CRON_SECRET
 * Creates 30/15/7/1-day reminders and expires students (all access channels disabled),
 * runs the alert & escalation engine, and sends automatic fee reminders.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const repo = getServiceRepo();
  const processed = await repo.processExpiry();
  const delivery = await deliverPendingNotifications(repo);
  // Alerts & escalation, then automatic fee reminders on the first configured channel.
  const alerts = await repo.runAlerts().catch((e) => ({ error: String(e) }));
  const { emailConfigured, smsConfigured, whatsappConfigured } = await import("@/lib/messaging");
  const channel = whatsappConfigured() ? "whatsapp" : smsConfigured() ? "sms" : emailConfigured() ? "email" : null;
  let reminders: unknown = "no channel configured";
  if (channel) {
    const { sendFeeReminders } = await import("@/lib/reminders");
    reminders = {
      due_soon: await sendFeeReminders(repo, { channel, scope: "due_soon" }).catch((e) => String(e)),
      // overdue reminders go out on Mondays and Thursdays to avoid daily nagging
      overdue: [1, 4].includes(new Date().getUTCDay()) ? await sendFeeReminders(repo, { channel, scope: "overdue" }).catch((e) => String(e)) : "skipped today",
    };
  }
  return NextResponse.json({ ok: true, processed, delivery, alerts, reminders });
}

export const GET = run;
export const POST = run;
