import { todayISO } from "@/lib/format";
import { createLeadRepo } from "@/lib/leads";
import { getSession, getStore } from "@/lib/session";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Daily lead report as CSV — admins only (controlled export). */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || (s.role !== "super_admin" && s.role !== "admin")) return new Response("Forbidden", { status: 403 });
  const q = new URL(req.url).searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayISO();
  const r = await createLeadRepo(await getStore()).dailyReport(date);
  const head = ["Counsellor", "Allocated", "Attended", "Pending", "Connected", "Non-connected", "Interested", "Visit scheduled", "Visited", "Converted"];
  const row = (x: typeof r.total) => [x.name, x.allocated, x.attended, x.pending, x.connected, x.non_connected, x.interested, x.scheduled, x.visited, x.converted];
  const rows = [["Daily Lead Management Report", date], head, ...r.rows.map(row), row(r.total), [], ["Daily allocated lead completion %", r.completion]];
  return new Response("﻿" + rows.map((x) => x.map(esc).join(",")).join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="lead_report_${date}.csv"` },
  });
}
