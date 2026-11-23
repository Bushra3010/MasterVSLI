import "server-only";
import { addDays, addMonths, todayISO } from "./format";
import type { Store } from "./store/types";
import type { FinanceEntry, Installment, Invoice, Payment, PayrollRow, Staff, Student, Vendor } from "./types";
import {
  APPROVAL_THRESHOLD,
  type Budget,
  type Entity,
  type Expense,
  type FinAccount,
  type FundPayment,
  type FundTransfer,
  type MaintenanceRequest,
  type PaymentSource,
  type Property,
  type PropertyUnit,
  type RecurringPayment,
  type RentDue,
  type Settlement,
  type Tenancy,
  type Tenant,
  type TenantDocument,
  type TenantPayment,
  type UtilityBill,
} from "./types-finance";

export interface FinanceData {
  today: string;
  accounts: FinAccount[];
  properties: Property[];
  units: PropertyUnit[];
  tenants: Tenant[];
  tenancies: Tenancy[];
  dues: RentDue[];
  tenantPayments: TenantPayment[];
  bills: UtilityBill[];
  maintenance: MaintenanceRequest[];
  tenantDocs: TenantDocument[];
  recurring: RecurringPayment[];
  expenses: Expense[];
  fundPayments: FundPayment[];
  sources: PaymentSource[];
  settlements: Settlement[];
  transfers: FundTransfer[];
  budgets: Budget[];
  vendors: Vendor[];
  feePayments: Payment[];
  installments: Installment[];
  invoices: Invoice[];
  entries: FinanceEntry[];
  payroll: PayrollRow[];
  staff: Staff[];
  students: Student[];
}

const n = (v: unknown) => Number(v ?? 0);
export const monthOf = (iso?: string | null) => (iso ?? "").slice(0, 7);

// ---------------------------------------------------------------------------------------------
// Money refs: account:<id> | pool:rent | pool:fees
// ---------------------------------------------------------------------------------------------
export const POOLS = { rent: "pool:rent", fees: "pool:fees" } as const;

export function refEntity(ref: string, accounts: FinAccount[]): Entity | null {
  if (ref === POOLS.rent) return "property";
  if (ref === POOLS.fees) return "mastervlsi";
  return accounts.find((a) => `account:${a.id}` === ref)?.entity ?? null;
}

export function refLabel(ref: string, accounts: FinAccount[]) {
  if (ref === POOLS.rent) return "Rent collections (not yet banked)";
  if (ref === POOLS.fees) return "Student fee collections (not yet banked)";
  return accounts.find((a) => `account:${a.id}` === ref)?.name ?? ref;
}

export interface Movement {
  date: string;
  label: string;
  inflow: number;
  outflow: number;
}

