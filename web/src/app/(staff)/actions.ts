"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/session";
import { getRepo } from "@/lib/server";
import { syncDriveToSheet } from "@/lib/integrations/google-sheets";
import type { Channel, DriveStatus, LetterTemplate, StudentStatus } from "@/lib/types";

const money = z.coerce.number().min(0);

export async function createStudentAction(form: FormData) {
  const me = await requireStaff();
  const allocations = [0, 1, 2]
    .map((i) => ({
      vendor_id: String(form.get(`alloc_vendor_${i}`) || ""),
      sub_vendor_id: String(form.get(`alloc_sub_${i}`) || "") || undefined,
      amount: Number(form.get(`alloc_amount_${i}`) || 0),
      installments: Number(form.get(`alloc_n_${i}`) || 1),
      // Only a super admin may route money to a Kacha (other) account.
      account: (form.get(`alloc_account_${i}`) === "kacha" && me.role === "super_admin" ? "kacha" : "paka") as "paka" | "kacha",
    }))
    .filter((a) => a.vendor_id && a.amount > 0);

  const input = z
    .object({
      full_name: z.string().min(2),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      gender: z.string().optional(),
      dob: z.string().optional(),
      course_id: z.string().min(1),
      batch_id: z.string().optional(),
      training_mode: z.enum(["online", "offline", "hybrid"]),
      admission_date: z.string().min(10),
      total_fee: money,
      lead_source: z.string().optional(),
      referred_by: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      category: z.enum(["normal", "college", "corporate"]),
      branch_id: z.string().optional(),
      college_id: z.string().optional(),
      client_id: z.string().optional(),
    })
    .parse(Object.fromEntries(form));
  const repo = await getRepo();
  const field = (k: string) => String(form.get(k) ?? "").trim();
  // "+ Add new …" in the form: create the college / company first, then link the student to it.
  if (input.category === "college" && input.college_id === "__new") {
    if (!field("new_college_name")) throw new Error("Enter the new college's name");
    const c = await repo.save("colleges", { name: field("new_college_name"), city: field("new_college_city") || undefined, status: "partner" });
    input.college_id = c?.id;
  }
  if (input.category === "corporate" && input.client_id === "__new") {
    if (!field("new_client_name")) throw new Error("Enter the new company's name");
    const c = await repo.save("clients", { name: field("new_client_name"), contact_person: field("new_client_contact") || undefined, kind: "corporate_training" });
    input.client_id = c?.id;
  }
  if (input.category === "college" && !input.college_id) throw new Error("Pick the college for a college student");
  if (input.category === "corporate" && !input.client_id) throw new Error("Pick the company for a corporate student");

  const s = await repo.createStudent({ ...input, allocations });
  const enquiryId = String(form.get("enquiry_id") || "");
  if (enquiryId) await repo.setEnquiry(enquiryId, { status: "admitted", student_id: s.id });
  const leadId = String(form.get("lead_id") || "");
  if (leadId) {
    await repo.moveLead(leadId, "enrolled");
    const { getStore } = await import("@/lib/session");
    await (await getStore()).update("leads", { id: leadId }, { student_id: s.id });
  }
  revalidatePath("/students");
  redirect(`/students/${s.id}`);
}

export async function setStatusAction(id: string, status: StudentStatus, reason?: string) {
  await requireStaff();
  await (await getRepo()).setStatus(id, status, reason);
  revalidatePath("/", "layout");
}

export async function toggleChannelAction(id: string, channel: Channel, enabled: boolean) {
  await requireStaff();
  await (await getRepo()).setChannel(id, channel, enabled);
  revalidatePath("/", "layout");
}

export async function renewAction(id: string, months: number) {
  await requireStaff();
  await (await getRepo()).renew(id, months);
  revalidatePath("/", "layout");
}

export async function recordPaymentAction(form: FormData) {
  await requireStaff();
  const { installment_id, amount, mode, reference } = z
    .object({ installment_id: z.string(), amount: z.coerce.number().positive(), mode: z.string(), reference: z.string().optional() })
    .parse(Object.fromEntries(form));
  await (await getRepo()).recordPayment(installment_id, amount, mode, reference);
  revalidatePath("/", "layout");
}

export async function createDriveAction(form: FormData) {
  await requireStaff();
  const input = z
    .object({
      company: z.string().min(2),
      job_role: z.string().min(2),
      location: z.string().optional(),
      drive_date: z.string().optional(),
      interview_mode: z.string().optional(),
      ctc: z.string().optional(),
      eligibility: z.string().optional(),
      status: z.enum(["upcoming", "open", "closed"]),
    })
    .parse(Object.fromEntries(form));
  const d = await (await getRepo()).createDrive({ ...input, drive_date: input.drive_date || undefined });
  revalidatePath("/placements");
  redirect(`/placements?drive=${d.id}`);
}

export async function setDriveStatusAction(id: string, status: DriveStatus) {
  await requireStaff();
  await (await getRepo()).setDriveStatus(id, status);
  revalidatePath("/placements");
}

export async function setStageAction(driveId: string, studentId: string, stage: string) {
  await requireStaff();
  await (await getRepo()).setStage(driveId, studentId, stage);
  revalidatePath("/placements");
}

