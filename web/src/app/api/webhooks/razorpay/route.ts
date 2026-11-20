import { NextResponse } from "next/server";
import { verifyRazorpaySignature } from "@/lib/payments";
import { getServiceRepo } from "@/lib/server";

/**
 * Razorpay → fee payment. In Razorpay Dashboard › Webhooks add this URL with the event
 * "payment_link.paid" and the secret you set as RAZORPAY_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyRazorpaySignature(raw, req.headers.get("x-razorpay-signature"))))
    return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const body = JSON.parse(raw) as {
    event: string;
    payload?: { payment_link?: { entity?: { id?: string } }; payment?: { entity?: { id?: string; method?: string } } };
  };
  if (body.event !== "payment_link.paid") return NextResponse.json({ ok: true, ignored: body.event });

  const linkId = body.payload?.payment_link?.entity?.id;
  const payment = body.payload?.payment?.entity;
  if (!linkId) return NextResponse.json({ error: "no payment link" }, { status: 400 });

  const repo = getServiceRepo();
  const reqRow = await repo.paymentRequestByExternal(linkId);
  if (!reqRow) return NextResponse.json({ ok: false, reason: "unknown payment link" });
  const mode = payment?.method === "upi" ? "UPI" : payment?.method === "card" ? "Card" : payment?.method === "netbanking" ? "Bank Transfer" : "Online";
  await repo.completePaymentRequest(reqRow.id, payment?.id ?? linkId, mode);
  return NextResponse.json({ ok: true });
}