/** Every money movement for one ref, oldest first. */
export function movements(d: FinanceData, ref: string): Movement[] {
  const out: Movement[] = [];
  const accountId = ref.startsWith("account:") ? ref.slice(8) : null;
  const acc = d.accounts.find((a) => a.id === accountId);
  if (acc && n(acc.opening_balance)) out.push({ date: "0000-00-00", label: "Opening balance", inflow: n(acc.opening_balance), outflow: 0 });

  const tenancyLabel = (id: string) => {
    const t = d.tenancies.find((x) => x.id === id);
    const unit = d.units.find((u) => u.id === t?.unit_id);
    const tenant = d.tenants.find((x) => x.id === t?.tenant_id);
    return `${unit?.code ?? "Unit"} · ${tenant?.full_name ?? "tenant"}`;
  };
  for (const p of d.tenantPayments) {
    const lands = p.account_id ? `account:${p.account_id}` : POOLS.rent;
    if (lands !== ref) continue;
    if (p.kind === "refund") out.push({ date: p.paid_on, label: `Deposit refund — ${tenancyLabel(p.tenancy_id)}`, inflow: 0, outflow: n(p.amount) });
    else out.push({ date: p.paid_on, label: `${p.kind === "deposit" ? "Security deposit" : "Rent"} — ${tenancyLabel(p.tenancy_id)}`, inflow: n(p.amount), outflow: 0 });
  }
  if (ref === POOLS.fees)
    for (const p of d.feePayments) {
      if ((p as Payment & { account_id?: string | null }).account_id) continue;
      out.push({ date: p.paid_at.slice(0, 10), label: `Student fee — ${d.students.find((s) => s.id === p.student_id)?.full_name ?? "student"}`, inflow: n(p.amount), outflow: 0 });
    }
  for (const e of d.entries) {
    if (!e.account_id || `account:${e.account_id}` !== ref) continue;
    const inflow = e.kind === "income";
    out.push({ date: e.entry_date, label: `${inflow ? "Income" : "Expense"} — ${e.category}${e.note ? ` (${e.note})` : ""}`, inflow: inflow ? n(e.amount) : 0, outflow: inflow ? 0 : n(e.amount) });
  }
  for (const s of d.sources) {
    if (s.source_ref !== ref) continue;
    const p = d.fundPayments.find((x) => x.id === s.payment_id);
    out.push({ date: p?.paid_on ?? "", label: `Payment to ${p?.payee ?? "payee"}${p?.reference ? ` (${p.reference})` : ""}`, inflow: 0, outflow: n(s.amount) });
  }
  for (const t of d.transfers) {
    if (t.to_ref === ref) out.push({ date: t.transfer_date, label: `Transfer in from ${refLabel(t.from_ref, d.accounts)}`, inflow: n(t.amount), outflow: 0 });
    if (t.from_ref === ref) out.push({ date: t.transfer_date, label: `Transfer out to ${refLabel(t.to_ref, d.accounts)}`, inflow: 0, outflow: n(t.amount) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const balanceOf = (d: FinanceData, ref: string) => movements(d, ref).reduce((a, m) => a + m.inflow - m.outflow, 0);

/** Every account plus the two "collected but not banked" pools, with balances. */
export function balanceSheet(d: FinanceData) {
  const rows = d.accounts
    .filter((a) => a.active)
    .map((a) => ({ ref: `account:${a.id}`, label: a.name, entity: a.entity, kind: a.kind as string, balance: balanceOf(d, `account:${a.id}`) }));
  rows.push({ ref: POOLS.fees, label: refLabel(POOLS.fees, d.accounts), entity: "mastervlsi", kind: "pool", balance: balanceOf(d, POOLS.fees) });
  rows.push({ ref: POOLS.rent, label: refLabel(POOLS.rent, d.accounts), entity: "property", kind: "pool", balance: balanceOf(d, POOLS.rent) });
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Income & expense (cash basis for income, accrual by expense date for expenses)
// ---------------------------------------------------------------------------------------------
export interface Line {
  entity: Entity;
  date: string;
  amount: number;
  category: string;
  label: string;
}

export function incomeLines(d: FinanceData): Line[] {
  const out: Line[] = [];
  for (const p of d.feePayments) out.push({ entity: "mastervlsi", date: p.paid_at.slice(0, 10), amount: n(p.amount), category: "Student fees", label: d.students.find((s) => s.id === p.student_id)?.full_name ?? "Student fee" });
  for (const i of d.invoices)
    if (i.status === "paid") out.push({ entity: i.company === "mastervlsi" ? "mastervlsi" : "enrich", date: i.paid_on ?? i.issue_date, amount: n(i.amount), category: "Projects & services", label: `Invoice ${i.invoice_no}` });
  for (const e of d.entries)
    if (e.kind === "income") out.push({ entity: e.company === "enrich" ? "enrich" : "mastervlsi", date: e.entry_date, amount: n(e.amount), category: e.category, label: e.note || e.category });
  for (const p of d.tenantPayments)
    if (!["deposit", "refund"].includes(p.kind)) {
      const t = d.tenancies.find((x) => x.id === p.tenancy_id);
      out.push({ entity: "property", date: p.paid_on, amount: n(p.amount), category: p.kind === "rent" ? "Rent" : p.kind === "utility" ? "Utilities recovered" : p.kind === "maintenance" ? "Maintenance recovered" : "Other", label: d.units.find((u) => u.id === t?.unit_id)?.code ?? "Rent" });
    }
  return out;
}

export function expenseLines(d: FinanceData): Line[] {
  const out: Line[] = [];
  for (const e of d.expenses)
    if (e.status !== "rejected" && e.status !== "pending_approval") out.push({ entity: e.entity, date: e.expense_date, amount: n(e.amount), category: e.category, label: e.description });
  for (const e of d.entries)
    if (e.kind === "expense" || e.kind === "settlement")
      out.push({ entity: e.company === "enrich" ? "enrich" : "mastervlsi", date: e.entry_date, amount: n(e.amount), category: e.kind === "settlement" ? "Vendor / training partner" : e.category, label: e.note || e.category });
  for (const p of d.payroll)
    if (p.status === "paid") {
      const s = d.staff.find((x) => x.id === p.staff_id);
      out.push({ entity: (s as Staff & { company?: string })?.company === "enrich" ? "enrich" : "mastervlsi", date: (p.paid_at ?? `${p.month}-28`).slice(0, 10), amount: n(p.net), category: "Staff salary", label: `Payroll ${p.month} — ${s?.full_name ?? "staff"}` });
    }
  return out;
}

export const sumLines = (lines: Line[], f: (l: Line) => boolean = () => true) => lines.filter(f).reduce((a, l) => a + l.amount, 0);

/** Last `count` months (oldest first) as YYYY-MM. */
export function lastMonths(today: string, count: number) {
  return Array.from({ length: count }, (_, i) => addMonths(today.slice(0, 7) + "-01", -(count - 1 - i)).slice(0, 7));
}

/** Indian financial year (Apr–Mar) containing `iso`, e.g. "2026-27" with its start/end dates. */
export function financialYear(iso: string) {
  const y = Number(iso.slice(0, 4));
  const start = Number(iso.slice(5, 7)) >= 4 ? y : y - 1;
  return { label: `${start}-${String((start + 1) % 100).padStart(2, "0")}`, from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

// ---------------------------------------------------------------------------------------------
// Rental helpers
// ---------------------------------------------------------------------------------------------
export const dueTotal = (r: RentDue) => n(r.rent) + n(r.maintenance) + n(r.utilities) + n(r.other);
export const dueBalance = (r: RentDue) => Math.max(0, dueTotal(r) - n(r.paid));

export function tenancyView(d: FinanceData, t: Tenancy) {
  const tenant = d.tenants.find((x) => x.id === t.tenant_id)!;
  const unit = d.units.find((u) => u.id === t.unit_id);
  const dues = d.dues.filter((r) => r.tenancy_id === t.id).sort((a, b) => a.period.localeCompare(b.period));
  const pays = d.tenantPayments.filter((p) => p.tenancy_id === t.id).sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  const outstanding = dues.reduce((a, r) => a + dueBalance(r), 0);
  const depositHeld = pays.filter((p) => p.kind === "deposit").reduce((a, p) => a + n(p.amount), 0) - pays.filter((p) => p.kind === "refund").reduce((a, p) => a + n(p.amount), 0);
  const current = dues.find((r) => r.period === monthOf(d.today));
  const totalPaid = pays.filter((p) => p.kind !== "deposit" && p.kind !== "refund").reduce((a, p) => a + n(p.amount), 0);
  const overdue = dues.filter((r) => dueBalance(r) > 0 && r.due_date < d.today);
  return { t, tenant, unit, dues, pays, outstanding, depositHeld, current, totalPaid, overdue };
}

// ---------------------------------------------------------------------------------------------
// Receivables & payables
// ---------------------------------------------------------------------------------------------
export interface RPItem {
  entity: Entity;
  kind: string;
  party: string;
  detail: string;
  amount: number;
  due?: string | null;
  href?: string;
  overdue: boolean;
}

export function receivablesPayables(d: FinanceData) {
  const today = d.today;
  const receivables: RPItem[] = [];
  const payables: RPItem[] = [];
  for (const t of d.tenancies.filter((x) => x.status !== "ended")) {
    const v = tenancyView(d, t);
    for (const r of v.dues.filter((x) => dueBalance(x) > 0))
      receivables.push({ entity: "property", kind: "Rent", party: v.tenant.full_name, detail: `${v.unit?.code ?? ""} · ${r.period}`, amount: dueBalance(r), due: r.due_date, href: `/finance/tenants/${t.id}`, overdue: r.due_date < today });
  }
  for (const i of d.installments)
    if (i.status !== "paid") {
      const s = d.students.find((x) => x.id === i.student_id);
      receivables.push({ entity: "mastervlsi", kind: "Student fee", party: s?.full_name ?? "Student", detail: `Installment #${i.seq}`, amount: n(i.amount) - n(i.paid_amount), due: i.due_date, href: `/students/${i.student_id}`, overdue: i.due_date < today });
    }
  for (const inv of d.invoices)
    if (inv.status === "unpaid")
      receivables.push({ entity: inv.company === "mastervlsi" ? "mastervlsi" : "enrich", kind: "Invoice", party: inv.invoice_no, detail: inv.description ?? "", amount: n(inv.amount), due: inv.issue_date, href: `/enrich`, overdue: addDays(inv.issue_date, 30) < today });
  for (const e of d.expenses)
    if (e.status === "approved" || (e.status === "paid" && n(e.paid_amount) < n(e.amount)))
      payables.push({ entity: e.entity, kind: e.category, party: e.payee || d.vendors.find((v) => v.id === e.vendor_id)?.name || "Payee", detail: e.description, amount: n(e.amount) - n(e.paid_amount), due: e.due_date ?? e.expense_date, href: `/finance/pay?expense=${e.id}`, overdue: (e.due_date ?? e.expense_date) < today });
  for (const b of d.bills)
    if (b.payer === "owner" && b.status === "unpaid")
      payables.push({ entity: "property", kind: "Utility", party: b.utility, detail: `${d.units.find((u) => u.id === b.unit_id)?.code ?? ""} · ${b.bill_month}`, amount: n(b.amount), due: `${b.bill_month}-28`, overdue: `${b.bill_month}-28` < today });
  for (const t of d.tenancies.filter((x) => x.status === "notice"))
    payables.push({ entity: "property", kind: "Deposit refund", party: d.tenants.find((x) => x.id === t.tenant_id)?.full_name ?? "Tenant", detail: "Tenant on notice", amount: tenancyView(d, t).depositHeld, due: t.exit_date, href: `/finance/tenants/${t.id}`, overdue: false });
  for (const s of d.settlements.filter((x) => x.status === "pending")) {
    payables.push({ entity: s.from_entity, kind: "Inter-entity", party: s.to_entity, detail: s.reason ?? "", amount: n(s.amount), due: null, href: "/finance/pay#settlements", overdue: false });
    receivables.push({ entity: s.to_entity, kind: "Inter-entity", party: s.from_entity, detail: s.reason ?? "", amount: n(s.amount), due: null, href: "/finance/pay#settlements", overdue: false });
  }
  return { receivables, payables };
}

/** Recurring payments due within `days`, plus approved bills not yet paid, soonest first. */
export function upcomingPayments(d: FinanceData, days = 30) {
  const until = addDays(d.today, days);
  const rec = d.recurring.filter((r) => r.active && r.next_due <= until).map((r) => ({ date: r.next_due, label: r.description, entity: r.entity, amount: n(r.amount), kind: r.frequency, recurring: true }));
  const bills = d.expenses
    .filter((e) => e.status === "approved" && (e.due_date ?? e.expense_date) <= until)
    .map((e) => ({ date: e.due_date ?? e.expense_date, label: e.description, entity: e.entity, amount: n(e.amount) - n(e.paid_amount), kind: "bill", recurring: false }));
  return [...rec, ...bills].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------------------------
// Repository (reads + writes)
// ---------------------------------------------------------------------------------------------
export function createFinanceRepo(db: Store) {
  const load = async (): Promise<FinanceData> => {
    const [accounts, properties, units, tenants, tenancies, dues, tenantPayments, bills, maintenance, tenantDocs, recurring, expenses, fundPayments, sources, settlements, transfers, budgets, vendors, feePayments, installments, invoices, entries, payroll, staff, students] =
      await Promise.all([
        db.select<FinAccount>("fin_accounts", { order: { column: "name" } }),
        db.select<Property>("properties", { order: { column: "name" } }),
        db.select<PropertyUnit>("property_units", { order: { column: "code" } }),
        db.select<Tenant>("tenants", { order: { column: "full_name" } }),
        db.select<Tenancy>("tenancies"),
        db.select<RentDue>("rent_dues", { order: { column: "period" } }),
        db.select<TenantPayment>("tenant_payments", { order: { column: "paid_on", ascending: false } }),
        db.select<UtilityBill>("utility_bills", { order: { column: "bill_month", ascending: false } }),
        db.select<MaintenanceRequest>("maintenance_requests", { order: { column: "raised_on", ascending: false } }),
        db.select<TenantDocument>("tenant_documents"),
        db.select<RecurringPayment>("recurring_payments", { order: { column: "next_due" } }),
        db.select<Expense>("expenses", { order: { column: "expense_date", ascending: false } }),
        db.select<FundPayment>("fund_payments", { order: { column: "paid_on", ascending: false } }),
        db.select<PaymentSource>("payment_sources"),
        db.select<Settlement>("inter_entity_settlements", { order: { column: "created_at", ascending: false } }),
        db.select<FundTransfer>("fund_transfers", { order: { column: "transfer_date", ascending: false } }),
        db.select<Budget>("budgets"),
        db.select<Vendor>("vendors", { order: { column: "name" } }),
        db.select<Payment>("payments"),
        db.select<Installment>("installments"),
        db.select<Invoice>("invoices"),
        db.select<FinanceEntry>("finance_entries"),
        db.select<PayrollRow>("payroll"),
        db.select<Staff>("staff"),
        db.select<Student>("students"),
      ]);
    return { today: todayISO(), accounts, properties, units, tenants, tenancies, dues, tenantPayments, bills, maintenance, tenantDocs, recurring, expenses, fundPayments, sources, settlements, transfers, budgets, vendors, feePayments, installments, invoices, entries, payroll, staff, students };
  };

  const fin = {
    load,

    // ---- tenants & rent -------------------------------------------------------------------
    /** Creates the tenant, the tenancy (agreement), marks the unit occupied and raises dues up to this month. */
    async addTenant(tenant: Partial<Tenant>, tenancy: Partial<Tenancy>) {
      const [units] = [await db.select<PropertyUnit>("property_units", { eq: { id: tenancy.unit_id! } })];
      if (!units[0]) throw new Error("Pick a unit");
      const active = await db.select<Tenancy>("tenancies", { eq: { unit_id: tenancy.unit_id! } });
      if (active.some((t) => t.status !== "ended")) throw new Error(`${units[0].code} already has an active tenant`);
      const [tn] = await db.insert<Tenant>("tenants", [{ kyc_verified: false, police_verified: false, ...tenant, created_at: new Date().toISOString() }]);
      const [ty] = await db.insert<Tenancy>("tenancies", [{
        due_day: 5, maintenance_charge: 0, security_deposit: 0, escalation_pct: 0, notice_days: 30, deductions: 0, status: "active",
        ...tenancy, tenant_id: tn.id, created_at: new Date().toISOString(),
      }]);
      await db.update<PropertyUnit>("property_units", { id: tenancy.unit_id! }, { status: "occupied" });
      await fin.raiseDues(todayISO(), ty.id);
      return ty;
    },

    /**
     * Ensures a rent due exists for every month from when the tenancy was added to the system
     * (never before its agreement start, never more than 12 months back) up to this month.
     * An existing tenant entered with an old start date therefore doesn't get backdated arrears.
     */
    async raiseDues(today = todayISO(), onlyTenancy?: string) {
      const tenancies = (await db.select<Tenancy>("tenancies", onlyTenancy ? { eq: { id: onlyTenancy } } : {})).filter((t) => t.status !== "ended");
      const existing = await db.select<RentDue>("rent_dues");
      let created = 0;
      for (const t of tenancies) {
        const from = [monthOf(t.start_date), monthOf(t.created_at ?? t.start_date)].sort().at(-1)!;
        const months = lastMonths(today, 12).filter((m) => m >= from && (!t.exit_date || m <= monthOf(t.exit_date)));
        for (const period of months) {
          if (existing.some((r) => r.tenancy_id === t.id && r.period === period)) continue;
          await db.insert<RentDue>("rent_dues", [{
            tenancy_id: t.id, period, due_date: `${period}-${String(t.due_day).padStart(2, "0")}`,
            rent: n(t.monthly_rent), maintenance: n(t.maintenance_charge), utilities: 0, other: 0, paid: 0, status: "pending", created_at: new Date().toISOString(),
          } as Partial<RentDue>]);
          created++;
        }
      }
      return created;
    },

    /** Records a tenant payment; rent payments settle the oldest open dues first. */
    async recordTenantPayment(p: Partial<TenantPayment>) {
      if (!p.tenancy_id || !(n(p.amount) > 0)) throw new Error("Amount must be more than zero");
      const [pay] = await db.insert<TenantPayment>("tenant_payments", [{ kind: "rent", mode: "UPI", paid_on: todayISO(), ...p, account_id: p.account_id || null, created_at: new Date().toISOString() }]);
      if (pay.kind === "rent" || pay.kind === "utility" || pay.kind === "maintenance" || pay.kind === "other") {
        let left = n(pay.amount);
        const open = (await db.select<RentDue>("rent_dues", { eq: { tenancy_id: pay.tenancy_id }, order: { column: "period" } })).filter((r) => dueBalance(r) > 0);
        for (const r of open) {
          if (left <= 0) break;
          const take = Math.min(left, dueBalance(r));
          const paid = n(r.paid) + take;
          await db.update<RentDue>("rent_dues", { id: r.id }, { paid, status: paid >= dueTotal(r) ? "paid" : "partial" });
          left -= take;
        }
        if (open[0]) await db.update<TenantPayment>("tenant_payments", { id: pay.id }, { rent_due_id: open[0].id });
      }
      return pay;
    },

    /** Utility bill: tenant-paid bills are added to that month's rent due; owner-paid bills become a property expense. */
    async addUtilityBill(b: Partial<UtilityBill>, me: string) {
      const [bill] = await db.insert<UtilityBill>("utility_bills", [{ payer: "tenant", status: "unpaid", ...b, created_at: new Date().toISOString() } as Partial<UtilityBill>]);
      if (bill.payer === "tenant" && bill.tenancy_id) {
        await fin.raiseDues(todayISO(), bill.tenancy_id);
        const [due] = await db.select<RentDue>("rent_dues", { eq: { tenancy_id: bill.tenancy_id, period: bill.bill_month } });
        if (due) await db.update<RentDue>("rent_dues", { id: due.id }, { utilities: n(due.utilities) + n(bill.amount), status: n(due.paid) >= dueTotal(due) + n(bill.amount) ? "paid" : n(due.paid) > 0 ? "partial" : "pending" });
      } else if (bill.payer === "owner") {
        await fin.addExpense({ entity: "property", category: bill.utility === "water" ? "Water" : bill.utility === "electricity" ? "Electricity" : "Internet & phone", description: `${bill.utility} bill ${bill.bill_month}`, amount: n(bill.amount), unit_id: bill.unit_id, payee: bill.utility }, me, true);
      }
      return bill;
    },

    /** Completing a maintenance request books its cost to the owner (expense) or the tenant (next due). */
    async completeMaintenance(id: string, cost: number, chargeTo: "owner" | "tenant", me: string) {
      const [m] = await db.select<MaintenanceRequest>("maintenance_requests", { eq: { id } });
      if (!m) throw new Error("Request not found");
      await db.update<MaintenanceRequest>("maintenance_requests", { id }, { status: "completed", cost, charge_to: chargeTo, completed_on: todayISO() });
      if (cost > 0 && chargeTo === "owner")
        await fin.addExpense({ entity: "property", category: "Maintenance & repairs", description: `Maintenance: ${m.title}`, amount: cost, unit_id: m.unit_id, vendor_id: m.vendor_id ?? null }, me, true);
      if (cost > 0 && chargeTo === "tenant" && m.tenancy_id) {
        await fin.raiseDues(todayISO(), m.tenancy_id);
        const [due] = await db.select<RentDue>("rent_dues", { eq: { tenancy_id: m.tenancy_id, period: monthOf(todayISO()) } });
        if (due) await db.update<RentDue>("rent_dues", { id: due.id }, { other: n(due.other) + cost, status: n(due.paid) >= dueTotal(due) + cost ? "paid" : n(due.paid) > 0 ? "partial" : "pending" });
      }
    },

    /** Exit & settlement: refund = deposit held − deductions − unpaid dues. */
    async exitTenancy(id: string, input: { exit_date: string; deductions: number; note?: string; refund_ref?: string }) {
      const d = await load();
      const t = d.tenancies.find((x) => x.id === id);
      if (!t) throw new Error("Tenancy not found");
      const v = tenancyView(d, t);
      const refund = Math.max(0, v.depositHeld - input.deductions - v.outstanding);
      await db.update<Tenancy>("tenancies", { id }, { status: "ended", exit_date: input.exit_date, deductions: input.deductions, refund_amount: refund, settled_on: todayISO(), settlement_note: input.note ?? null });
      // Unpaid dues are covered from the deposit
      for (const r of v.dues.filter((x) => dueBalance(x) > 0)) await db.update<RentDue>("rent_dues", { id: r.id }, { paid: dueTotal(r), status: "paid" });
      if (refund > 0) {
        const ref = input.refund_ref || POOLS.rent;
        const accountId = ref.startsWith("account:") ? ref.slice(8) : null;
        if (balanceOf(d, ref) < refund) throw new Error(`Not enough balance in ${refLabel(ref, d.accounts)} to refund ₹${refund}`);
        await db.insert<TenantPayment>("tenant_payments", [{ tenancy_id: id, kind: "refund", amount: refund, mode: "Bank transfer", paid_on: input.exit_date, account_id: accountId, note: "Security deposit refund", created_at: new Date().toISOString() }]);
      }
      await db.update<PropertyUnit>("property_units", { id: t.unit_id }, { status: "vacant" });
      return { refund, outstandingCovered: v.outstanding };
    },

    // ---- expenses & approvals --------------------------------------------------------------
    /** New expense. Above the approval threshold it waits for a super admin, unless a super admin adds it. */
    async addExpense(e: Partial<Expense>, me: string, autoApprove = false) {
      if (!e.entity || !e.category || !e.description || !(n(e.amount) > 0)) throw new Error("Entity, category, description and amount are required");
      const needsApproval = !autoApprove && n(e.amount) > APPROVAL_THRESHOLD;
      const [row] = await db.insert<Expense>("expenses", [{
        expense_date: todayISO(), paid_amount: 0, ...e,
        status: needsApproval ? "pending_approval" : "approved",
        approved_by: needsApproval ? null : me, approved_at: needsApproval ? null : new Date().toISOString(),
        created_by: me, created_at: new Date().toISOString(),
      }]);
      return row;
    },
    decideExpense: (id: string, approve: boolean, me: string) =>
      db.update<Expense>("expenses", { id }, { status: approve ? "approved" : "rejected", approved_by: me, approved_at: new Date().toISOString() }),

    // ---- payments, settlements, transfers ------------------------------------------------------
    /**
     * Pays a vendor/bill from one or more sources. Each source must have enough balance.
     * When a source belongs to another entity than the one the bill is for, an inter-entity
     * settlement is recorded (bill entity owes the source entity).
     */
    async makePayment(input: { expense_id?: string | null; payee: string; vendor_id?: string | null; on_behalf_of: Entity; paid_on: string; reference?: string; note?: string; sources: { ref: string; amount: number; tenancy_id?: string | null }[] }) {
      const d = await load();
      const sources = input.sources.filter((s) => s.ref && s.amount > 0);
      if (!sources.length) throw new Error("Add at least one payment source");
      const total = sources.reduce((a, s) => a + s.amount, 0);
      const exp = input.expense_id ? d.expenses.find((e) => e.id === input.expense_id) : null;
      if (input.expense_id && !exp) throw new Error("Bill not found");
      if (exp && exp.status === "pending_approval") throw new Error("This bill is waiting for approval");
      if (exp && exp.status === "rejected") throw new Error("This bill was rejected");
      if (exp && total > n(exp.amount) - n(exp.paid_amount) + 0.5) throw new Error(`Total ₹${total} is more than the ₹${n(exp.amount) - n(exp.paid_amount)} still due on this bill`);
      const used = new Map<string, number>();
      for (const s of sources) used.set(s.ref, (used.get(s.ref) ?? 0) + s.amount);
      for (const [ref, amt] of used) {
        if (!refEntity(ref, d.accounts)) throw new Error("Unknown payment source");
        const bal = balanceOf(d, ref);
        if (bal < amt) throw new Error(`Not enough balance in ${refLabel(ref, d.accounts)} (₹${Math.round(bal).toLocaleString("en-IN")} available)`);
      }
      const payerEntity = exp?.entity ?? input.on_behalf_of;
      const [pay] = await db.insert<FundPayment>("fund_payments", [{
        expense_id: exp?.id ?? null, vendor_id: input.vendor_id ?? exp?.vendor_id ?? null, payee: input.payee || exp?.payee || "Payee",
        total, paid_on: input.paid_on || todayISO(), reference: input.reference || null, note: input.note || null, created_at: new Date().toISOString(),
      }]);
      await db.insert<PaymentSource>("payment_sources", sources.map((s) => ({ payment_id: pay.id, source_ref: s.ref, entity: refEntity(s.ref, d.accounts)!, tenancy_id: s.tenancy_id || null, amount: s.amount, created_at: new Date().toISOString() } as Partial<PaymentSource>)));
      const owedTo = new Map<Entity, number>();
      for (const s of sources) {
        const e = refEntity(s.ref, d.accounts)!;
        if (e !== payerEntity) owedTo.set(e, (owedTo.get(e) ?? 0) + s.amount);
      }
      for (const [to, amount] of owedTo)
        await db.insert<Settlement>("inter_entity_settlements", [{ from_entity: payerEntity, to_entity: to, amount, reason: `${pay.payee}${exp?.invoice_no ? ` invoice ${exp.invoice_no}` : ""} paid partly from ${to} funds`, payment_id: pay.id, status: "pending", created_at: new Date().toISOString() }]);
      if (exp) {
        const paid = n(exp.paid_amount) + total;
        await db.update<Expense>("expenses", { id: exp.id }, { paid_amount: paid, status: paid >= n(exp.amount) - 0.5 ? "paid" : "approved" });
      }
      return { payment: pay, settlements: [...owedTo.entries()] };
    },

    async transfer(input: { from_ref: string; to_ref: string; amount: number; transfer_date: string; reference?: string; note?: string; settlement_id?: string | null }) {
      const d = await load();
      if (input.from_ref === input.to_ref) throw new Error("Pick two different accounts");
      if (!refEntity(input.from_ref, d.accounts) || !refEntity(input.to_ref, d.accounts)) throw new Error("Unknown account");
      if (!(input.amount > 0)) throw new Error("Amount must be more than zero");
      const bal = balanceOf(d, input.from_ref);
      if (bal < input.amount) throw new Error(`Not enough balance in ${refLabel(input.from_ref, d.accounts)} (₹${Math.round(bal).toLocaleString("en-IN")} available)`);
      const [t] = await db.insert<FundTransfer>("fund_transfers", [{ ...input, reference: input.reference || null, note: input.note || null, settlement_id: input.settlement_id || null, created_at: new Date().toISOString() }]);
      if (input.settlement_id) await db.update<Settlement>("inter_entity_settlements", { id: input.settlement_id }, { status: "settled", settled_on: input.transfer_date });
      return t;
    },

    /** Settle an inter-entity balance by moving money from the debtor's account to the creditor's. */
    async settle(id: string, from_ref: string, to_ref: string, date: string) {
      const [s] = await db.select<Settlement>("inter_entity_settlements", { eq: { id } });
      if (!s || s.status === "settled") throw new Error("Nothing to settle");
      const d = await load();
      if (refEntity(from_ref, d.accounts) !== s.from_entity) throw new Error(`Pay from a ${s.from_entity} account`);
      if (refEntity(to_ref, d.accounts) !== s.to_entity) throw new Error(`Pay into a ${s.to_entity} account`);
      return fin.transfer({ from_ref, to_ref, amount: n(s.amount), transfer_date: date, reference: `Settlement ${id.slice(0, 8)}`, note: s.reason ?? undefined, settlement_id: id });
    },

    // ---- recurring ---------------------------------------------------------------------------
    /** Turns recurring payments due on or before `upto` into approved bills and moves them to the next date. */
    async generateRecurring(upto = todayISO(), me = "system") {
      const due = (await db.select<RecurringPayment>("recurring_payments")).filter((r) => r.active && r.next_due <= upto);
      let created = 0;
      for (const r of due) {
        let next = r.next_due;
        while (next <= upto) {
          await fin.addExpense({ entity: r.entity, category: r.category, vendor_id: r.vendor_id ?? null, payee: r.payee ?? null, description: r.description, amount: n(r.amount), expense_date: next, due_date: next, recurring_id: r.id }, me, true);
          created++;
          next = addMonths(next, r.frequency === "monthly" ? 1 : r.frequency === "quarterly" ? 3 : 12);
        }
        await db.update<RecurringPayment>("recurring_payments", { id: r.id }, { next_due: next });
      }
      return created;
    },
  };
  return fin;
}

export type FinanceRepo = ReturnType<typeof createFinanceRepo>;
