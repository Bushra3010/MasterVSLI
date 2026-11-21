"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/session";
import { getRepo } from "@/lib/server";
import { todayISO } from "@/lib/format";
import type { FinanceKind, Role, StaffAttStatus } from "@/lib/types";

const text = (form: FormData, k: string) => String(form.get(k) ?? "").trim() || null;

// ---- courses -------------------------------------------------------------------
export async function saveSyllabusAction(form: FormData) {
  await requireStaff();
  const id = String(form.get("id") || "");
  if (!id) throw new Error("Course is required");
  await (await getRepo()).saveCourse({ id, syllabus: text(form, "syllabus") });
  revalidatePath("/courses");
}

// ---- system / lab ----------------------------------------------------------------
export async function saveLabSystemAction(form: FormData) {
  await requireStaff();
  const code = text(form, "code");
  if (!code) throw new Error("System code is required");
  await (await getRepo()).saveLabSystem({
    id: text(form, "id") ?? undefined,
    code: code.toUpperCase(),
    location: text(form, "location"),
    specs: text(form, "specs"),
    teamviewer_id: text(form, "teamviewer_id"),
    notes: text(form, "notes"),
  });
  revalidatePath("/lab");
}

export async function assignLabSystemAction(form: FormData) {
  await requireStaff();
  const id = String(form.get("id"));
  await (await getRepo()).assignLabSystem(id, text(form, "student_id"));
  revalidatePath("/lab");
}

export async function setLabStatusAction(id: string, status: "available" | "maintenance") {
  await requireStaff();
  const repo = await getRepo();
  const sys = (await repo.labSystems()).find((l) => l.id === id);
  if (sys?.student_id) await repo.assignLabSystem(id, null); // clears the TeamViewer mapping
  await repo.setLabStatus(id, status);
  revalidatePath("/lab");
}

export async function removeLabSystemAction(id: string) {
  await requireStaff();
  const repo = await getRepo();
  await repo.assignLabSystem(id, null);
  await repo.removeLabSystem(id);
  revalidatePath("/lab");
}

// ---- staff & HR --------------------------------------------------------------------
export async function markStaffAttendanceAction(form: FormData) {
  await requireStaff();
  const date = String(form.get("date") || todayISO());
  const marks = [...form.entries()]
    .filter(([k, v]) => k.startsWith("att_") && v)
    .map(([k, v]) => ({ staff_id: k.slice(4), status: String(v) as StaffAttStatus }));
  await (await getRepo()).markStaffAttendance(date, marks);
  revalidatePath("/hr");
}

export async function addLeaveAction(form: FormData) {
  await requireStaff();
  const l = z
    .object({ staff_id: z.string().min(1), from_date: z.string().min(10), to_date: z.string().min(10), leave_type: z.string().min(1), reason: z.string().optional() })
    .refine((x) => x.to_date >= x.from_date, "End date is before start date")
    .parse(Object.fromEntries(form));
  await (await getRepo()).addLeave({ ...l, reason: l.reason || null });
  revalidatePath("/hr");
}

export async function decideLeaveAction(id: string, status: "approved" | "rejected") {
  await requireStaff();
  await (await getRepo()).decideLeave(id, status);
  revalidatePath("/hr");
}

export async function generatePayrollAction(form: FormData) {
  await requireStaff();
  const month = String(form.get("month") || todayISO().slice(0, 7));
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Pick a month");
  await (await getRepo()).generatePayroll(month);
  revalidatePath("/hr");
  redirect(`/hr?month=${month}${form.get("company") === "enrich" ? "&company=enrich" : ""}`);
}

