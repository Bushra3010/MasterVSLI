import "server-only";
import { addDays, fmtDate, inr, todayISO } from "./format";
import { emailConfigured, sendEmail, sendSms, sendWhatsApp, smsConfigured, waNumber, whatsappConfigured } from "./messaging";
import type { Repo } from "./repo";

type Channel = "whatsapp" | "email" | "sms";

/** Students with unpaid installments, overdue or falling due in the next 3 days (Paka fees only). */
export async function feeDues(repo: Repo, scope: "overdue" | "due_soon" | "all" = "all") {
  const today = todayISO();
  const soon = addDays(today, 3);
  const { installments, students } = await repo.ledger("paka");
  const by = new Map<string, { amount: number; due: string; overdue: boolean }>();
  for (const i of installments.filter((x) => x.status !== "paid")) {
    const overdue = i.due_date < today;
    if (scope === "overdue" && !overdue) continue;
    if (scope === "due_soon" && (overdue || i.due_date > soon)) continue;
    if (scope === "all" && !overdue && i.due_date > soon) continue;
    const cur = by.get(i.student_id) ?? { amount: 0, due: i.due_date, overdue: false };
    cur.amount += Number(i.amount) - Number(i.paid_amount);
    cur.due = cur.due < i.due_date ? cur.due : i.due_date;
    cur.overdue ||= overdue;
    by.set(i.student_id, cur);
  }
  return [...by.entries()]
    .map(([id, d]) => ({ student: students.find((s) => s.id === id)!, ...d }))
    .filter((x) => x.student && x.student.status !== "dropped");
}

export const reminderText = (name: string, amount: number, due: string, overdue: boolean) =>
  overdue
    ? `Hi ${name.split(" ")[0]}, your MasterVLSI fee installment of ${inr(amount)} was due on ${fmtDate(due)} and is overdue. Please pay from your student portal (Pay now) or at the office to keep your training access active. — MasterVLSI`
    : `Hi ${name.split(" ")[0]}, a gentle reminder: your MasterVLSI fee installment of ${inr(amount)} is due on ${fmtDate(due)}. You can pay from your student portal (Pay now). — MasterVLSI`;

export async function sendFeeReminders(repo: Repo, opts: { channel: Channel; scope: "overdue" | "due_soon"; studentId?: string }) {
  const dues = (await feeDues(repo, opts.studentId ? "all" : opts.scope)).filter((d) => !opts.studentId || d.student.id === opts.studentId);
  const configured = opts.channel === "email" ? emailConfigured() : opts.channel === "sms" ? smsConfigured() : whatsappConfigured();
  const reachable = dues.filter((d) => (opts.channel === "email" ? d.student.email : waNumber(d.student.phone)));
  let sent = 0;
  if (configured)
    for (const d of reachable) {
      const text = reminderText(d.student.full_name, d.amount, d.due, d.overdue);
      try {
        if (opts.channel === "email") await sendEmail(d.student.email!, d.overdue ? "MasterVLSI fee overdue" : "MasterVLSI fee reminder", text);
        else if (opts.channel === "sms") await sendSms(d.student.phone!, text);
        else await sendWhatsApp(waNumber(d.student.phone)!, text);
        sent++;
      } catch {
        /* counted as failed */
      }
    }
  await repo.logMessage({
    channel: opts.channel,
    audience: opts.studentId ? `Fee reminder – ${dues[0]?.student.full_name ?? "student"}` : `Fee reminder – ${opts.scope === "overdue" ? "overdue" : "due in 3 days"}`,
    subject: "Fee reminder",
    body: reminderText("{name}", dues[0]?.amount ?? 0, dues[0]?.due ?? todayISO(), dues[0]?.overdue ?? true),
    recipients: reachable.length,
    sent,
    status: configured ? (sent === reachable.length ? "sent" : `${reachable.length - sent} failed`) : "not configured",
  });
  if (!configured)
    return {
      ok: false,
      message: `${opts.channel === "sms" ? "SMS" : opts.channel === "email" ? "Email" : "WhatsApp API"} isn't set up, so nothing was sent automatically.${opts.channel === "whatsapp" ? " Use the click-to-chat links below." : ""}`,
      links: opts.channel === "whatsapp" ? reachable.map((d) => ({ name: `${d.student.full_name} · ${inr(d.amount)}`, url: `https://wa.me/${waNumber(d.student.phone)}?text=${encodeURIComponent(reminderText(d.student.full_name, d.amount, d.due, d.overdue))}` })) : undefined,
    };
  return { ok: sent > 0, message: `Reminder sent to ${sent} of ${reachable.length} students (${dues.length - reachable.length} without ${opts.channel === "email" ? "email" : "mobile"}).` };
}
