import "server-only";
import type { StudentListItem } from "./types";

/**
 * Student broadcasts.
 *  - Email goes through Resend (RESEND_API_KEY + NOTIFY_FROM), the same setup as expiry reminders.
 *  - WhatsApp goes through the WhatsApp Cloud API (WHATSAPP_TOKEN + WHATSAPP_PHONE_ID). Note that
 *    Meta only delivers free-form text inside a 24-hour customer window; outside it a template is needed.
 * When a channel isn't configured the message is still logged, and the page offers click-to-chat links.
 */
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM);
export const whatsappConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

export const AUDIENCES: Record<string, string> = {
  active: "All active students",
  all: "All students",
  on_hold: "Students on hold",
  expiring: "Validity ending in 30 days",
  fees_due: "Students with fees due",
  irregular: "Irregular attendance (<75%)",
};

export function pickAudience(list: StudentListItem[], audience: string) {
  if (audience.startsWith("batch:")) return list.filter((s) => s.batch_id === audience.slice(6));
  switch (audience) {
    case "all": return list;
    case "on_hold": return list.filter((s) => s.status === "on_hold");
    case "expiring": return list.filter((s) => s.days_left !== null && s.days_left >= 0 && s.days_left <= 30 && s.status !== "expired");
    case "fees_due": return list.filter((s) => s.balance > 0);
    case "irregular": return list.filter((s) => s.status === "active" && s.attendance_pct < 75);
    default: return list.filter((s) => s.status === "active");
  }
}

/** Indian mobile → E.164 digits without "+" (e.g. 9876543210 → 919876543210). */
export function waNumber(phone?: string | null) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  if (d.length === 12 && d.startsWith("91")) return d;
  return d.length >= 11 ? d : null;
}

export const personalize = (text: string, s: StudentListItem) =>
  text.replace(/\{name\}/g, s.full_name.split(" ")[0]).replace(/\{enrollment\}/g, s.enrollment_no);

export async function sendEmail(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

export async function sendWhatsApp(to: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}`);
}