export async function markPayrollPaidAction(id: string) {
  await requireStaff();
  const repo = await getRepo();
  const row = (await repo.payroll()).find((p) => p.id === id);
  if (!row || row.status === "paid") return;
  await repo.markPayrollPaid(id);
  const staff = (await repo.staff()).find((s) => s.id === row.staff_id);
  // Salary paid is booked as an expense in Accounts.
  await repo.addFinanceEntry({
    kind: "expense",
    category: "Salaries",
    amount: Number(row.net),
    entry_date: todayISO(),
    vendor_id: null,
    reference: `PAYROLL-${row.month}`,
    note: staff ? `${staff.full_name} (${staff.employee_code})` : null,
    company: staff?.company ?? "mastervlsi",
  });
  revalidatePath("/hr");
  revalidatePath("/accounts");
}

// ---- accounts & finance ---------------------------------------------------------------
export async function addFinanceEntryAction(form: FormData) {
  await requireStaff();
  const e = z
    .object({
      kind: z.enum(["income", "expense", "settlement"]),
      category: z.string().trim().min(1),
      amount: z.coerce.number().positive(),
      entry_date: z.string().min(10),
      vendor_id: z.string().optional(),
      reference: z.string().optional(),
      note: z.string().optional(),
      company: z.enum(["mastervlsi", "enrich"]).default("mastervlsi"),
    })
    .parse(Object.fromEntries(form));
  if (e.kind === "settlement" && !e.vendor_id) throw new Error("Pick the vendor being settled");
  await (await getRepo()).addFinanceEntry({
    ...e,
    kind: e.kind as FinanceKind,
    vendor_id: e.vendor_id || null,
    reference: e.reference || null,
    note: e.note || null,
  });
  revalidatePath("/accounts");
}

export async function removeFinanceEntryAction(id: string) {
  await requireStaff();
  await (await getRepo()).removeFinanceEntry(id);
  revalidatePath("/accounts");
}

// ---- communication -----------------------------------------------------------------------
export type BroadcastResult = { ok: boolean; message: string; links?: { name: string; url: string }[] };

export async function broadcastAction(_: unknown, form: FormData): Promise<BroadcastResult> {
  await requireStaff();
  const m = await import("@/lib/messaging");
  const channel = form.get("channel") === "whatsapp" ? "whatsapp" : "email";
  const audience = String(form.get("audience") || "active");
  const subject = String(form.get("subject") || "").trim();
  const body = String(form.get("body") || "").trim();
  if (body.length < 3) return { ok: false, message: "Write a message first." };
  if (channel === "email" && !subject) return { ok: false, message: "Email needs a subject." };

  const repo = await getRepo();
  const targets = m.pickAudience(await repo.students(), audience);
  const reachable = targets.filter((s) => (channel === "email" ? s.email : m.waNumber(s.phone)));
  const configured = channel === "email" ? m.emailConfigured() : m.whatsappConfigured();

  let sent = 0;
  if (configured) {
    for (const s of reachable) {
      try {
        const msg = m.personalize(body, s);
        if (channel === "email") await m.sendEmail(s.email!, m.personalize(subject, s), msg);
        else await m.sendWhatsApp(m.waNumber(s.phone)!, msg);
        sent++;
      } catch {
        /* counted as failed below */
      }
    }
  }
  const batches = await repo.batches();
  const label = audience.startsWith("batch:") ? `Batch ${batches.find((b) => b.id === audience.slice(6))?.name ?? ""}` : m.AUDIENCES[audience] ?? audience;
  await repo.logMessage({
    channel,
    audience: label,
    subject: subject || null,
    body,
    recipients: reachable.length,
    sent,
    status: configured ? (sent === reachable.length ? "sent" : `${reachable.length - sent} failed`) : "not configured",
  });
  revalidatePath("/communication");

  if (!configured) {
    const links =
      channel === "whatsapp"
        ? reachable.map((s) => ({ name: s.full_name, url: `https://wa.me/${m.waNumber(s.phone)}?text=${encodeURIComponent(m.personalize(body, s))}` }))
        : undefined;
    return {
      ok: false,
      message:
        channel === "email"
          ? `Logged for ${reachable.length} students, but email isn't set up (RESEND_API_KEY / NOTIFY_FROM), so nothing was sent.`
          : `WhatsApp API isn't set up (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID). Use the click-to-chat links below for ${reachable.length} students.`,
      links,
    };
  }
  return { ok: sent > 0, message: `Sent to ${sent} of ${reachable.length} students (${targets.length - reachable.length} had no ${channel === "email" ? "email" : "mobile number"}).` };
}

