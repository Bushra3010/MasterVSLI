import { addDays } from "../format";
import type {
  Budget,
  Expense,
  FinAccount,
  FundPayment,
  FundTransfer,
  MaintenanceRequest,
  PaymentSource,
  Property,
  PropertyUnit,
  RecurringPayment,
  RentDue,
  Settlement,
  Tenancy,
  Tenant,
  TenantDocument,
  TenantPayment,
  UtilityBill,
} from "../types-finance";
import type { Vendor } from "../types";

export interface FinanceTables {
  fin_accounts: FinAccount[];
  properties: Property[];
  property_units: PropertyUnit[];
  tenants: Tenant[];
  tenancies: Tenancy[];
  rent_dues: RentDue[];
  tenant_payments: TenantPayment[];
  utility_bills: UtilityBill[];
  maintenance_requests: MaintenanceRequest[];
  tenant_documents: TenantDocument[];
  recurring_payments: RecurringPayment[];
  expenses: Expense[];
  fund_payments: FundPayment[];
  payment_sources: PaymentSource[];
  inter_entity_settlements: Settlement[];
  fund_transfers: FundTransfer[];
  budgets: Budget[];
}

const ym = (iso: string) => iso.slice(0, 7);
const monthStart = (iso: string, back: number) => {
  const d = new Date(iso.slice(0, 7) + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - back);
  return d.toISOString().slice(0, 10);
};

