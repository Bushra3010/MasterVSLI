import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/server";
import { getSession, isAdmin } from "@/lib/session";
import type { AuditRow } from "@/lib/types";

export const metadata = { title: "Audit log" };

const fmt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Every insert / update / delete on key records, with who made it (admins only). */
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const sp = await searchParams;
  const me = await getSession();
  if (!isAdmin(me)) return <><PageHeader title="Audit log" /><Empty>Only admins can view the audit log.</Empty></>;
  const table = typeof sp.table === "string" ? sp.table : "";
  const rows = (await (await getRepo()).list<AuditRow>("audit_log", { ...(table ? { eq: { table_name: table } } : {}), order: { column: "at", ascending: false }, limit: 300 }));
  const tables = ["students", "payments", "installments", "fee_allocations", "student_access", "staff", "payroll", "finance_entries", "invoices", "issued_letters", "profiles", "terms", "leads", "colleges", "mous", "vendors", "courses", "batches"];
  return (
    <>
      <PageHeader title="Audit log" subtitle="Who changed what, and when — recorded automatically by the database for key records." />
      <div className="mb-3 flex flex-wrap gap-1 text-xs">
        <Link href="/audit" className={`rounded-md border px-2 py-1 ${!table ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>All</Link>
        {tables.map((t) => <Link key={t} href={`/audit?table=${t}`} className={`rounded-md border px-2 py-1 ${table === t ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>{t.replace(/_/g, " ")}</Link>)}
      </div>
      <Card title={`Latest ${rows.length} changes`} icon={<ShieldCheck size={15} />} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>Record</th><th>Action</th><th>Change</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{new Date(r.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                <td className="text-xs">{r.user_email ?? "system"}</td>
                <td className="text-xs">{r.table_name.replace(/_/g, " ")}<div className="font-mono text-[10px] text-muted">{r.record_id?.slice(0, 12)}</div></td>
                <td><Badge tone={r.action === "delete" ? "red" : r.action === "insert" ? "green" : "blue"}>{r.action}</Badge></td>
                <td className="max-w-xl text-[11px]">
                  {r.action === "update" && r.changes
                    ? Object.entries(r.changes).slice(0, 6).map(([k, v]) => <div key={k}><b className="font-medium">{k}</b>: {fmt((v as unknown[])[0])} → {fmt((v as unknown[])[1])}</div>)
                    : <span className="text-muted">{r.action === "insert" ? "created" : "deleted"}</span>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="text-center text-muted">No changes recorded yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
