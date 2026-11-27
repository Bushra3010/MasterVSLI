"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayISO } from "@/lib/format";
import { EDITABLE } from "@/lib/repo-crm";
import { getRepo } from "@/lib/server";
import { requireStaff } from "@/lib/session";
import type { TableName } from "@/lib/store/types";
import type { AmbassadorActivity, Invoice, LeadStage, ModuleProgress } from "@/lib/types";

const refresh = () => revalidatePath("/", "layout");

// ---- generic save / delete for master-data style tables ---------------------------------
export async function saveRowAction(table: TableName, form: FormData) {
  await requireStaff();
  if (!EDITABLE[table]) throw new Error("Not allowed");
  await (await getRepo()).save(table, Object.fromEntries(form));
  refresh();
}

export async function deleteRowAction(table: TableName, id: string) {
  await requireStaff();
  if (!EDITABLE[table]) throw new Error("Not allowed");
  await (await getRepo()).remove(table, id);
  refresh();
}

// ---- leads -------------------------------------------------------------------------------
export async function addLeadAction(form: FormData) {
  // One place for lead creation (duplicate check, allocation and history).
  const { addLeadAction: add } = await import("./leads/actions");
  return add(form);
}

export async function moveLeadAction(id: string, stage: LeadStage) {
  const me = await requireStaff();
  await (await getRepo()).moveLead(id, stage, me.name);
  refresh();
}

export async function leadActivityAction(id: string, form: FormData) {
  const me = await requireStaff();
  const kind = String(form.get("kind") || "call");
  const summary = String(form.get("summary") || "").trim();
  if (summary.length < 2) throw new Error("Write what happened");
  const repo = await getRepo();
  await repo.addLeadActivity(id, kind, summary, String(form.get("outcome") || "") || null, me.name);
  const next = String(form.get("next_follow_up") || "");
  const note = String(form.get("follow_up_note") || "");
  const { getStore } = await import("@/lib/session");
  if (next) await (await getStore()).update("leads", { id }, { next_follow_up: new Date(next).toISOString(), follow_up_note: note || null });
  refresh();
}

export async function updateLeadAction(id: string, form: FormData) {
  await requireStaff();
  const pick = (k: string) => String(form.get(k) ?? "").trim() || null;
  const { getStore } = await import("@/lib/session");
  await (await getStore()).update("leads", { id }, {
    phone: pick("phone"), email: pick("email"), city: pick("city"), course_code: pick("course_code"),
    batch_pref: pick("batch_pref"), mode_pref: pick("mode_pref"), fee_plan: pick("fee_plan"), education: pick("education"), remarks: pick("remarks"),
  });
  refresh();
}

// ---- terms & conditions (admin edits; new version each save) ---------------------------------
export async function saveTermsAction(kind: "general" | "placement", form: FormData) {
  await requireStaff();
  const title = String(form.get("title") || "").trim() || (kind === "placement" ? "MasterVLSI Placement Terms & Conditions" : "MasterVLSI Terms & Conditions");
  const items = String(form.get("items") || "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [first, ...rest] = block.split("\n");
      return { title: first.replace(/^\d+[.)]\s*/, "").trim(), body: rest.join(" ").trim() || first.trim() };
    });
  if (!items.length) throw new Error("Add at least one term");
  await (await getRepo()).saveTerms(kind, title, items);
  refresh();
}

export async function setPlacementGroupAction(studentId: string, value: "requested" | "added" | "none") {
  await requireStaff();
  await (await getRepo()).updateStudent(studentId, { placement_group: value });
  refresh();
}

// ---- brand ambassador ------------------------------------------------------------------------
const REWARD: Record<string, { amount: number; gift?: string }> = { referral: { amount: 2000 }, review: { amount: 0 }, social: { amount: 0 }, mentor: { amount: 0 }, feedback: { amount: 0 }, incident: { amount: 0 } };