/** Demo books for the three entities: accounts, 6 homes with 5 tenants, expenses, a multi-source payment. */
export function buildFinanceSeed(today: string, vendors: Vendor[]): FinanceTables {
  const accounts: FinAccount[] = [
    { id: "acc-mv-icici", entity: "mastervlsi", name: "MasterVLSI — ICICI current", kind: "bank", bank_name: "ICICI Bank", account_no: "XXXX4521", ifsc: "ICIC0001234", opening_balance: 850000, active: true },
    { id: "acc-mv-cash", entity: "mastervlsi", name: "MasterVLSI — cash in hand", kind: "cash", opening_balance: 25000, active: true },
    { id: "acc-es-hdfc", entity: "enrich", name: "Enrich Silicon — HDFC current", kind: "bank", bank_name: "HDFC Bank", account_no: "XXXX9087", ifsc: "HDFC0004567", opening_balance: 620000, active: true },
    { id: "acc-pr-sbi", entity: "property", name: "Property — SBI savings", kind: "bank", bank_name: "State Bank of India", account_no: "XXXX3310", ifsc: "SBIN0007788", opening_balance: 140000, active: true },
  ];
  const properties: Property[] = [{ id: "prop-1", name: "MasterVLSI Residency", address: "12th Cross, HSR Layout", city: "Bengaluru" }];
  const unitDefs: [string, string, string][] = [["Home 01", "1BHK", "Ground"], ["Home 02", "2BHK", "Ground"], ["Home 03", "2BHK", "First"], ["Home 04", "1BHK", "First"], ["Home 05", "3BHK", "Second"], ["Home 06", "2BHK", "Second"]];
  const units: PropertyUnit[] = unitDefs.map(([code, t, f], i) => ({ id: `unit-${i + 1}`, property_id: "prop-1", code, unit_type: t, floor: f, area_sqft: [650, 950, 1000, 620, 1450, 980][i], status: i === 5 ? "vacant" : "occupied" }));

  const people: [string, string, string, number, number][] = [
    ["Ravi Kumar", "9876500001", "Software engineer", 15000, 5],
    ["Priya S", "9876500002", "Teacher", 12000, 5],
    ["Karthik M", "9876500003", "Design engineer", 16000, 5],
    ["Sneha R", "9876500004", "Nurse", 11000, 10],
    ["Arun D", "9876500005", "Business", 22000, 5],
  ];
  const tenants: Tenant[] = [];
  const tenancies: Tenancy[] = [];
  const dues: RentDue[] = [];
  const pays: TenantPayment[] = [];
  const bills: UtilityBill[] = [];
  const docs: TenantDocument[] = [];
  people.forEach(([name, phone, job, rent, dueDay], i) => {
    const tid = `ten-${i + 1}`;
    const tyid = `tcy-${i + 1}`;
    const start = monthStart(today, 8 + i);
    tenants.push({
      id: tid, full_name: name, phone, email: `${name.split(" ")[0].toLowerCase()}@example.com`, id_proof_type: "Aadhaar", id_proof_no: `XXXX XXXX ${4100 + i * 37}`,
      occupation: job, family_members: 2 + (i % 3), permanent_address: `${10 + i}, MG Road, Bengaluru`, emergency_name: "Family contact", emergency_phone: `98450000${10 + i}`,
      kyc_verified: true, police_verified: i !== 3, created_at: start + "T09:00:00Z",
    });
    tenancies.push({
      id: tyid, tenant_id: tid, unit_id: `unit-${i + 1}`, agreement_no: `RENT-${String(i + 1).padStart(3, "0")}`, start_date: start, end_date: addDays(start, 334),
      monthly_rent: rent, due_day: dueDay, maintenance_charge: 1000, security_deposit: rent * 3, escalation_pct: 5, notice_days: 30, status: "active", deductions: 0,
      created_at: monthStart(today, 2) + "T09:00:00Z", // records kept in the ERP from 3 months ago
    });
    pays.push({ id: `tp-dep-${i}`, tenancy_id: tyid, kind: "deposit", amount: rent * 3, mode: "Bank transfer", reference: `DEP-${i + 1}`, paid_on: start, account_id: "acc-pr-sbi" });
    docs.push({ id: `td-${i}-1`, tenant_id: tid, kind: "id_proof", storage_path: `tenants/${tid}/id_proof/aadhaar.pdf`, verified: true });
    // last 3 months of dues; the current month is paid by 3 of 5 tenants
    for (let back = 2; back >= 0; back--) {
      const ms = monthStart(today, back);
      const period = ym(ms);
      const elec = 600 + i * 120 + back * 40;
      const paidAll = back > 0 || i % 2 === 0;
      const total = rent + 1000 + elec;
      const id = `rd-${i}-${period}`;
      dues.push({ id, tenancy_id: tyid, period, due_date: `${period}-${String(dueDay).padStart(2, "0")}`, rent, maintenance: 1000, utilities: elec, other: 0, paid: paidAll ? total : 0, status: paidAll ? "paid" : "pending" });
      if (paidAll)
        pays.push({ id: `tp-${i}-${period}`, tenancy_id: tyid, rent_due_id: id, kind: "rent", amount: total, mode: i % 2 ? "UPI" : "Cash", reference: `R${period.replace("-", "")}${i}`, paid_on: `${period}-${String(Math.min(dueDay + 2, 28)).padStart(2, "0")}`, account_id: i % 2 ? "acc-pr-sbi" : null });
      bills.push({ id: `ub-${i}-${period}`, unit_id: `unit-${i + 1}`, tenancy_id: tyid, utility: "electricity", bill_month: period, meter_no: `BESCOM-${7700 + i}`, prev_reading: 1200 + back * 90 + i * 10, curr_reading: 1290 + back * 90 + i * 10, amount: elec, payer: "tenant", status: paidAll ? "paid" : "unpaid", paid_on: paidAll ? `${period}-15` : null });
    }
  });

  const maint: MaintenanceRequest[] = [
    { id: "mr-1", unit_id: "unit-3", tenancy_id: "tcy-3", title: "Water leakage in kitchen", category: "Plumbing", priority: "high", raised_on: addDays(today, -12), status: "completed", cost: 1200, charge_to: "owner", completed_on: addDays(today, -10) },
    { id: "mr-2", unit_id: "unit-3", tenancy_id: "tcy-3", title: "Ceiling fan noise", category: "Electrical", priority: "normal", raised_on: addDays(today, -3), status: "in_progress", cost: 0, charge_to: "owner" },
    { id: "mr-3", unit_id: "unit-6", title: "Repaint before next tenant", category: "Painting", priority: "low", raised_on: addDays(today, -6), status: "open", cost: 0, charge_to: "owner" },
  ];

  const parentVendor = vendors.find((v) => !v.parent_id);
  const recurring: RecurringPayment[] = [
    { id: "rec-1", entity: "mastervlsi", category: "Rent / office building", payee: "Office landlord", description: "Office building rent", amount: 45000, frequency: "monthly", next_due: addDays(today, 6), active: true },
    { id: "rec-2", entity: "mastervlsi", category: "Internet & phone", payee: "ACT Fibernet", description: "Internet leased line", amount: 4500, frequency: "monthly", next_due: addDays(today, 9), active: true },
    { id: "rec-3", entity: "enrich", category: "Software & licenses", payee: "EDA tools vendor", description: "Simulator licence", amount: 60000, frequency: "quarterly", next_due: addDays(today, 18), active: true },
    { id: "rec-4", entity: "property", category: "Property tax", payee: "BBMP", description: "Property tax instalment", amount: 18000, frequency: "yearly", next_due: addDays(today, 40), active: true },
  ];

  const exp = (id: string, entity: Expense["entity"], category: string, description: string, amount: number, daysAgo: number, status: Expense["status"], extra: Partial<Expense> = {}): Expense => ({
    id, entity, category, description, amount, expense_date: addDays(today, -daysAgo), status, paid_amount: status === "paid" ? amount : 0, created_by: "demo admin", ...extra,
  });
  const expenses: Expense[] = [];
  for (let back = 5; back >= 0; back--) {
    const d = Math.max(1, back * 30 + 2);
    expenses.push(
      exp(`ex-sal-${back}`, "mastervlsi", "Staff salary", "Trainer & staff salaries", 210000 + back * 3000, d, "paid", { payee: "Payroll" }),
      exp(`ex-rent-${back}`, "mastervlsi", "Rent / office building", "Office building rent", 45000, d + 1, "paid", { payee: "Office landlord" }),
      exp(`ex-elec-${back}`, "mastervlsi", "Electricity", "Institute electricity bill", 11000 + back * 400, d + 2, "paid", { payee: "BESCOM" }),
      exp(`ex-es-sal-${back}`, "enrich", "Staff salary", "Engineering salaries", 150000 + back * 2000, d, "paid", { payee: "Payroll" }),
      exp(`ex-es-ops-${back}`, "enrich", "Office & operational", "Office supplies & admin", 9000 + back * 500, d + 3, "paid"),
      exp(`ex-pr-mnt-${back}`, "property", "Maintenance & repairs", "Common area upkeep", 3500 + back * 200, d + 4, "paid"),
    );
  }
  expenses.push(
    exp("ex-abc", "mastervlsi", "Maintenance & repairs", "Electrical wiring — lab & Home 03", 50000, 4, "paid", { vendor_id: null, payee: "ABC Electricals", invoice_no: "VND-1145", unit_id: "unit-3" }),
    exp("ex-water", "property", "Water", "Water tanker supply", 2500, 2, "approved", { payee: "Sri Water Supply", due_date: addDays(today, 5) }),
    exp("ex-lab", "mastervlsi", "Equipment", "8 lab workstations", 320000, 1, "pending_approval", { payee: "Dell India", invoice_no: "DL-88231", due_date: addDays(today, 15) }),
    exp("ex-vendor", "mastervlsi", "Vendor / training partner", "Training partner share — this month", 40000, 3, "approved", { vendor_id: parentVendor?.id ?? null, payee: parentVendor?.name ?? "Training partner", due_date: addDays(today, 7) }),
  );

  // ABC Electricals ₹50,000 paid from MasterVLSI's bank (₹30,000) + Home 03 rent collections (₹20,000)
  const fundPayments: FundPayment[] = [{ id: "fp-abc", expense_id: "ex-abc", payee: "ABC Electricals", total: 50000, paid_on: addDays(today, -4), reference: "NEFT-778812", note: "Invoice VND-1145" }];
  const sources: PaymentSource[] = [
    { id: "ps-1", payment_id: "fp-abc", source_ref: "account:acc-mv-icici", entity: "mastervlsi", amount: 30000 },
    { id: "ps-2", payment_id: "fp-abc", source_ref: "pool:rent", entity: "property", tenancy_id: "tcy-3", amount: 20000 },
  ];
  const settlements: Settlement[] = [
    { id: "set-1", from_entity: "mastervlsi", to_entity: "property", amount: 20000, reason: "ABC Electricals invoice VND-1145 paid partly from Home 03 rent", payment_id: "fp-abc", status: "pending", created_at: addDays(today, -4) + "T10:00:00Z" },
    { id: "set-2", from_entity: "enrich", to_entity: "mastervlsi", amount: 35000, reason: "Shared lab usage — last quarter", status: "settled", settled_on: addDays(today, -20), created_at: addDays(today, -40) + "T10:00:00Z" },
  ];
  const transfers: FundTransfer[] = [
    { id: "ft-1", from_ref: "pool:rent", to_ref: "account:acc-pr-sbi", amount: 30000, transfer_date: addDays(today, -15), reference: "Cash deposit", note: "Rent cash banked" },
    { id: "ft-2", from_ref: "account:acc-es-hdfc", to_ref: "account:acc-mv-icici", amount: 35000, transfer_date: addDays(today, -20), reference: "IMPS-55120", settlement_id: "set-2" },
  ];
  const month = ym(today);
  const budgets: Budget[] = [
    { id: "bud-1", entity: "mastervlsi", category: "Staff salary", month, amount: 230000 },
    { id: "bud-2", entity: "mastervlsi", category: "Maintenance & repairs", month, amount: 40000 },
    { id: "bud-3", entity: "mastervlsi", category: "Equipment", month, amount: 150000 },
    { id: "bud-4", entity: "enrich", category: "Staff salary", month, amount: 160000 },
    { id: "bud-5", entity: "property", category: "Maintenance & repairs", month, amount: 8000 },
  ];

  return {
    fin_accounts: accounts,
    properties,
    property_units: units,
    tenants,
    tenancies,
    rent_dues: dues,
    tenant_payments: pays,
    utility_bills: bills,
    maintenance_requests: maint,
    tenant_documents: docs,
    recurring_payments: recurring,
    expenses,
    fund_payments: fundPayments,
    payment_sources: sources,
    inter_entity_settlements: settlements,
    fund_transfers: transfers,
    budgets,
  };
}
