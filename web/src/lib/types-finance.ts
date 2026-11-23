/** Finance & fund flow: entities, accounts, rental property, expenses and money movement. */
export type Entity = "mastervlsi" | "enrich" | "property";
export const ENTITIES: Entity[] = ["mastervlsi", "enrich", "property"];
export const ENTITY_LABEL: Record<Entity, string> = { mastervlsi: "MasterVLSI (Institute)", enrich: "Enrich Silicon (Company)", property: "Rental property" };
export const ENTITY_SHORT: Record<Entity, string> = { mastervlsi: "MasterVLSI", enrich: "Enrich Silicon", property: "Property" };

/** Expense categories, grouped like the Expense Management menu. */
export const EXPENSE_CATEGORIES = [
  "Rent / office building",
  "Staff salary",
  "Electricity",
  "Water",
  "Internet & phone",
  "Maintenance & repairs",
  "Office & operational",
  "Software & licenses",
  "Marketing",
  "Equipment",
  "Travel",
  "Property tax",
  "Vendor / training partner",
  "Other",
] as const;
/** Sidebar filters → which categories they show. */
export const EXPENSE_VIEWS: Record<string, { label: string; entity?: Entity; categories?: string[] }> = {
  all: { label: "All expenses" },
  institute: { label: "Institute expenses", entity: "mastervlsi" },
  company: { label: "Company expenses", entity: "enrich" },
  property: { label: "Property / rental expenses", entity: "property" },
  staff: { label: "Staff & salary", categories: ["Staff salary"] },
  utilities: { label: "Utilities (electric / water)", categories: ["Electricity", "Water", "Internet & phone"] },
  maintenance: { label: "Maintenance & repair", categories: ["Maintenance & repairs"] },
  other: { label: "Other expenses", categories: ["Other", "Travel", "Marketing", "Property tax", "Equipment", "Software & licenses", "Office & operational", "Vendor / training partner", "Rent / office building"] },
};

export interface FinAccount {
  id: string;
  entity: Entity;
  name: string;
  kind: "bank" | "cash" | "upi" | "wallet";
  bank_name?: string | null;
  account_no?: string | null;
  ifsc?: string | null;
  opening_balance: number;
  active: boolean;
}
export interface Property {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
}
export interface PropertyUnit {
  id: string;
  property_id: string;
  code: string;
  unit_type?: string | null;
  floor?: string | null;
  area_sqft?: number | null;
  status: "vacant" | "occupied" | "maintenance";
}
export interface Tenant {
  id: string;
  full_name: string;
  phone?: string | null;
  alt_phone?: string | null;
  email?: string | null;
  id_proof_type?: string | null;
  id_proof_no?: string | null;
  occupation?: string | null;
  family_members?: number | null;
  permanent_address?: string | null;
  emergency_name?: string | null;
  emergency_phone?: string | null;
  kyc_verified: boolean;
  police_verified: boolean;
  notes?: string | null;
  created_at?: string;
}
export interface Tenancy {
  id: string;
  tenant_id: string;
  unit_id: string;
  agreement_no?: string | null;
  start_date: string;
  end_date?: string | null;
  monthly_rent: number;
  due_day: number;
  maintenance_charge: number;
  security_deposit: number;
  escalation_pct: number;
  notice_days: number;
  status: "active" | "notice" | "ended";
  exit_date?: string | null;
  deductions: number;
  refund_amount?: number | null;
  settled_on?: string | null;
  settlement_note?: string | null;
  created_at?: string;
}
export interface RentDue {
  id: string;
  tenancy_id: string;
  period: string;
  due_date: string;
  rent: number;
  maintenance: number;
  utilities: number;
  other: number;
  paid: number;
  status: "pending" | "partial" | "paid";
}
export type TenantPaymentKind = "rent" | "deposit" | "utility" | "maintenance" | "other" | "refund";
export interface TenantPayment {
  id: string;
  tenancy_id: string;
  rent_due_id?: string | null;
  kind: TenantPaymentKind;
  amount: number;
  mode: string;
  reference?: string | null;
  paid_on: string;
  account_id?: string | null;
  note?: string | null;
  created_at?: string;
}
export interface UtilityBill {
  id: string;
  unit_id: string;
  tenancy_id?: string | null;
  utility: "electricity" | "water" | "gas" | "internet" | "other";
  bill_month: string;
  meter_no?: string | null;
  prev_reading?: number | null;
  curr_reading?: number | null;
  amount: number;
  payer: "tenant" | "owner";
  status: "unpaid" | "paid";
  paid_on?: string | null;
}
export interface MaintenanceRequest {
  id: string;
  unit_id: string;
  tenancy_id?: string | null;
  title: string;
  category?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  raised_on: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  cost: number;
  charge_to: "owner" | "tenant";
  vendor_id?: string | null;
  completed_on?: string | null;
  notes?: string | null;
}
export interface TenantDocument {
  id: string;
  tenant_id: string;
  kind: string;
  storage_path: string;
  verified: boolean;
  uploaded_at?: string;
}
export interface RecurringPayment {
  id: string;
  entity: Entity;
  category: string;
  vendor_id?: string | null;
  payee?: string | null;
  description: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "yearly";
  next_due: string;
  active: boolean;
}
export type ExpenseStatus = "pending_approval" | "approved" | "paid" | "rejected";
export interface Expense {
  id: string;
  entity: Entity;
  category: string;
  vendor_id?: string | null;
  payee?: string | null;
  description: string;
  amount: number;
  expense_date: string;
  due_date?: string | null;
  invoice_no?: string | null;
  unit_id?: string | null;
  status: ExpenseStatus;
  paid_amount: number;
  approved_by?: string | null;
  approved_at?: string | null;
  recurring_id?: string | null;
  created_by?: string | null;
  created_at?: string;
}
export interface FundPayment {
  id: string;
  expense_id?: string | null;
  vendor_id?: string | null;
  payee: string;
  total: number;
  paid_on: string;
  reference?: string | null;
  note?: string | null;
  created_at?: string;
}
export interface PaymentSource {
  id: string;
  payment_id: string;
  source_ref: string;
  entity: Entity;
  tenancy_id?: string | null;
  amount: number;
}
export interface Settlement {
  id: string;
  from_entity: Entity;
  to_entity: Entity;
  amount: number;
  reason?: string | null;
  payment_id?: string | null;
  status: "pending" | "settled";
  settled_on?: string | null;
  created_at?: string;
}
export interface FundTransfer {
  id: string;
  from_ref: string;
  to_ref: string;
  amount: number;
  transfer_date: string;
  reference?: string | null;
  note?: string | null;
  settlement_id?: string | null;
  created_at?: string;
}
export interface Budget {
  id: string;
  entity: Entity;
  category: string;
  month: string;
  amount: number;
}

/** Expenses above this need a super-admin's approval before they can be paid. */
export const APPROVAL_THRESHOLD = 25000;