// ---- users & roles (admins only) ------------------------------------------------------
export async function setRoleAction(form: FormData) {
  const me = await requireStaff();
  if (me.role !== "admin" && me.role !== "super_admin") throw new Error("Only admins can change roles");
  const id = String(form.get("id") || "");
  const role = String(form.get("role")) as Role;
  if (!["super_admin", "admin", "staff", "student"].includes(role)) throw new Error("Invalid role");
  if (role === "super_admin" && me.role !== "super_admin") throw new Error("Only a super admin can create another super admin");
  if (id === me.userId) throw new Error("You can't change your own role");
  await (await getRepo()).setRole(id, role);
  revalidatePath("/access");
}

// ---- website enquiries --------------------------------------------------------------------
export async function setEnquiryStatusAction(id: string, status: "contacted" | "closed" | "new") {
  await requireStaff();
  await (await getRepo()).setEnquiry(id, { status });
  revalidatePath("/students");
}

// ---- online payments (staff confirm UPI) ------------------------------------------------------
export async function confirmPaymentRequestAction(id: string, form: FormData) {
  await requireStaff();
  const ref = String(form.get("reference") || "").trim();
  if (ref.length < 4) throw new Error("Enter the UPI transaction / UTR number");
  await (await getRepo()).completePaymentRequest(id, ref, "UPI");
  revalidatePath("/", "layout");
}

export async function cancelPaymentRequestAction(id: string) {
  await requireStaff();
  const { getStore } = await import("@/lib/session");
  await (await getStore()).update("payment_requests", { id }, { status: "cancelled" });
  revalidatePath("/fees");
}

// ---- staff self-service ("Staff app") -------------------------------------------------------
async function myStaff() {
  const me = await requireStaff();
  const repo = await getRepo();
  const staff = (await repo.staffForUser(me.userId, me.email)) ?? (me.demo ? (await repo.staff())[0] : null);
  if (!staff) throw new Error("Your login isn't linked to a staff record yet. Ask an admin to add your email in Staff & HR.");
  return { repo, staff };
}

export async function checkInAction() {
  const { repo, staff } = await myStaff();
  await repo.markStaffAttendance(todayISO(), [{ staff_id: staff.id, status: "present" }]);
  revalidatePath("/me");
  revalidatePath("/hr");
}

export async function addTaskAction(form: FormData) {
  const title = String(form.get("title") || "").trim();
  if (title.length < 2) throw new Error("Write the task");
  const due_date = String(form.get("due_date") || "") || null;
  const assignee = String(form.get("staff_id") || "");
  if (assignee) {
    await requireStaff();
    await (await getRepo()).addTask({ staff_id: assignee, title, due_date });
  } else {
    const { repo, staff } = await myStaff();
    await repo.addTask({ staff_id: staff.id, title, due_date });
  }
  revalidatePath("/me");
  revalidatePath("/hr");
}

export async function toggleTaskAction(id: string, done: boolean) {
  await requireStaff();
  await (await getRepo()).setTaskDone(id, done);
  revalidatePath("/me");
  revalidatePath("/hr");
}

export async function removeTaskAction(id: string) {
  await requireStaff();
  await (await getRepo()).removeTask(id);
  revalidatePath("/me");
  revalidatePath("/hr");
}

export async function applyLeaveAction(form: FormData) {
  const { repo, staff } = await myStaff();
  const l = z
    .object({ from_date: z.string().min(10), to_date: z.string().min(10), leave_type: z.string().min(1), reason: z.string().optional() })
    .refine((x) => x.to_date >= x.from_date, "End date is before start date")
    .parse(Object.fromEntries(form));
  await repo.addLeave({ staff_id: staff.id, ...l, reason: l.reason || null });
  revalidatePath("/me");
  revalidatePath("/hr");
}
