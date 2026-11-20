import type { SupabaseClient } from "@supabase/supabase-js";
import type { Query, Store, TableName } from "./types";

/** supabase-js sends undefined fields in bulk inserts as NULL, which defeats column defaults (e.g. id). */
const clean = <T,>(rows: Partial<T>[]) =>
  rows.map((r) => Object.fromEntries(Object.entries(r as Record<string, unknown>).filter(([, v]) => v !== undefined)));

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  constructor(private db: SupabaseClient) {}

  async select<T>(table: TableName, q: Query = {}): Promise<T[]> {
    let b = this.db.from(table).select("*");
    for (const [k, v] of Object.entries(q.eq ?? {})) b = v === null ? b.is(k, null) : b.eq(k, v);
    for (const [k, v] of Object.entries(q.in ?? {})) b = b.in(k, v);
    for (const [k, v] of Object.entries(q.gte ?? {})) b = b.gte(k, v);
    for (const [k, v] of Object.entries(q.lte ?? {})) b = b.lte(k, v);
    if (q.order) b = b.order(q.order.column, { ascending: q.order.ascending ?? true });
    if (q.limit) b = b.limit(q.limit);
    const { data, error } = await b;
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as T[];
  }

  async insert<T>(table: TableName, rows: Partial<T>[]): Promise<T[]> {
    const { data, error } = await this.db.from(table).insert(clean(rows) as never).select("*");
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as T[];
  }

  async update<T>(table: TableName, match: Record<string, string | number>, patch: Partial<T>) {
    const { error } = await this.db.from(table).update(clean([patch])[0] as never).match(match);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  async upsert<T>(table: TableName, rows: Partial<T>[], onConflict: string) {
    const { error } = await this.db.from(table).upsert(clean(rows) as never, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  async remove(table: TableName, match: Record<string, string | number>) {
    const { error } = await this.db.from(table).delete().match(match);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }
}
