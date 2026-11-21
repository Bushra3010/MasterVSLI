import { fmtDate, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession } from "@/lib/session";
import type { College, HrContact, Lead, TpoContact } from "@/lib/types";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");

/** CSV exports for the Reports page (open directly in Excel): students, fees, placements, finance. */
export async function GET(_: Request, { params }: { params: Promise<{ report: string }> }) {
  const s = await getSession();
  if (!s || !["super_admin", "admin", "staff"].includes(s.role)) return new Response("Forbidden", { status: 403 });
  const { report } = await params;
  const repo = await getRepo();
  let rows: unknown[][];

  if (report === "students") {
    const list = await repo.students();
    rows = [
      ["Enrollment No", "Name", "Status", "Course", "Batch", "Mode", "Phone", "Email", "Admission", "Validity end", "Days left", "Attendance %", "Total fee", "Paid", "Balance"],
      ...list.map((x) => [x.enrollment_no, x.full_name, x.status, x.course_name, x.batch_name, x.training_mode, x.phone, x.email, x.admission_date, x.validity_end, x.days_left, x.attendance_pct, x.total_fee, x.paid, x.balance]),
    ];
  } else if (report === "fees") {
    const { vendors, allocations, installments, students } = await repo.ledger();
    const st = new Map(students.map((x) => [x.id, x]));
    const vn = new Map(vendors.map((v) => [v.id, v.name]));
    const av = new Map(allocations.map((a) => [a.id, a.vendor_id]));
    rows = [
      ["Enrollment No", "Student", "Vendor", "Sub-vendor", "Installment", "Due date", "Amount", "Paid", "Balance", "Status"],
      ...installments.map((i) => [st.get(i.student_id)?.enrollment_no, st.get(i.student_id)?.full_name, vn.get(av.get(i.allocation_id) ?? ""), vn.get(i.sub_vendor_id ?? "") ?? "Direct", i.seq, i.due_date, i.amount, i.paid_amount, Number(i.amount) - Number(i.paid_amount), i.status !== "paid" && i.due_date < todayISO() ? "overdue" : i.status]),
    ];
  } else if (report === "placements") {
    const [drives, responses, students] = await Promise.all([repo.drives(), repo.responses(), repo.students()]);
    const st = new Map(students.map((x) => [x.id, x]));
    const dr = new Map(drives.map((d) => [d.id, d]));
    rows = [
      ["Company", "Role", "Drive date", "Drive status", "Enrollment No", "Student", "Response", "Stage"],
      ...responses.map((r) => [dr.get(r.drive_id)?.company, dr.get(r.drive_id)?.job_role, dr.get(r.drive_id)?.drive_date, dr.get(r.drive_id)?.status, st.get(r.student_id)?.enrollment_no, st.get(r.student_id)?.full_name, r.response, r.stage]),
    ];
  } else if (report === "finance") {
    const [entries, { payments, students, vendors }] = await Promise.all([repo.financeEntries(), repo.ledger()]);
    const st = new Map(students.map((x) => [x.id, x.full_name]));
    const vn = new Map(vendors.map((v) => [v.id, v.name]));
    rows = [
      ["Date", "Type", "Category", "Party", "Reference", "Note", "Amount"],
      ...payments.map((p) => [fmtDate(p.paid_at), "fee income", p.mode, st.get(p.student_id), p.reference, "", p.amount]),
      ...entries.map((e) => [fmtDate(e.entry_date), e.kind, e.category, vn.get(e.vendor_id ?? ""), e.reference, e.note, e.kind === "income" ? e.amount : -Number(e.amount)]),
    ];
  } else if (report === "leads") {
    const leads = await repo.list<Lead>("leads", { order: { column: "created_at", ascending: false } });
    rows = [["Lead ID", "Name", "Phone", "Email", "City", "Source", "Course", "Stage", "Assigned to", "Next follow-up", "Added"], ...leads.map((l) => [l.lead_no, l.full_name, l.phone, l.email, l.city, l.source, l.course_code, l.stage, l.assigned_to, l.next_follow_up, l.created_at.slice(0, 10)])];
  } else if (report === "colleges") {
    const [cols, tpos] = await Promise.all([repo.list<College>("colleges"), repo.list<TpoContact>("tpo_contacts")]);
    rows = [["College", "Code", "City", "State", "Status", "TPO", "Designation", "Phone", "Email"], ...cols.flatMap((c) => { const t = tpos.filter((x) => x.college_id === c.id); return (t.length ? t : [null]).map((x) => [c.name, c.code, c.city, c.state, c.status, x?.name, x?.designation, x?.phone, x?.email]); })];
  } else if (report === "hr_contacts") {
    const hr = await repo.list<HrContact>("hr_contacts");
    rows = [["Name", "Designation", "Company", "Phone", "Email", "City", "LinkedIn"], ...hr.map((h) => [h.full_name, h.designation, h.current_company, h.phone, h.email, h.city, h.linkedin])];
  } else {
    return new Response("Unknown report", { status: 404 });
  }

  return new Response(csv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${report}_${todayISO()}.csv"` },
  });
}