export async function decideAmbassadorAction(id: string, status: AmbassadorActivity["status"], form?: FormData) {
  const me = await requireStaff();
  const repo = await getRepo();
  const row = await repo.one<AmbassadorActivity>("ambassador_activities", id);
  if (!row) return;
  const amount = form?.get("reward_amount");
  const patch: Partial<AmbassadorActivity> = { status, decided_by: me.name, decided_at: new Date().toISOString() };
  if (amount !== null && amount !== undefined && String(amount) !== "") patch.reward_amount = Number(amount);
  else if (status === "approved" && !row.reward_amount) {
    // Cash rewards come from the admin's reward settings (e.g. ₹2,000 per referral admission).
    const { createRewardsRepo } = await import("@/lib/rewards");
    const { KIND_SETTING } = await import("@/lib/types-rewards");
    const { getStore } = await import("@/lib/session");
    const setting = await createRewardsRepo(await getStore()).setting(KIND_SETTING[row.kind]);
    patch.reward_amount = setting?.reward_type === "amount" ? Number(setting.reward_amount) : (REWARD[row.kind]?.amount ?? 0);
  }
  const { getStore } = await import("@/lib/session");
  await (await getStore()).update("ambassador_activities", { id }, patch);
  // Credited rewards are paid out from Accounts.
  if (status === "credited" && Number(patch.reward_amount ?? row.reward_amount) > 0)
    await repo.addFinanceEntry({ kind: "expense", category: "Ambassador rewards", amount: Number(patch.reward_amount ?? row.reward_amount), entry_date: todayISO(), vendor_id: null, reference: `AMB-${id.slice(0, 8)}`, note: row.details });
  // Verified activities can complete a goodie (e.g. 4 feedbacks, 10,000 social activities, a verified incident).
  {
    const { createRewardsRepo } = await import("@/lib/rewards");
    const { getStore: store } = await import("@/lib/session");
    await createRewardsRepo(await store()).syncGoodies(row.student_id);
  }
  refresh();
}

export async function addAmbassadorAction(form: FormData) {
  await requireStaff();
  const a = z
    .object({ student_id: z.string().min(1), kind: z.enum(["referral", "review", "social", "mentor", "feedback", "incident"]), details: z.string().trim().min(3) })
    .parse(Object.fromEntries(form));
  // An empty reward box means "use the standard reward for this activity" (₹2,000 referral, ₹100 social, ₹1,000 mentor; reviews earn gifts).
  const typed = String(form.get("reward_amount") ?? "").trim();
  const reward_amount = typed === "" ? REWARD[a.kind].amount : Math.max(0, Number(typed) || 0);
  const { getStore } = await import("@/lib/session");
  await (await getStore()).insert("ambassador_activities", [{ ...a, reward_amount, gift: REWARD[a.kind].gift ?? null, status: "approved", created_at: new Date().toISOString() }]);
  refresh();
}

// ---- learning ----------------------------------------------------------------------------------
export async function saveProgressAction(studentId: string, moduleId: string, form: FormData) {
  await requireStaff();
  const videos = Number(form.get("videos_done") || 0);
  const score = String(form.get("test_score") ?? "");
  const max = String(form.get("test_max") ?? "");
  const { getStore } = await import("@/lib/session");
  await (await getStore()).upsert<ModuleProgress>("module_progress", [{
    student_id: studentId, module_id: moduleId, videos_done: Math.max(0, videos),
    test_score: score === "" ? null : Number(score), test_max: max === "" ? null : Number(max), updated_at: new Date().toISOString(),
  }], "student_id,module_id");
  if (score !== "" && max !== "") {
    const repo = await getRepo();
    const m = await repo.one<{ name: string }>("course_modules", moduleId);
    await repo.save("assessments", { student_id: studentId, module_id: moduleId, title: `Module test — ${m?.name ?? ""}`, marks: score, max_marks: max, taken_on: todayISO() });
  }
  refresh();
}

// ---- Enrich Silicon ----------------------------------------------------------------------------
export async function addInvoiceAction(form: FormData) {
  await requireStaff();
  const i = z
    .object({ company: z.enum(["mastervlsi", "enrich"]), client_id: z.string().min(1), issue_date: z.string().min(10), description: z.string().optional(), amount: z.coerce.number().positive(), gst_pct: z.coerce.number().min(0).max(28), tds_pct: z.coerce.number().min(0).max(30).default(0) })
    .parse(Object.fromEntries(form));
  const repo = await getRepo();
  const { getStore } = await import("@/lib/session");
  await (await getStore()).insert<Invoice>("invoices", [{ ...i, invoice_no: await repo.nextInvoiceNo(i.company), status: "unpaid", created_at: new Date().toISOString() } as Partial<Invoice>]);
  refresh();
}

export async function markInvoicePaidAction(id: string) {
  await requireStaff();
  const repo = await getRepo();
  const inv = await repo.one<Invoice>("invoices", id);
  if (!inv || inv.status === "paid") return;
  const { getStore } = await import("@/lib/session");
  await (await getStore()).update("invoices", { id }, { status: "paid", paid_on: todayISO() });
  await repo.addFinanceEntry({ kind: "income", category: "Client invoice", amount: Number(inv.amount) * (1 + Number(inv.gst_pct) / 100 - Number(inv.tds_pct ?? 0) / 100), entry_date: todayISO(), vendor_id: null, reference: inv.invoice_no, note: inv.description ?? null, company: inv.company } as Parameters<typeof repo.addFinanceEntry>[0]);
  refresh();
}

