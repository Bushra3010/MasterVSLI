"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  const me = await requireStaff();
  const l = z
    .object({
      full_name: z.string().trim().min(2),
      phone: z.string().trim().optional(),
      email: z.string().trim().email().optional().or(z.literal("")),
      city: z.string().optional(),
      source: z.string().min(1),
      course_code: z.string().optional(),
      assigned_to: z.string().optional(),
      remarks: z.string().optional(),
    })
    .parse(Object.fromEntries(form));
  const lead = await (await getRepo()).createLead({ ...l, email: l.email || null, assigned_to: l.assigned_to || me.name });
  refresh();
  redirect(`/leads?id=${lead.id}`);
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
    phone: pick("phone"), email: pick("email"), city: pick("city"), course_code: pick("course_code"), assigned_to: pick("assigned_to"),
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
const REWARD: Record<string, { amount: number; gift?: string }> = { referral: { amount: 2000 }, review: { amount: 0, gift: "Gift on every 3 reviews" }, social: { amount: 100 }, mentor: { amount: 1000 } };

export async function decideAmbassadorAction(id: string, status: AmbassadorActivity["status"], form?: FormData) {
  await requireStaff();
  const repo = await getRepo();
  const row = await repo.one<AmbassadorActivity>("ambassador_activities", id);
  if (!row) return;
  const amount = form?.get("reward_amount");
  const patch: Partial<AmbassadorActivity> = { status };
  if (amount !== null && amount !== undefined && String(amount) !== "") patch.reward_amount = Number(amount);
  else if (status === "approved" && !row.reward_amount) patch.reward_amount = REWARD[row.kind]?.amount ?? 0;
  const { getStore } = await import("@/lib/session");
  await (await getStore()).update("ambassador_activities", { id }, patch);
  // Credited rewards are paid out from Accounts.
  if (status === "credited" && Number(patch.reward_amount ?? row.reward_amount) > 0)
    await repo.addFinanceEntry({ kind: "expense", category: "Ambassador rewards", amount: Number(patch.reward_amount ?? row.reward_amount), entry_date: todayISO(), vendor_id: null, reference: `AMB-${id.slice(0, 8)}`, note: row.details });
  refresh();
}

export async function addAmbassadorAction(form: FormData) {
  await requireStaff();
  const a = z
    .object({ student_id: z.string().min(1), kind: z.enum(["referral", "review", "social", "mentor"]), details: z.string().trim().min(3), reward_amount: z.coerce.number().min(0).optional() })
    .parse(Object.fromEntries(form));
  const { getStore } = await import("@/lib/session");
  await (await getStore()).insert("ambassador_activities", [{ ...a, reward_amount: a.reward_amount ?? REWARD[a.kind].amount, status: "approved", created_at: new Date().toISOString() }]);
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
    .object({ company: z.enum(["mastervlsi", "enrich"]), client_id: z.string().min(1), issue_date: z.string().min(10), description: z.string().optional(), amount: z.coerce.number().positive(), gst_pct: z.coerce.number().min(0).max(28) })
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
  await repo.addFinanceEntry({ kind: "income", category: "Client invoice", amount: Number(inv.amount) * (1 + Number(inv.gst_pct) / 100), entry_date: todayISO(), vendor_id: null, reference: inv.invoice_no, note: inv.description ?? null, company: inv.company } as Parameters<typeof repo.addFinanceEntry>[0]);
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
  const errors: string[] = [];
  let created = 0;
  const courses = await repo.courses();
  for (const [n, r] of rows.entries()) {
    const line = n + 2;
    const name = r.full_name || r.name;
    if (!name) { errors.push(`Line ${line}: name is missing`); continue; }
    try {
      if (kind === "leads") {
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

