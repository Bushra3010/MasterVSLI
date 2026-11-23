"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireFinance } from "@/lib/session";
import { getFinance } from "@/lib/server";
import type { Entity } from "@/lib/types-finance";

const refresh = () => revalidatePath("/finance", "layout");
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string) => s(f, k) || null;
const num = (f: FormData, k: string) => (s(f, k) ? Number(s(f, k)) : 0);
const entity = z.enum(["mastervlsi", "enrich", "property"]);
export type ActionResult = { ok: boolean; message: string } | null;
const fail = (e: unknown): ActionResult => ({ ok: false, message: e instanceof Error ? e.message : "Something went wrong" });

// ---- generic master rows (accounts, properties, units, tenants, budgets, recurring) ------------------
const MASTER: Record<string, string[]> = {
  fin_accounts: ["entity", "name", "kind", "bank_name", "account_no", "ifsc", "opening_balance", "active"],
  properties: ["name", "address", "city", "notes"],
  property_units: ["property_id", "code", "unit_type", "floor", "area_sqft", "status"],
  tenants: ["full_name", "phone", "alt_phone", "email", "id_proof_type", "id_proof_no", "occupation", "family_members", "permanent_address", "emergency_name", "emergency_phone", "kyc_verified", "police_verified", "notes"],
  tenancies: ["agreement_no", "start_date", "end_date", "monthly_rent", "due_day", "maintenance_charge", "security_deposit", "escalation_pct", "notice_days", "status", "exit_date"],
  budgets: ["entity", "category", "month", "amount"],
  recurring_payments: ["entity", "category", "vendor_id", "payee", "description", "amount", "frequency", "next_due", "active"],
};
const NUM = new Set(["opening_balance", "area_sqft", "family_members", "monthly_rent", "due_day", "maintenance_charge", "security_deposit", "escalation_pct", "notice_days", "amount"]);
const BOOL = new Set(["active", "kyc_verified", "police_verified"]);

export async function saveFinanceRow(table: string, form: FormData) {
  await requireFinance();
  const cols = MASTER[table];
  if (!cols) throw new Error("Not allowed");
  const row: Record<string, unknown> = {};
  for (const c of cols) {
    if (BOOL.has(c)) row[c] = form.get(c) === "on" || form.get(c) === "true";
    else if (!form.has(c)) continue;
    else if (NUM.has(c)) row[c] = s(form, c) === "" ? null : Number(s(form, c));
    else row[c] = opt(form, c);
  }
  const { getStore } = await import("@/lib/session");
  const db = await getStore();
  const id = s(form, "id");
  if (id) await db.update(table as never, { id }, row);
  else {
    if (table === "budgets") {
      // one budget per entity / category / month
      await db.upsert(table as never, [row], "entity,category,month");
    } else await db.insert(table as never, [{ ...row, created_at: new Date().toISOString() }]);
  }
  refresh();
}

// ---- tenants & rent -------------------------------------------------------------------------------------
export async function addTenantAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireFinance();
  let id = "";
  try {
    if (!s(form, "full_name") || !(num(form, "monthly_rent") > 0) || !s(form, "unit_id") || !s(form, "start_date")) throw new Error("Unit, tenant name, start date and monthly rent are required");
    const fin = await getFinance();
    const t = await fin.addTenant(
      {
        full_name: s(form, "full_name"), phone: opt(form, "phone"), email: opt(form, "email"), id_proof_type: opt(form, "id_proof_type"), id_proof_no: opt(form, "id_proof_no"),
        occupation: opt(form, "occupation"), family_members: num(form, "family_members") || null, permanent_address: opt(form, "permanent_address"),
        emergency_name: opt(form, "emergency_name"), emergency_phone: opt(form, "emergency_phone"), kyc_verified: form.get("kyc_verified") === "on", police_verified: form.get("police_verified") === "on",
      },
      {
        unit_id: s(form, "unit_id"), agreement_no: opt(form, "agreement_no"), start_date: s(form, "start_date"), end_date: opt(form, "end_date"),
        monthly_rent: num(form, "monthly_rent"), due_day: num(form, "due_day") || 5, maintenance_charge: num(form, "maintenance_charge"), security_deposit: num(form, "security_deposit"),
        escalation_pct: num(form, "escalation_pct"), notice_days: num(form, "notice_days") || 30,
      },
    );
    if (num(form, "deposit_received") > 0)
      await fin.recordTenantPayment({ tenancy_id: t.id, kind: "deposit", amount: num(form, "deposit_received"), mode: s(form, "deposit_mode") || "Bank transfer", paid_on: s(form, "start_date"), account_id: s(form, "deposit_account").replace(/^account:/, "") || null });
    id = t.id;
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(`/finance/tenants/${id}`);
}

