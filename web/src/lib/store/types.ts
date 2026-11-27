/**
 * Minimal table gateway. Two implementations:
 *  - SupabaseStore: real Postgres (RLS applies with the user's session; service role for webhooks/cron)
 *  - DemoStore: in-memory seeded data that mirrors the SQL triggers/functions, used when
 *    NEXT_PUBLIC_SUPABASE_URL is not configured so the ERP runs out of the box.
 */
export type TableName =
  | "courses"
  | "batches"
  | "vendors"
  | "students"
  | "student_education"
  | "student_documents"
  | "student_access"
  | "access_events"
  | "attendance_records"
  | "fee_allocations"
  | "installments"
  | "payments"
  | "notifications"
  | "placement_drives"
  | "drive_responses"
  | "staff"
  | "issued_letters"
  | "lab_systems"
  | "staff_attendance"
  | "leave_requests"
  | "payroll"
  | "finance_entries"
  | "messages"
  | "profiles"
  | "staff_tasks"
  | "payment_requests"
  | "admission_enquiries"
  | "branches"
  | "colleges"
  | "tpo_contacts"
  | "mous"
  | "campus_drives"
  | "clients"
  | "projects"
  | "timesheets"
  | "invoices"
  | "leads"
  | "lead_activities"
  | "hr_contacts"
  | "hr_company_history"
  | "hr_calls"
  | "ambassador_activities"
  | "course_modules"
  | "module_progress"
  | "assessments"
  | "terms"
  | "consents"
  | "alerts"
  | "assignments"
  | "assignment_submissions"
  | "college_logins"
  | "tpo_interactions"
  | "alert_contacts"
  | "project_milestones"
  | "staff_appraisals"
  | "company_profiles"
  | "audit_log"
  // finance & fund flow
  | "fin_accounts"
  | "properties"
  | "property_units"
  | "tenants"
  | "tenancies"
  | "rent_dues"
  | "tenant_payments"
  | "utility_bills"
  | "maintenance_requests"
  | "tenant_documents"
  | "recurring_payments"
  | "expenses"
  | "fund_payments"
  | "payment_sources"
  | "inter_entity_settlements"
  | "fund_transfers"
  | "budgets"
  // enhanced profile
  | "master_options"
  | "student_applications"
  | "student_notes"
  // staff calendar
  | "calendar_events"
  // HR incentives
  | "hr_commission_rules"
  | "hr_commissions"
  | "hr_targets"
  // earn & rewards
  | "reward_settings"
  | "reward_program"
  | "reward_goodies"
  // student 360
  | "student_resumes"
  | "student_interviews"
  | "payment_submissions"
  | "student_requests"
  | "reminder_acks"
  // lead management 360
  | "lead_tasks"
  | "lead_allocations"
  | "lead_settings"
  | "lead_daily_reports"
  // college management 360
  | "college_activities"
  | "college_submissions"
  | "college_references"
  | "college_opportunities"
  | "college_events"
  | "college_feedback"
  | "college_finance"
  | "college_documents"
  // HR management 360
  | "hr_activities"
  | "hr_requirements"
  | "hr_drive_tasks"
  | "hr_submissions"
  | "hr_feedback";

export interface Query {
  eq?: Record<string, string | number | boolean | null>;
  in?: Record<string, (string | number)[]>;
  gte?: Record<string, string | number>;
  lte?: Record<string, string | number>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
}

export interface Store {
  readonly kind: "demo" | "supabase";
  select<T>(table: TableName, q?: Query): Promise<T[]>;
  insert<T>(table: TableName, rows: Partial<T>[]): Promise<T[]>;
  update<T>(table: TableName, match: Record<string, string | number>, patch: Partial<T>): Promise<void>;
  upsert<T>(table: TableName, rows: Partial<T>[], onConflict: string): Promise<void>;
  remove(table: TableName, match: Record<string, string | number>): Promise<void>;
  rpc<T>(fn: "set_student_status" | "process_expiry", args: Record<string, unknown>): Promise<T>;
}
