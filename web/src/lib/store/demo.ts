import { CHANNELS, type StudentStatus } from "../types";
import { daysBetween, todayISO } from "../format";
import { buildSeed, type DemoTables } from "./seed";
import type { Query, Store, TableName } from "./types";

type Row = Record<string, unknown>;

/** Bump whenever buildSeed() gains or drops a table, so a store cached by an older
 *  module is rebuilt instead of serving `undefined` for the new tables. */
const SEED_REVISION = 7;

const g = globalThis as unknown as { __mvlDemo?: DemoTables; __mvlRev?: number; __mvlSeq?: number };

/** The seed is cached on globalThis so demo edits survive hot reloads in dev. */
function db(): DemoTables {
  if (!g.__mvlDemo || g.__mvlRev !== SEED_REVISION) {
    g.__mvlDemo = buildSeed();
    g.__mvlRev = SEED_REVISION;
  }
  return g.__mvlDemo;
}
const nextId = () => (g.__mvlSeq = (g.__mvlSeq ?? 100000) + 1);
const uuid = () => crypto.randomUUID();

function matches(row: Row, q: Query) {
  for (const [k, v] of Object.entries(q.eq ?? {})) if ((row[k] ?? null) !== v) return false;
  for (const [k, v] of Object.entries(q.in ?? {})) if (!v.includes(row[k] as string)) return false;
  for (const [k, v] of Object.entries(q.gte ?? {})) if ((row[k] as string) < (v as string)) return false;
  for (const [k, v] of Object.entries(q.lte ?? {})) if ((row[k] as string) > (v as string)) return false;
  return true;
}

const AUDITED = new Set(["students", "fee_allocations", "installments", "payments", "vendors", "courses", "batches", "staff", "payroll", "finance_entries", "invoices", "issued_letters", "student_access", "profiles", "terms", "leads", "colleges", "mous"]);
function audit(t: string, action: string, row: Row, changes: unknown) {
  if (!AUDITED.has(t)) return;
  db().audit_log.unshift({ id: nextId(), at: new Date().toISOString(), user_id: null, user_email: "demo admin", table_name: t, action, record_id: String(row.id ?? row.student_id ?? ""), changes: changes as Record<string, unknown> });
}

/** In-memory store that mirrors the SQL triggers and functions in supabase/migrations. */
export class DemoStore implements Store {
  readonly kind = "demo" as const;

  private table(t: TableName) {
    return db()[t] as unknown as Row[];
  }

  async select<T>(t: TableName, q: Query = {}): Promise<T[]> {
    let rows = this.table(t).filter((r) => matches(r, q));
    if (q.order) {
      const { column, ascending = true } = q.order;
      rows = [...rows].sort((a, b) => {
        const x = a[column] as string, y = b[column] as string;
        return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
      });
    }
    if (q.limit) rows = rows.slice(0, q.limit);
    return structuredClone(rows) as T[];
  }

  async insert<T>(t: TableName, rows: Partial<T>[]): Promise<T[]> {
    const out: Row[] = [];
    for (const input of rows as Row[]) {
      const row: Row = { ...input };
      if (row.id === undefined && !["student_access", "drive_responses", "module_progress", "college_logins", "company_profiles"].includes(t))
        row.id = ["access_events", "attendance_records", "notifications", "audit_log"].includes(t) ? nextId() : uuid();
      if (t === "attendance_records") {
        const dup = this.table(t).some(
          (r) => r.student_id === row.student_id && r.source === row.source && r.session_date === row.session_date && r.external_ref === row.external_ref,
        );
        if (dup) throw new Error("attendance_records: duplicate key");
      }
      this.table(t).push(row);
      out.push(row);
      audit(t, "insert", row, row);
      // --- trigger emulation -------------------------------------------------
      if (t === "students")
        for (const ch of CHANNELS)
          this.table("student_access").push({ student_id: row.id, channel: ch, enabled: row.status === "active", external_ref: null });
      if (t === "payments") {
        const inst = this.table("installments").find((i) => i.id === row.installment_id);
        if (inst) {
          inst.paid_amount = (inst.paid_amount as number) + (row.amount as number);
          inst.status = (inst.paid_amount as number) >= (inst.amount as number) ? "paid" : "partial";
        }
      }
    }
    return structuredClone(out) as T[];
  }

  async update<T>(t: TableName, match: Record<string, string | number>, patch: Partial<T>) {
    for (const r of this.table(t))
      if (matches(r, { eq: match })) {
        const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        const diff = Object.fromEntries(Object.entries(patch as Row).filter(([k, v]) => !same(r[k], v) && k !== "updated_at").map(([k, v]) => [k, [r[k] ?? null, v ?? null]]));
        Object.assign(r, patch);
        if (Object.keys(diff).length) audit(t, "update", r, diff);
      }
  }

  async remove(t: TableName, match: Record<string, string | number>) {
    const rows = this.table(t);
    for (let i = rows.length - 1; i >= 0; i--)
      if (matches(rows[i], { eq: match })) {
        audit(t, "delete", rows[i], rows[i]);
        rows.splice(i, 1);
      }
  }

  async upsert<T>(t: TableName, rows: Partial<T>[], onConflict: string) {
    const keys = onConflict.split(",").map((k) => k.trim());
    for (const input of rows as Row[]) {
      const existing = this.table(t).find((r) => keys.every((k) => r[k] === input[k]));
      if (existing) Object.assign(existing, input);
      else await this.insert(t, [input]);
    }
  }

  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    if (fn === "set_student_status") {
      const { p_student, p_status, p_reason } = args as { p_student: string; p_status: StudentStatus; p_reason?: string };
      this.setStatus(p_student, p_status, p_reason);
      return undefined as T;
    }
    if (fn === "process_expiry") {
      const today = todayISO();
      const out: { student_id: string; kind: string }[] = [];
      for (const s of this.table("students")) {
        if (!s.validity_end || !["active", "on_hold"].includes(s.status as string)) continue;
        const left = daysBetween(today, s.validity_end as string);
        let kind: string | null = null;
        if (left <= 0) {
          this.setStatus(s.id as string, "expired", "Training validity ended");
          kind = "expired";
        } else if ([30, 15, 7, 1].includes(left)) kind = `expiry_${left}`;
        if (!kind) continue;
        const n = this.table("notifications");
        if (!n.some((x) => x.student_id === s.id && x.kind === kind))
          n.push({ id: nextId(), student_id: s.id, kind, channel: "email", sent_at: null, created_at: new Date().toISOString() });
        out.push({ student_id: s.id as string, kind });
      }
      return out as T;
    }
    throw new Error(`unknown rpc ${fn}`);
  }

  private setStatus(id: string, status: StudentStatus, reason?: string) {
    const s = this.table("students").find((x) => x.id === id);
    if (!s) return;
    s.status = status;
    for (const a of this.table("student_access")) if (a.student_id === id) a.enabled = status === "active";
    const action = status === "active" ? "activate" : status === "on_hold" ? "hold" : status === "expired" ? "expire" : status;
    this.table("access_events").push({ id: nextId(), student_id: id, action, reason: reason ?? null, created_at: new Date().toISOString() });
  }
}