export async function tenantPaymentAction(tenancyId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  await requireFinance();
  try {
    const ref = s(form, "account");
    await (await getFinance()).recordTenantPayment({
      tenancy_id: tenancyId, kind: (s(form, "kind") || "rent") as never, amount: num(form, "amount"), mode: s(form, "mode") || "UPI",
      reference: opt(form, "reference"), paid_on: s(form, "paid_on"), account_id: ref.startsWith("account:") ? ref.slice(8) : null,
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Payment recorded and applied to the oldest dues." };
}

export async function utilityBillAction(tenancyId: string, unitId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireFinance();
  try {
    const prev = s(form, "prev_reading"), curr = s(form, "curr_reading");
    await (await getFinance()).addUtilityBill(
      {
        unit_id: unitId, tenancy_id: tenancyId || null, utility: (s(form, "utility") || "electricity") as never, bill_month: s(form, "bill_month"), meter_no: opt(form, "meter_no"),
        prev_reading: prev ? Number(prev) : null, curr_reading: curr ? Number(curr) : null, amount: num(form, "amount"), payer: (s(form, "payer") || "tenant") as never,
      },
      me.email ?? me.name,
    );
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Bill added." };
}

export async function maintenanceAction(unitId: string, tenancyId: string, form: FormData) {
  await requireFinance();
  const { getStore } = await import("@/lib/session");
  await (await getStore()).insert("maintenance_requests", [{
    unit_id: unitId, tenancy_id: tenancyId || null, title: s(form, "title") || "Maintenance request", category: opt(form, "category"),
    priority: s(form, "priority") || "normal", raised_on: s(form, "raised_on") || new Date().toISOString().slice(0, 10), status: "open", cost: 0, charge_to: "owner", vendor_id: opt(form, "vendor_id"), created_at: new Date().toISOString(),
  }]);
  refresh();
}

export async function maintenanceStatusAction(id: string, form: FormData) {
  const me = await requireFinance();
  const status = s(form, "status");
  if (status === "completed") await (await getFinance()).completeMaintenance(id, num(form, "cost"), (s(form, "charge_to") || "owner") as never, me.email ?? me.name);
  else {
    const { getStore } = await import("@/lib/session");
    await (await getStore()).update("maintenance_requests", { id }, { status });
  }
  refresh();
}

export async function exitTenancyAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  await requireFinance();
  try {
    const r = await (await getFinance()).exitTenancy(id, { exit_date: s(form, "exit_date"), deductions: num(form, "deductions"), note: s(form, "note"), refund_ref: s(form, "refund_ref") });
    refresh();
    return { ok: true, message: `Tenancy closed. Refund ₹${r.refund.toLocaleString("en-IN")}${r.outstandingCovered ? `, ₹${r.outstandingCovered.toLocaleString("en-IN")} of unpaid dues adjusted from the deposit` : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function noticeAction(id: string, form: FormData) {
  await requireFinance();
  const { getStore } = await import("@/lib/session");
  await (await getStore()).update("tenancies", { id }, { status: "notice", exit_date: s(form, "exit_date") || null });
  refresh();
}

export async function raiseDuesAction() {
  await requireFinance();
  const n = await (await getFinance()).raiseDues();
  refresh();
  return n;
}

// ---- expenses -------------------------------------------------------------------------------------------
export async function addExpenseAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireFinance();
  try {
    const row = await (await getFinance()).addExpense(
      {
        entity: entity.parse(s(form, "entity")), category: s(form, "category"), vendor_id: opt(form, "vendor_id"), payee: opt(form, "payee"), description: s(form, "description"),
        amount: num(form, "amount"), expense_date: s(form, "expense_date") || undefined, due_date: opt(form, "due_date"), invoice_no: opt(form, "invoice_no"), unit_id: opt(form, "unit_id"),
      },
      me.email ?? me.name,
      me.role === "super_admin",
    );
    refresh();
    return { ok: true, message: row.status === "pending_approval" ? "Saved — waiting for super-admin approval (above the approval limit)." : "Expense saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function decideExpenseAction(id: string, approve: boolean) {
  const me = await requireFinance();
  if (me.role !== "super_admin") throw new Error("Only a super admin can approve or reject expenses");
  await (await getFinance()).decideExpense(id, approve, me.email ?? me.name);
  refresh();
}

export async function generateRecurringAction() {
  const me = await requireFinance();
  const n = await (await getFinance()).generateRecurring(new Date().toISOString().slice(0, 10), me.email ?? me.name);
  refresh();
  return n;
}

// ---- payments, transfers, settlements ---------------------------------------------------------------------
export async function makePaymentAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireFinance();
  try {
    const sources = [0, 1, 2, 3].map((i) => ({ ref: s(form, `src_${i}`), amount: num(form, `amt_${i}`), tenancy_id: opt(form, `tenancy_${i}`) })).filter((x) => x.ref && x.amount > 0);
    const r = await (await getFinance()).makePayment({
      expense_id: opt(form, "expense_id"), payee: s(form, "payee"), vendor_id: opt(form, "vendor_id"), on_behalf_of: (entity.safeParse(s(form, "on_behalf_of")).data ?? "mastervlsi") as Entity,
      paid_on: s(form, "paid_on"), reference: s(form, "reference"), note: s(form, "note"), sources,
    });
    refresh();
    const extra = r.settlements.length ? ` ${r.settlements.length} inter-entity settlement${r.settlements.length > 1 ? "s" : ""} recorded.` : "";
    return { ok: true, message: `Paid ₹${Number(r.payment.total).toLocaleString("en-IN")} to ${r.payment.payee}.${extra}` };
  } catch (e) {
    return fail(e);
  }
}

export async function transferAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireFinance();
  try {
    await (await getFinance()).transfer({ from_ref: s(form, "from_ref"), to_ref: s(form, "to_ref"), amount: num(form, "amount"), transfer_date: s(form, "transfer_date"), reference: s(form, "reference"), note: s(form, "note") });
    refresh();
    return { ok: true, message: "Transfer recorded." };
  } catch (e) {
    return fail(e);
  }
}

export async function settleAction(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  await requireFinance();
  try {
    await (await getFinance()).settle(id, s(form, "from_ref"), s(form, "to_ref"), s(form, "date"));
    refresh();
    return { ok: true, message: "Settled." };
  } catch (e) {
    return fail(e);
  }
}

export async function addIncomeAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireFinance();
  try {
    const e = s(form, "entity");
    if (!["mastervlsi", "enrich"].includes(e)) throw new Error("Pick MasterVLSI or Enrich Silicon");
    if (!(num(form, "amount") > 0)) throw new Error("Amount must be more than zero");
    const ref = s(form, "account");
    const { getStore } = await import("@/lib/session");
    await (await getStore()).insert("finance_entries", [{
      kind: "income", company: e, category: s(form, "category") || "Other", amount: num(form, "amount"), entry_date: s(form, "entry_date") || new Date().toISOString().slice(0, 10),
      reference: opt(form, "reference"), note: opt(form, "note"), account_id: ref.startsWith("account:") ? ref.slice(8) : null, created_at: new Date().toISOString(),
    }]);
    refresh();
    return { ok: true, message: "Income recorded." };
  } catch (e) {
    return fail(e);
  }
}

// ---- tenant documents -----------------------------------------------------------------------------------
export async function uploadTenantDocAction(tenantId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  await requireFinance();
  const { ALLOWED_TYPES, MAX_UPLOAD_BYTES, putFile, safeFileName } = await import("@/lib/storage");
  const kind = s(form, "kind") || "other";
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "Files must be 5 MB or smaller." };
  if (!ALLOWED_TYPES[file.type]) return { ok: false, message: "Upload a PDF, JPG, PNG, WEBP or Word file." };
  try {
    const path = `tenants/${tenantId}/${kind}/${Date.now()}-${safeFileName(file.name)}`;
    await putFile(path, file);
    const { getStore } = await import("@/lib/session");
    await (await getStore()).insert("tenant_documents", [{ tenant_id: tenantId, kind, storage_path: path, verified: false, uploaded_at: new Date().toISOString() }]);
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Uploaded." };
}