export async function hireStudentAction(form: FormData) {
  await requireStaff();
  const { student_id, designation, salary } = z
    .object({ student_id: z.string().min(1), designation: z.string().trim().min(2), salary: z.coerce.number().min(0) })
    .parse(Object.fromEntries(form));
  const repo = await getRepo();
  const p = await repo.profile(student_id);
  if (!p) throw new Error("Student not found");
  await repo.hireStudent(p.student, designation, salary);
  refresh();
}

// ---- alerts --------------------------------------------------------------------------------------
export async function runAlertsAction() {
  await requireStaff();
  const res = await (await getRepo()).runAlerts();
  refresh();
  return res;
}

export async function resolveAlertAction(id: string, form: FormData) {
  await requireStaff();
  await (await getRepo()).resolveAlert(id, String(form.get("note") || "") || null);
  refresh();
}

// ---- fee reminders -------------------------------------------------------------------------------
export type ReminderResult = { ok: boolean; message: string; links?: { name: string; url: string }[] };

export async function feeReminderAction(_: unknown, form: FormData): Promise<ReminderResult> {
  await requireStaff();
  const channel = (String(form.get("channel") || "whatsapp") as "whatsapp" | "email" | "sms");
  const scope = String(form.get("scope") || "overdue");
  const studentId = String(form.get("student_id") || "");
  const { sendFeeReminders } = await import("@/lib/reminders");
  const res = await sendFeeReminders(await getRepo(), { channel, scope: scope as "overdue" | "due_soon", studentId: studentId || undefined });
  refresh();
  return res;
}

// ---- import (CSV) ---------------------------------------------------------------------------------
export type ImportResult = { ok: boolean; message: string; errors?: string[] };

export async function importCsvAction(_: unknown, form: FormData): Promise<ImportResult> {
  await requireStaff();
  const kind = String(form.get("kind") || "leads");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, message: "Choose a CSV file." };
  if (file.size > 2_000_000) return { ok: false, message: "File is larger than 2 MB." };
  const { parseCsv } = await import("@/lib/csv");
  const rows = parseCsv(await file.text());
  if (!rows.length) return { ok: false, message: "No rows found. The first line must be the column headings." };
  const repo = await getRepo();
  const { createHrRepo } = await import("@/lib/hr");
  const { getStore } = await import("@/lib/session");
  const hrRepo = createHrRepo(await getStore());
  const by = (await requireStaff()).name;
  const errors: string[] = [];
  let created = 0;
  const courses = await repo.courses();
  for (const [n, r] of rows.entries()) {
    const line = n + 2;
    const name = r.full_name || r.name;
    if (!name) { errors.push(`Line ${line}: name is missing`); continue; }
    try {
      if (kind === "colleges") {
        await repo.save("colleges", { name, code: r.code, city: r.city, state: r.state, affiliation: r.affiliation, college_type: r.type || r.college_type, status: ["partner", "prospect", "inactive"].includes(r.status) ? r.status : "partner" });
      } else if (kind === "hr_contacts") {
        // Bulk import runs the same duplicate check and HR-code issuance as the
        // registration form, so a spreadsheet cannot create a second record for
        // someone already on file.
        const res = await hrRepo.create({
          full_name: name, designation: r.designation || null, department: r.department || null,
          phone: r.phone || null, email: r.email || null, personal_email: r.personal_email || null,
          linkedin: r.linkedin || null, city: r.city || null,
          current_company: r.company || r.current_company || null, company_type: r.company_type || null,
          joined_on: /^\d{4}-\d{2}-\d{2}$/.test(r.joined_on ?? "") ? r.joined_on : null,
          source: r.source || "bulk_upload", introduced_by: r.introduced_by || null, assigned_to: r.assigned_to || null,
        }, by, { allowDuplicate: false });
        if (!res.ok) throw new Error(`already on file as ${res.duplicates[0].hr.hr_code ?? res.duplicates[0].hr.full_name} (matched on ${res.duplicates[0].on.join(", ")})`);
      } else if (kind === "leads") {
        await repo.createLead({ full_name: name, phone: r.phone || null, email: r.email || null, city: r.city || null, source: r.source || "Import", course_code: r.course || r.course_code || null, remarks: r.remarks || null });
      } else {
        const course = courses.find((c) => c.code.toLowerCase() === (r.course || r.course_code || "").toLowerCase()) ?? courses[0];
        if (!course) throw new Error("no course");
        await repo.createStudent({
          full_name: name, email: r.email || undefined, phone: r.phone || undefined, gender: r.gender || undefined, course_id: course.id,
          training_mode: (["online", "offline", "hybrid"].includes(r.mode) ? r.mode : "hybrid") as "online" | "offline" | "hybrid",
          admission_date: /^\d{4}-\d{2}-\d{2}$/.test(r.admission_date ?? "") ? r.admission_date : todayISO(),
          total_fee: Number(r.fee || course.fee), city: r.city || undefined, state: r.state || undefined, lead_source: "Import",
          category: (["normal", "college", "corporate"].includes(r.category) ? r.category : "normal") as "normal" | "college" | "corporate",
          allocations: [],
        });
      }
      created++;
    } catch (e) {
      errors.push(`Line ${line}: ${String(e instanceof Error ? e.message : e).slice(0, 120)}`);
    }
  }
  refresh();
  return { ok: created > 0, message: `Imported ${created} of ${rows.length} ${kind}.`, errors: errors.slice(0, 20) };
}


