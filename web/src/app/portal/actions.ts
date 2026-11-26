"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AmbassadorKind } from "@/lib/types";
import QRCode from "qrcode";
import { syncDriveToSheet } from "@/lib/integrations/google-sheets";
import { getServiceRepo, getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import type { DriveResponseValue } from "@/lib/types";

export async function respondAction(driveId: string, response: DriveResponseValue) {
  const s = await requireStudent();
  // Reads and the write use the server's access, always scoped to the signed-in student's own id,
  // after every rule below has been checked (students' row-level permissions made this fragile).
  const svc = await getStudentReadRepo();
  const profile = await svc.profile(s.studentId);
  const placement = profile?.access.find((a) => a.channel === "placement");
  if (!profile || profile.student.status !== "active" || !placement?.enabled) redirect("/portal/drives?error=blocked");
  // Placement profile is active only after the student accepts the placement terms.
  const { required } = await getServiceRepo().consentFor(s.studentId, "placement");
  if (required) redirect("/portal/drives?error=terms");
  const drive = (await svc.drives()).find((d) => d.id === driveId);
  if (!drive || drive.status !== "open") redirect("/portal/drives?error=closed");
  await svc.respond(driveId, s.studentId, response);
  // "Yes" → auto-export to the drive's Google Sheet (best effort; admins can re-sync from the dashboard).
  if (response === "yes") await syncDriveToSheet(getServiceRepo(), driveId).catch(() => null);
  revalidatePath("/portal", "layout");
  redirect(`/portal/drives?saved=${response}`);
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

// ---- earn & rewards (student submits; office verifies) ------------------------------------------
function earnBack(section: string, msg: string, ok = true): never {
  redirect(`/portal/earn?${ok ? "saved" : "error"}=${encodeURIComponent(msg)}#${section}`);
}

/** Saves one activity after checking the program and this activity are open. */
async function submitEarn(kind: AmbassadorKind, section: string, details: string, data: Record<string, string | number | boolean | null>, proof?: string | null) {
  const s = await requireStudent();
  const { createRewardsRepo } = await import("@/lib/rewards");
  const { getServiceStore } = await import("@/lib/session");
  const { KIND_SETTING } = await import("@/lib/types-rewards");
  const rewards = createRewardsRepo(getServiceStore());
  const [setting, program] = await Promise.all([rewards.setting(KIND_SETTING[kind]), rewards.program()]);
  const today = new Date().toISOString().slice(0, 10);
  if (!setting.active || setting.paused) earnBack(section, `${setting.label} is ${setting.paused ? "paused" : "not open"} right now.`, false);
  if ((program.valid_from && today < program.valid_from) || (program.valid_to && today > program.valid_to)) earnBack(section, "The Earn & Rewards program is not running right now.", false);
  if (proof && !/^https?:\/\//.test(proof)) earnBack(section, "Links must start with http:// or https://", false);
  await getServiceStore().insert("ambassador_activities", [{ student_id: s.studentId, kind, details: details.slice(0, 500), proof_url: proof || null, reward_amount: 0, status: "pending", data, created_at: new Date().toISOString() }]);
  revalidatePath("/portal/earn", "layout");
  return s;
}
const f = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

export async function submitReferralAction(form: FormData) {
  const name = f(form, "name"), phone = f(form, "phone").replace(/[^\d+]/g, ""), email = f(form, "email");
  if (name.length < 2) earnBack("refer", "Enter the student's name.", false);
  if (phone.replace(/\D/g, "").length < 10) earnBack("refer", "Enter a valid 10-digit mobile number.", false);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) earnBack("refer", "Enter a valid email address.", false);
  const join = f(form, "join_date");
  const s = await submitEarn("referral", "refer", `${name} · ${phone}${email ? ` · ${email}` : ""}`, { name, phone, email: email || null, college: f(form, "college") || null, join_date: join || null, info: f(form, "info").slice(0, 250) || null });
  // A referral also becomes a lead in the admissions pipeline.
  await getServiceRepo().createLead({ full_name: name.slice(0, 80), phone, email: email || null, source: "Referral", referred_by_student: s.studentId, remarks: `Referred by ${s.name} (portal)${f(form, "college") ? ` · ${f(form, "college")}` : ""}${join ? ` · expected joining ${join}` : ""}${f(form, "info") ? ` · ${f(form, "info").slice(0, 250)}` : ""}` });
  earnBack("refer", "Referral submitted! You earn the reward after the admission and payment are verified.");
}

export async function submitFeedbackAction(kind: "feedback" | "review", form: FormData) {
  const text = f(form, "text"), link = f(form, "proof_url");
  if (kind === "feedback" && text.length < 10) earnBack("feedback", "Write at least a line of feedback (10+ characters).", false);
  if (kind === "review" && !link) earnBack("feedback", "Paste the link to your Google review.", false);
  await submitEarn(kind, "feedback", kind === "feedback" ? text : `Google review ${text ? `– ${text}` : ""}`.trim(), { text: text.slice(0, 1000) || null }, link || null);
  earnBack("feedback", kind === "feedback" ? "Feedback submitted for verification." : "Google review submitted. Thank you!");
}

export async function submitSocialAction(form: FormData) {
  const platform = f(form, "platform");
  const n = (k: string) => Math.max(0, Math.floor(Number(f(form, k)) || 0));
  const likes = n("likes"), shares = n("shares"), subscribes = n("subscribes");
  const { SOCIAL_PLATFORMS } = await import("@/lib/types-rewards");
  const p = SOCIAL_PLATFORMS.find((x) => x.key === platform);
  if (!p) earnBack("social", "Pick a platform.", false);
  if (likes + shares + subscribes === 0) earnBack("social", "Enter your likes, shares or subscribes.", false);
  if (likes + shares + subscribes > 100000) earnBack("social", "That's more than one submission allows — split it into smaller ones.", false);
  await submitEarn("social", "social", `${p!.label} – ${likes} likes, ${shares} shares, ${subscribes} subscribes`, { platform, likes, shares, subscribes }, f(form, "proof_url") || null);
  earnBack("social", "Activity submitted for verification.");
}

export async function applyMentorshipAction(form: FormData) {
  const domain = f(form, "domain"), start = f(form, "start"), end = f(form, "end");
  if (!domain) earnBack("mentorship", "Pick a mentorship domain.", false);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) earnBack("mentorship", "Pick the start and end dates.", false);
  const { addMonths } = await import("@/lib/format");
  if (end < addMonths(start, 4)) earnBack("mentorship", "Mentorship must be for at least 4 months.", false);
  if (form.get("agree_duration") !== "on" || form.get("agree_terms") !== "on") earnBack("mentorship", "Tick both agreements to apply.", false);
  await submitEarn("mentor", "mentorship", `Mentorship – ${domain}, ${start} to ${end}`, { domain, start, end, agreed: true });
  earnBack("mentorship", "Mentorship application submitted.");
}

export async function reportIncidentAction(form: FormData) {
  const about = f(form, "about"), date = f(form, "date"), text = f(form, "description");
  if (about.length < 2) earnBack("incident", "Enter who the incident is about.", false);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date().toISOString().slice(0, 10)) earnBack("incident", "Pick the date of the incident (not in the future).", false);
  if (text.length < 15) earnBack("incident", "Describe what happened (at least 15 characters).", false);
  await submitEarn("incident", "incident", `Incident about ${about} on ${date}`, { about, number: f(form, "number") || null, date, description: text.slice(0, 500), confidential: form.get("confidential") === "on" });
  earnBack("incident", "Report submitted confidentially to the office.");
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

// ---- assignments: student submits a link ------------------------------------------------------
export async function submitAssignmentAction(assignmentId: string, form: FormData) {
  const s = await requireStudent();
  const link = String(form.get("link") || "").trim();
  const note = String(form.get("note") || "").trim();
  if (!/^https?:\/\/\S+$/.test(link)) throw new Error("Paste a link to your work (GitHub, EDA Playground, Drive…)");
  const repo = getServiceRepo();
  const [a, p] = await Promise.all([repo.one<{ course_id?: string | null }>("assignments", assignmentId), repo.profile(s.studentId)]);
  if (!a || !p || (a.course_id && a.course_id !== p.student.course_id)) throw new Error("Assignment not found");
  const { getServiceStore } = await import("@/lib/session");
  await getServiceStore().upsert("assignment_submissions", [{ assignment_id: assignmentId, student_id: s.studentId, link: link.slice(0, 500), note: note.slice(0, 500) || null, submitted_at: new Date().toISOString(), status: "submitted" }], "assignment_id,student_id");
  revalidatePath("/portal/learning");
}

/** Students fill / correct their own profile (personal, contact, address, family, education, pre-joining work). */
export async function saveOwnProfileAction(_: { ok: boolean; message: string } | null, form: FormData): Promise<{ ok: boolean; message: string }> {
  const s = await requireStudent();
  const { parseProfileForm } = await import("@/lib/profile");
  const repo = await getStudentReadRepo();
  const p = await repo.profile(s.studentId);
  if (!p) return { ok: false, message: "Profile not found" };
  try {
    const { patch, education } = parseProfileForm(form, "student", p.student);
    // A student's own edit needs the office to verify the profile again.
    await repo.updateStudent(s.studentId, { ...patch, profile_verified_by: null, profile_verified_at: null });
    await repo.replaceEducation(s.studentId, education);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not save" };
  }
  revalidatePath("/portal", "layout");
  return { ok: true, message: "Saved. The office will review and verify your profile." };
}
