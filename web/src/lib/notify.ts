import "server-only";
import { fmtDate } from "./format";
import type { Repo } from "./repo";
import type { NotificationRow } from "./types";

/**
 * Delivers recorded validity notifications (30/15/7/1-day reminders and expiry) by email via Resend.
 * Env: RESEND_API_KEY, NOTIFY_FROM ("MasterVLSI <noreply@yourdomain>"), optional ADMIN_NOTIFY_EMAIL.
 * Without a key, notifications stay recorded (shown to admins and in the student portal) and are retried
 * on the next run once a key is configured.
 */
export function noticeText(kind: string, name: string, validity?: string | null) {
  const until = validity ? fmtDate(validity) : "your validity date";
  if (kind === "expired")
    return {
      subject: "Your MasterVLSI training access has expired",
      body: `Hi ${name},\n\nYour training access ended on ${until}. Zoom classes, recordings, biometric entry, placement applications and study materials are now paused.\n\nContact the MasterVLSI office to renew and restore your access.\n\n— MasterVLSI`,
    };
  const days = kind.replace("expiry_", "");
  return {
    subject: `Your MasterVLSI training access expires in ${days} day${days === "1" ? "" : "s"}`,
    body: `Hi ${name},\n\nYour training access is valid until ${until} (${days} day${days === "1" ? "" : "s"} left).${days === "7" || days === "1" ? " After that date your class, recording, biometric and placement access will be switched off automatically." : ""}\n\nContact the MasterVLSI office to renew.\n\n— MasterVLSI`,
  };
}

async function sendEmail(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export async function deliverPendingNotifications(repo: Repo) {
  const configured = Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM);
  const pending = (await repo.notifications()).filter((n: NotificationRow) => !n.sent_at);
  if (!configured) return { configured, sent: 0, pending: pending.length, failed: 0 };

  let sent = 0;
  let failed = 0;
  const adminLines: string[] = [];
  for (const n of pending) {
    const p = await repo.profile(n.student_id);
    if (!p) continue;
    const { subject, body } = noticeText(n.kind, p.student.full_name, p.student.validity_end);
    try {
      if (p.student.email) await sendEmail(p.student.email, subject, body);
      await repo.markNotificationSent(n.id);
      adminLines.push(`• ${p.student.full_name} (${p.student.enrollment_no}) — ${subject.replace("Your MasterVLSI training access ", "")}`);
      sent++;
    } catch {
      failed++;
    }
  }
  const admin = process.env.ADMIN_NOTIFY_EMAIL;
  if (admin && adminLines.length)
    await sendEmail(admin, `MasterVLSI validity update: ${adminLines.length} student(s)`, `Today's training validity notices:\n\n${adminLines.join("\n")}`).catch(() => null);
  return { configured, sent, pending: pending.length - sent, failed };
}
