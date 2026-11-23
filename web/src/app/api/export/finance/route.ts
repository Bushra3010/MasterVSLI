import { expenseLines, financialYear, incomeLines, lastMonths, monthOf, receivablesPayables, sumLines } from "@/lib/finance";
import { getFinance } from "@/lib/server";
import { getSession } from "@/lib/session";
import { ENTITIES, ENTITY_SHORT } from "@/lib/types-finance";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");

/** Finance exports (open in Excel). Admins only. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || (s.role !== "super_admin" && s.role !== "admin")) return new Response("Forbidden", { status: 403 });
  const type = new URL(req.url).searchParams.get("type") ?? "pnl";
  const d = await (await getFinance()).load();
  let rows: unknown[][];
  if (type === "income") rows = [["Date", "Entity", "Source", "Details", "Amount"], ...incomeLines(d).sort((a, b) => a.date.localeCompare(b.date)).map((l) => [l.date, ENTITY_SHORT[l.entity], l.category, l.label, l.amount])];
  else if (type === "expenses") rows = [["Date", "Entity", "Category", "Details", "Amount"], ...expenseLines(d).sort((a, b) => a.date.localeCompare(b.date)).map((l) => [l.date, ENTITY_SHORT[l.entity], l.category, l.label, l.amount])];
  else if (type === "receivables") {
    const { receivables, payables } = receivablesPayables(d);
    rows = [["Direction", "Entity", "Type", "Party", "Details", "Due", "Overdue", "Amount"], ...receivables.map((r) => ["Receivable", ENTITY_SHORT[r.entity], r.kind, r.party, r.detail, r.due ?? "", r.overdue ? "Yes" : "", r.amount]), ...payables.map((r) => ["Payable", ENTITY_SHORT[r.entity], r.kind, r.party, r.detail, r.due ?? "", r.overdue ? "Yes" : "", r.amount])];
  } else {
    const fy = financialYear(d.today);
    const inc = incomeLines(d);
    const exp = expenseLines(d);
    rows = [["Month", ...ENTITIES.flatMap((e) => [`${ENTITY_SHORT[e]} income`, `${ENTITY_SHORT[e]} expenses`]), "Total income", "Total expenses", "Net"]];
    for (const m of lastMonths(d.today, 12).filter((x) => x >= fy.from.slice(0, 7))) {
      const per = ENTITIES.flatMap((e) => [sumLines(inc, (l) => l.entity === e && monthOf(l.date) === m), sumLines(exp, (l) => l.entity === e && monthOf(l.date) === m)]);
      const i = sumLines(inc, (l) => monthOf(l.date) === m), x = sumLines(exp, (l) => monthOf(l.date) === m);
      rows.push([m, ...per, i, x, i - x]);
    }
  }
  return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="finance_${type}_${d.today}.csv"` } });
}
