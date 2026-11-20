import "server-only";
import { hmacHex, safeEqual } from "./integrations/crypto";

/**
 * Online fee payments.
 *  - Razorpay payment links (RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET): the student pays by UPI, GPay,
 *    PhonePe, card or netbanking on Razorpay's page; the webhook (RAZORPAY_WEBHOOK_SECRET) books it.
 *  - Plain UPI (UPI_VPA, optional UPI_PAYEE_NAME): a UPI QR / intent link for GPay, PhonePe, Paytm.
 *    UPI has no callback, so staff confirm the payment once it reaches the bank.
 */
export const razorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const upiConfigured = () => Boolean(process.env.UPI_VPA);

export function upiLink(amount: number, note: string) {
  const p = new URLSearchParams({
    pa: process.env.UPI_VPA!,
    pn: process.env.UPI_PAYEE_NAME || "MasterVLSI",
    am: amount.toFixed(2),
    cu: "INR",
    tn: note.slice(0, 50),
  });
  return `upi://pay?${p.toString()}`;
}

export async function createRazorpayLink(opts: {
  amount: number;
  description: string;
  referenceId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  callbackUrl: string;
}) {
  const auth = btoa(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`);
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(opts.amount * 100),
      currency: "INR",
      description: opts.description,
      reference_id: opts.referenceId,
      customer: { name: opts.name, email: opts.email || undefined, contact: opts.phone || undefined },
      notify: { sms: Boolean(opts.phone), email: Boolean(opts.email) },
      callback_url: opts.callbackUrl,
      callback_method: "get",
    }),
  });
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { id: string; short_url: string };
  return { id: data.id, url: data.short_url };
}

export async function verifyRazorpaySignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  return safeEqual(await hmacHex(secret, rawBody), signature);
}