export async function syncDriveAction(driveId: string) {
  await requireStaff();
  const result = await syncDriveToSheet(await getRepo(), driveId);
  revalidatePath("/placements");
  return result;
}

export async function issueLetterAction(form: FormData) {
  await requireStaff();
  const template = String(form.get("template")) as LetterTemplate;
  const subject = String(form.get("subject") || "");
  const data: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("d_") && String(v)) data[k.slice(2)] = String(v);
  const target = subject.startsWith("staff:") ? { staff_id: subject.slice(6) } : { student_id: subject.replace(/^student:/, "") };
  const l = await (await getRepo()).issueLetter(template, target, data);
  revalidatePath("/documents");
  redirect(`/documents/${l.serial_no}`);
}

export async function runExpiryAction() {
  await requireStaff();
  const repo = await getRepo();
  const out = await repo.processExpiry();
  const { deliverPendingNotifications } = await import("@/lib/notify");
  const delivery = await deliverPendingNotifications(repo).catch(() => null);
  revalidatePath("/", "layout");
  return { processed: out, delivery };
}

// ---- profile editing --------------------------------------------------------
const EDU_LEVELS = ["10th", "12th / Diploma", "B.Tech / B.E", "M.Tech / PG"];

export async function updateProfileAction(id: string, form: FormData) {
  await requireStaff();
  const g = (k: string) => {
    const v = form.get(k);
    return v === null ? undefined : String(v).trim();
  };
  const opt = (k: string) => g(k) || null;
  const group = (prefix: string, keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, g(`${prefix}.${k}`) || undefined]).filter(([, v]) => v !== undefined));

  const full_name = g("full_name");
  if (!full_name || full_name.length < 2) throw new Error("Full name is required");

  const repo = await getRepo();
  await repo.updateStudent(id, {
    full_name,
    dob: opt("dob"),
    gender: opt("gender"),
    marital_status: opt("marital_status"),
    blood_group: opt("blood_group"),
    nationality: opt("nationality"),
    languages: (g("languages") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    native_place: opt("native_place"),
    phone: opt("phone"),
    alt_phone: opt("alt_phone"),
    email: opt("email"),
    alt_email: opt("alt_email"),
    linkedin: opt("linkedin"),
    resume_url: opt("resume_url"),
    address: group("address", ["line", "city", "district", "state", "pincode"]),
    family: group("family", ["father_name", "father_occupation", "father_phone", "mother_name", "mother_occupation", "mother_phone"]),
    emergency: group("emergency", ["name", "relation", "phone"]),
    spouse: group("spouse", ["name", "occupation", "phone"]),
    professional: {
      ...group("pro", ["working_status", "company", "total_exp", "relevant_exp", "current_ctc", "expected_ctc", "notice_period", "preferred_location", "interview_mode"]),
      relocate: form.get("pro.relocate") === "on",
    },
    ...(g("category") ? { category: (["normal", "college", "corporate"].includes(g("category")!) ? g("category") : "normal") as "normal" | "college" | "corporate" } : {}),
    ...(form.has("branch_id") ? { branch_id: opt("branch_id") } : {}),
    // converting e.g. a college student to a normal student clears the college / company link
    ...(form.has("college_id") ? { college_id: g("category") === "college" ? opt("college_id") : null } : {}),
    ...(form.has("client_id") ? { client_id: g("category") === "corporate" ? opt("client_id") : null } : {}),
    course_id: opt("course_id"),
    batch_id: opt("batch_id"),
    training_mode: (g("training_mode") as "online" | "offline" | "hybrid") || "hybrid",
    admission_date: g("admission_date") || undefined,
    validity_end: opt("validity_end"),
    payment_plan: opt("payment_plan"),
    referred_by: opt("referred_by"),
    lead_source: opt("lead_source"),
    placement_consent: form.get("placement_consent") === "on",
    placement_eligible: form.get("placement_eligible") === "on",
  });

  await repo.replaceEducation(
    id,
    EDU_LEVELS.map((level, i) => ({
      level,
      institution: opt(`edu.${i}.institution`),
      board: opt(`edu.${i}.board`),
      stream: opt(`edu.${i}.stream`),
      year_of_passing: g(`edu.${i}.year`) ? Number(g(`edu.${i}.year`)) : null,
      score: opt(`edu.${i}.score`),
      location: opt(`edu.${i}.location`),
    })),
  );

  await repo.setExternalRefs(id, {
    zoom: g("ref.zoom")?.toLowerCase() || null,
    teamviewer: opt("ref.teamviewer"),
    biometric: opt("ref.biometric"),
  });

  revalidatePath("/", "layout");
  redirect(`/students/${id}`);
}

// ---- settings: master data ----------------------------------------------------
const idOf = (form: FormData) => String(form.get("id") || "") || undefined;
const text = (form: FormData, k: string) => String(form.get(k) ?? "").trim() || null;

