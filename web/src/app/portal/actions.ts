"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { syncDriveToSheet } from "@/lib/integrations/google-sheets";
import { getRepo, getServiceRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import type { DriveResponseValue } from "@/lib/types";

export async function respondAction(driveId: string, response: DriveResponseValue) {
  const s = await requireStudent();
  const repo = await getRepo();
  const profile = await repo.profile(s.studentId);
  const placement = profile?.access.find((a) => a.channel === "placement");
  if (!profile || profile.student.status !== "active" || !placement?.enabled) {
    throw new Error("Placement access is blocked for your account. Please contact the admin.");
  }
  // Placement profile is active only after the student accepts the placement terms.
  const { required } = await getServiceRepo().consentFor(s.studentId, "placement");
  if (required) throw new Error("Accept the Placement Terms & Conditions to activate your placement profile.");
  const drive = (await repo.drives()).find((d) => d.id === driveId);
  if (!drive || drive.status !== "open") throw new Error("This drive is not accepting responses.");
  await repo.respond(driveId, s.studentId, response);
  // "Yes" → auto-export to the drive's Google Sheet (best effort; admins can re-sync from the dashboard).
  if (response === "yes") await syncDriveToSheet(getServiceRepo(), driveId).catch(() => null);
  revalidatePath("/portal", "layout");
}

export async function changePasswordAction(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  await requireStudent();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { ok: false, message: "Use at least 8 characters." };
  if (password !== confirm) return { ok: false, message: "The two passwords don't match." };
  const { isSupabaseConfigured, supabaseServer } = await import("@/lib/supabase/clients");
  if (!isSupabaseConfigured()) return { ok: false, message: "Demo mode has no passwords." };
  const { error } = await (await supabaseServer()).auth.updateUser({ password });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Password updated. Use it next time you sign in." };
}

/** Students may add their own resume, photo, certificates or ID proof; staff verify them. */
export async function portalUploadAction(_: unknown, form: FormData) {
  const s = await requireStudent();
  const { uploadStudentDocument } = await import("@/lib/documents");
  const { getStudentReadRepo } = await import("@/lib/server");
  // Writes go through the service role because students have read-only access to their document rows.
  const res = await uploadStudentDocument(await getStudentReadRepo(), s.studentId, form);
  if (res.ok) revalidatePath("/portal", "layout");
  return res;
}

export type PayResult =
  | { ok: true; kind: "razorpay"; url: string }
  | { ok: true; kind: "upi"; link: string; qr: string; amount: number }
  | { ok: false; message: string };

/** Student starts an online payment for one of their own installments. */
export async function payOnlineAction(installmentId: string): Promise<PayResult> {
  const s = await requireStudent();
  const pay = await import("@/lib/payments");
  const repo = getServiceRepo(); // students can't write payment_requests under RLS; ownership is checked here
  const p = await repo.profile(s.studentId);
  const inst = p?.installments.find((i) => i.id === installmentId);
  if (!p || !inst) return { ok: false, message: "Installment not found." };
  const amount = Number(inst.amount) - Number(inst.paid_amount);
  if (amount <= 0) return { ok: false, message: "This installment is already paid." };

  if (pay.razorpayConfigured()) {
    const { headers } = await import("next/headers");
    const h = await headers();
    const base = process.env.APP_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    const req = await repo.createPaymentRequest({ installment_id: inst.id, student_id: s.studentId, amount, provider: "razorpay", external_id: null, url: null });
    try {
      const link = await pay.createRazorpayLink({
        amount,
        description: `MasterVLSI fee · ${p.student.enrollment_no} · installment ${inst.seq}`,
        referenceId: req.id,
        name: p.student.full_name,
        email: p.student.email,
        phone: p.student.phone,
        callbackUrl: `${base}/portal?paid=1`,
      });
      const { getServiceStore } = await import("@/lib/session");
      await getServiceStore().update("payment_requests", { id: req.id }, { external_id: link.id, url: link.url });
      return { ok: true, kind: "razorpay", url: link.url };
    } catch {
      return { ok: false, message: "Could not start the online payment. Please try again or pay at the office." };
    }
  }
  if (pay.upiConfigured()) {
    const link = pay.upiLink(amount, `${p.student.enrollment_no} inst ${inst.seq}`);
    await repo.createPaymentRequest({ installment_id: inst.id, student_id: s.studentId, amount, provider: "upi", external_id: null, url: link });
    const qr = await QRCode.toDataURL(link, { margin: 1, width: 220 });
    revalidatePath("/portal");
    return { ok: true, kind: "upi", link, qr, amount };
  }
  return { ok: false, message: "Online payment isn't set up yet. Please pay at the office." };
}

// ---- brand ambassador (student submits; staff approve) ------------------------------------------
export async function submitAmbassadorAction(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  const s = await requireStudent();
  const kind = String(form.get("kind") || "");
  const details = String(form.get("details") || "").trim();
  const proof = String(form.get("proof_url") || "").trim();
  if (!["referral", "review", "social", "mentor"].includes(kind)) return { ok: false, message: "Pick an activity." };
  if (details.length < 3) return { ok: false, message: "Add a few details (e.g. friend's name and phone, or the review link)." };
  if (proof && !/^https?:\/\//.test(proof)) return { ok: false, message: "Proof link must start with http(s)://" };
  const repo = getServiceRepo();
  const { getServiceStore } = await import("@/lib/session");
  await getServiceStore().insert("ambassador_activities", [{ student_id: s.studentId, kind, details: details.slice(0, 500), proof_url: proof || null, reward_amount: 0, status: "pending", created_at: new Date().toISOString() }]);
  // A referral also becomes a lead in the admissions pipeline.
  if (kind === "referral") {
    const phone = details.match(/\+?\d[\d\s-]{8,}\d/)?.[0]?.replace(/\D/g, "") ?? null;
    await repo.createLead({ full_name: details.replace(/\+?\d[\d\s-]{8,}\d/, "").replace(/[,–-]+\s*$/, "").trim().slice(0, 80) || "Referral", phone, source: "Referral", referred_by_student: s.studentId, remarks: `Referred by student (portal): ${details}` });
  }
  revalidatePath("/portal/earn");
  return { ok: true, message: "Submitted! The team will verify it and credit your reward." };
}

// ---- terms & placement agreement --------------------------------------------------------------------
export async function acceptTermsAction(kind: "general" | "placement", form: FormData) {
  const s = await requireStudent();
  const repo = getServiceRepo();
  const { terms } = await repo.consentFor(s.studentId, kind);
  if (!terms) return;
  const all = terms.items.every((_, i) => form.get(`t_${i}`) === "on") && form.get("final") === "on";
  if (!all) throw new Error("Please tick every declaration to continue.");
  const { headers } = await import("next/headers");
  await repo.acceptTerms(s.studentId, kind, (await headers()).get("user-agent"));
  revalidatePath("/portal", "layout");
}

export async function requestPlacementGroupAction() {
  const s = await requireStudent();
  const repo = getServiceRepo();
  const { required } = await repo.consentFor(s.studentId, "placement");
  if (required) throw new Error("Accept the placement terms first.");
  await repo.updateStudent(s.studentId, { placement_group: "requested" });
  revalidatePath("/portal", "layout");
}
