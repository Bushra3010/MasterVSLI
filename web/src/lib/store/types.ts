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
  | "admission_enquiries";

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