// ---- MoU signed copies ------------------------------------------------------------------------
export async function uploadMouAction(mouId: string, form: FormData) {
  await requireStaff();
  const file = form.get("file");
  const st = await import("@/lib/storage");
  if (!(file instanceof File) || !file.size) throw new Error("Choose the signed MoU file");
  if (file.size > st.MAX_UPLOAD_BYTES) throw new Error("Files must be 5 MB or smaller");
  if (!st.ALLOWED_TYPES[file.type]) throw new Error("Upload a PDF, image or Word file");
  const path = `mou/${mouId}/${Date.now()}-${st.safeFileName(file.name)}`;
  await st.putFile(path, file);
  const { getStore } = await import("@/lib/session");
  await (await getStore()).update("mous", { id: mouId }, { document_path: path });
  refresh();
}

// ---- college (TPO) portal logins --------------------------------------------------------------
export type LoginResult = { ok: true; email: string; password: string } | { ok: false; message: string };

export async function collegeLoginAction(tpoId: string): Promise<LoginResult> {
  const me = await requireStaff();
  if (me.role !== "admin" && me.role !== "super_admin") return { ok: false, message: "Only admins can create college logins." };
  const { isSupabaseConfigured, supabaseAdmin } = await import("@/lib/supabase/clients");
  if (!isSupabaseConfigured()) return { ok: false, message: "Demo mode: sign in as the TPO from the login page persona list." };
  const repo = await getRepo();
  const tpo = await repo.one<{ id: string; college_id: string; name: string; email?: string | null }>("tpo_contacts", tpoId);
  const email = tpo?.email?.trim().toLowerCase();
  if (!tpo || !email) return { ok: false, message: "Add the TPO's email first." };
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const password = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => alphabet[b % alphabet.length]).join("");
  const admin = supabaseAdmin();
  const { data: existing } = await admin.from("college_logins").select("user_id").eq("tpo_id", tpoId).maybeSingle();
  let userId = existing?.user_id as string | undefined;
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return { ok: false, message: error.message };
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: tpo.name } });
    if (error || !data.user) return { ok: false, message: error?.message ?? "Could not create the login" };
    userId = data.user.id;
    await admin.from("profiles").update({ role: "college", full_name: tpo.name }).eq("id", userId);
    await admin.from("college_logins").insert({ user_id: userId, college_id: tpo.college_id, tpo_id: tpoId });
  }
  return { ok: true, email, password };
}

// ---- company legal profiles ---------------------------------------------------------------------
export async function saveCompanyProfileAction(form: FormData) {
  await requireStaff();
  await (await getRepo()).saveCompanyProfile(Object.fromEntries(form));
  refresh();
}

// ---- assignments: grading ------------------------------------------------------------------------
export async function gradeSubmissionAction(id: string, form: FormData) {
  await requireStaff();
  const marks = String(form.get("marks") ?? "");
  const status = form.get("status") === "resubmit" ? "resubmit" : "graded";
  const { getStore } = await import("@/lib/session");
  await (await getStore()).update("assignment_submissions", { id }, { marks: marks === "" ? null : Number(marks), feedback: String(form.get("feedback") || "") || null, status });
  refresh();
}

export async function toggleMilestoneAction(id: string, done: boolean) {
  await requireStaff();
  const { getStore } = await import("@/lib/session");
  await (await getStore()).update("project_milestones", { id }, { done, done_on: done ? todayISO() : null });
  refresh();
}
