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
  // College / company details: pick an existing entry (optionally edit its city/state) or add a new one to the master.
  const upsertOrg = async (table: "colleges" | "clients", prefix: "college" | "company", extra: Record<string, unknown>) => {
    const name = field(`${prefix}_name`);
    if (!name) throw new Error(`Enter the ${prefix === "college" ? "college" : "company"} name`);
    if (!field(`${prefix}_city`) || !field(`${prefix}_state`)) throw new Error(`Enter the ${prefix === "college" ? "college" : "company"} city and state`);
    const existing = field(`${prefix}_id`) || (await repo.list<{ id: string; name: string }>(table)).find((o) => o.name.trim().toLowerCase() === name.toLowerCase())?.id;
    if (existing) {
      if (field(`${prefix}_edit`)) await repo.save(table, { id: existing, name, city: field(`${prefix}_city`), state: field(`${prefix}_state`) });
      return existing;
    }
    return (await repo.save(table, { name, city: field(`${prefix}_city`), state: field(`${prefix}_state`), ...extra }))?.id;
  };
  if (input.category === "college") input.college_id = await upsertOrg("colleges", "college", { status: "partner" });
  if (input.category === "corporate") {
    if (!field("company_designation")) throw new Error("Enter the employee designation");
    const rows = field("hr_rows").split(",").filter(Boolean);
    const hr = rows.map((k) => ({ name: field(`hr.${k}.name`), designation: field(`hr.${k}.designation`), email: field(`hr.${k}.email`), phone: field(`hr.${k}.phone`) })).filter((h) => h.name);
    if (!hr.length) throw new Error("Add at least one HR / company contact");
    input.client_id = await upsertOrg("clients", "company", { kind: "corporate_training", contact_person: hr[0].name, email: hr[0].email || undefined, phone: hr[0].phone || undefined });
    const company = field("company_name");
    const known = await repo.list<{ email?: string | null; phone?: string | null; current_company?: string | null }>("hr_contacts");
    for (const h of hr) {
      const dup = known.some((k) => (k.current_company ?? "").toLowerCase() === company.toLowerCase() && ((h.email && k.email === h.email) || (h.phone && k.phone === h.phone)));
      if (!dup) await repo.save("hr_contacts", { full_name: h.name, designation: h.designation, email: h.email, phone: h.phone, current_company: company, company_type: "Corporate training client", city: field("company_city") });
    }
  }
  if (input.category === "college" && !input.college_id) throw new Error("Pick the college for a college student");
  if (input.category === "corporate" && !input.client_id) throw new Error("Pick the company for a corporate student");

  const s = await repo.createStudent({ ...input, allocations });
  // HR commission: a converted lead credits its assigned HR (stage by stage); a direct admission credits the chosen HR.
  const counsellor = field("counsellor_id");
  if (counsellor) await repo.updateStudent(s.id, { counsellor_id: counsellor });
  {
    const { createIncentiveRepo } = await import("@/lib/incentives");
    const { getStore } = await import("@/lib/session");
    const inc = createIncentiveRepo(await getStore());
    const leadForCredit = field("lead_id") ? await repo.one<import("@/lib/types").Lead>("leads", field("lead_id")) : null;
    if (leadForCredit) await inc.creditLeadStage(leadForCredit, "enrolled", { category: input.category, studentLabel: `${s.full_name} – admission` }).catch(() => null);
    else if (counsellor && field("commission_type")) await inc.creditAdmission({ id: s.id, full_name: s.full_name, category: input.category }, counsellor, field("commission_type")).catch(() => null);
  }
  if (input.category === "corporate" && field("company_designation")) await repo.updateStudent(s.id, { extra: { company_designation: field("company_designation") } });
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
  for (const [k, v] of Object.entries(data))
    if (/^\d{4,}-\d{2}-\d{2}$/.test(v) || /^0\d{3}-/.test(v)) {
      const y = Number(v.slice(0, v.indexOf("-")));
      if (y < 1990 || y > 2100) throw new Error(`Check the year in "${k}" — ${v} doesn't look right`);
    }
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

/**
 * Add a staff member from anywhere a staff list is needed (Staff & HR, letters).
 * The employee code is generated when left blank; problems come back as a message instead of an error page.
 */
export async function addStaffAction(form: FormData) {
  await requireStaff();
  const backTo = String(form.get("back") ?? "");
  const base = /^\/(documents|hr)(\?|$)/.test(backTo) ? backTo.split("#")[0].replace(/[?&](saved|error|staff_added)=[^&]*/g, "") : "/hr";
  const go = (k: "saved" | "error", msg: string, extra = ""): never => redirect(`${base}${base.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(msg)}${extra}`);
  const full_name = text(form, "full_name");
  if (!full_name || full_name.length < 2) go("error", "Enter the staff member's full name.");
  const email = text(form, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) go("error", "Enter a valid email address.");
  const phone = text(form, "phone");
  if (phone && phone.replace(/\D/g, "").length < 10) go("error", "Enter a 10-digit mobile number.");
  const salary = text(form, "monthly_salary");
  if (salary && !(Number(salary) >= 0)) go("error", "Monthly salary must be a number.");
  const repo = await getRepo();
  const all = await repo.staff();
  let code = (text(form, "employee_code") ?? "").toUpperCase();
  if (code && all.some((s) => s.employee_code?.toUpperCase() === code)) go("error", `Employee code ${code} is already used.`);
  if (!code) {
    const max = Math.max(0, ...all.map((s) => Number(s.employee_code?.match(/(\d+)$/)?.[1] ?? 0)));
    code = `MVE${String(max + 1).padStart(3, "0")}`;
  }
  try {
    await repo.saveStaff({
      full_name: full_name!, employee_code: code, designation: text(form, "designation"), department: text(form, "department"),
      joining_date: text(form, "joining_date"), monthly_salary: salary ? Number(salary) : null, email, phone,
      company: text(form, "company") === "enrich" ? "enrich" : "mastervlsi",
    });
  } catch (e) {
    go("error", `Could not save: ${e instanceof Error ? e.message : "unknown error"}`);
  }
  revalidatePath("/", "layout");
  const added = (await repo.staff()).find((s) => s.employee_code === code);
  go("saved", `${full_name} added (${code}).`, added ? `&staff_added=${added.id}` : "");
}