export async function saveCourseAction(form: FormData) {
  await requireStaff();
  const c = z
    .object({
      code: z.string().trim().min(1).max(12),
      name: z.string().trim().min(2),
      duration_months: z.coerce.number().int().min(1).max(60),
      validity_months: z.coerce.number().int().min(1).max(120),
      fee: z.coerce.number().min(0),
    })
    .parse(Object.fromEntries(form));
  await (await getRepo()).saveCourse({ ...c, code: c.code.toUpperCase(), id: idOf(form) });
  revalidatePath("/", "layout");
}

export async function saveBatchAction(form: FormData) {
  await requireStaff();
  const b = z
    .object({ course_id: z.string().min(1), name: z.string().trim().min(2), mode: z.enum(["online", "offline", "hybrid"]), start_date: z.string().optional() })
    .parse(Object.fromEntries(form));
  await (await getRepo()).saveBatch({ ...b, start_date: b.start_date || null, id: idOf(form) });
  revalidatePath("/", "layout");
}

export async function saveVendorAction(form: FormData) {
  await requireStaff();
  const name = text(form, "name");
  if (!name) throw new Error("Vendor name is required");
  await (await getRepo()).saveVendor({
    id: idOf(form),
    name,
    parent_id: text(form, "parent_id"),
    contact_person: text(form, "contact_person"),
    phone: text(form, "phone"),
    email: text(form, "email"),
  });
  revalidatePath("/", "layout");
}

export async function saveStaffAction(form: FormData) {
  await requireStaff();
  const full_name = text(form, "full_name");
  const employee_code = text(form, "employee_code");
  if (!full_name || !employee_code) throw new Error("Name and employee code are required");
  const salary = text(form, "monthly_salary");
  await (await getRepo()).saveStaff({
    id: idOf(form),
    full_name,
    employee_code: employee_code.toUpperCase(),
    designation: text(form, "designation"),
    department: text(form, "department"),
    joining_date: text(form, "joining_date"),
    monthly_salary: salary ? Number(salary) : null,
    email: text(form, "email"),
    phone: text(form, "phone"),
    ...(text(form, "company") ? { company: text(form, "company") === "enrich" ? "enrich" : "mastervlsi" } : {}),
    ...(form.has("branch_id") ? { branch_id: text(form, "branch_id") } : {}),
  } as Parameters<Awaited<ReturnType<typeof getRepo>>["saveStaff"]>[0]);
  revalidatePath("/", "layout");
}

/** Staff records a student's answer (e.g. given by phone); "yes" is exported to the drive's sheet. */
export async function recordResponseAction(driveId: string, form: FormData) {
  await requireStaff();
  const { student_id, response } = z
    .object({ student_id: z.string().min(1), response: z.enum(["yes", "no", "pending"]) })
    .parse(Object.fromEntries(form));
  const repo = await getRepo();
  await repo.respond(driveId, student_id, response);
  if (response === "yes") await syncDriveToSheet(repo, driveId).catch(() => null);
  revalidatePath("/placements");
}

// ---- student portal logins ----------------------------------------------------
function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export type PortalLoginResult = { ok: true; email: string; password: string; reset: boolean } | { ok: false; message: string };

/** Creates (or resets) the student's portal login and returns a one-time temporary password for staff to share. */
export async function portalLoginAction(studentId: string): Promise<PortalLoginResult> {
  await requireStaff();
  const { isSupabaseConfigured, supabaseAdmin } = await import("@/lib/supabase/clients");
  if (!isSupabaseConfigured()) return { ok: false, message: "Portal logins need Supabase (demo mode uses the persona picker)." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY is not set on the server." };

  const repo = await getRepo();
  const p = await repo.profile(studentId);
  if (!p) return { ok: false, message: "Student not found" };
  const email = p.student.email?.trim().toLowerCase();
  if (!email) return { ok: false, message: "Add the student's email in Edit profile first." };

  const admin = supabaseAdmin().auth.admin;
  const password = tempPassword();
  if (p.student.user_id) {
    const { error } = await admin.updateUserById(p.student.user_id, { password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, email, password, reset: true };
  }
  const { data, error } = await admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: p.student.full_name } });
  if (error || !data.user) return { ok: false, message: error?.message ?? "Could not create the login" };
  await repo.updateStudent(studentId, { user_id: data.user.id });
  revalidatePath(`/students/${studentId}`);
  return { ok: true, email, password, reset: false };
}

// ---- student documents ----------------------------------------------------------
export async function uploadDocumentAction(studentId: string, _: unknown, form: FormData) {
  await requireStaff();
  const { uploadStudentDocument } = await import("@/lib/documents");
  const res = await uploadStudentDocument(await getRepo(), studentId, form);
  if (res.ok) revalidatePath(`/students/${studentId}`);
  return res;
}

export async function verifyDocumentAction(docId: string, verified: boolean) {
  await requireStaff();
  await (await getRepo()).setDocumentVerified(docId, verified);
  revalidatePath("/", "layout");
}

export async function deleteDocumentAction(docId: string) {
  await requireStaff();
  const repo = await getRepo();
  const doc = await repo.document(docId);
  if (!doc) return;
  const { deleteFile } = await import("@/lib/storage");
  await deleteFile(doc.storage_path);
  await repo.removeDocument(docId);
  revalidatePath("/", "layout");
}
