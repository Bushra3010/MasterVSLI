"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayISO } from "@/lib/format";
import { createLeadRepo, parseCsv } from "@/lib/leads";
import { getRepo } from "@/lib/server";
import { getStore, isAdmin, requireStaff } from "@/lib/session";
import { istToUtc, LEAD_PRIORITIES, LEAD_STAGES, type LeadPriority, type LeadStage, type Staff } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const go = (qs: string, msg: string, ok = true): never => redirect(`/leads?${qs}${qs ? "&" : ""}${ok ? "saved" : "error"}=${encodeURIComponent(msg)}`);
const leadRepo = async () => createLeadRepo(await getStore());
const refresh = () => revalidatePath("/", "layout");
/** Only return to /leads URLs. */
const backQs = (f: FormData) => {
  const b = str(f, "back");
  return b.startsWith("/leads") ? b.replace(/^\/leads\??/, "").replace(/(^|&)(saved|error)=[^&]*/g, "").replace(/^&/, "") : "";
};

async function adminOnly() {
  const s = await requireStaff();
  if (!isAdmin(s)) go("", "Only admins can do that.", false);
  return s;
}

/** The staff member behind the current login (for accountability), else the login's own name. */
async function actor() {
  const s = await requireStaff();
  const me = await (await getRepo()).staffForUser(s.userId, s.email);
  return { session: s, name: me?.full_name ?? s.name };
}

const deadlineOf = (f: FormData) => {
  const d = str(f, "deadline_date");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? istToUtc(d, str(f, "deadline_time") || "18:00") : null;
};
const priorityOf = (f: FormData): LeadPriority => (LEAD_PRIORITIES.some(([k]) => k === str(f, "priority")) ? (str(f, "priority") as LeadPriority) : "normal");

export async function addLeadAction(form: FormData) {
  const { session, name } = await actor();
  const full_name = str(form, "full_name");
  if (full_name.length < 2) go("tab=all", "Enter the lead's name.", false);
  const phone = str(form, "phone");
  if (phone && phone.replace(/\D/g, "").length < 10) go("tab=all", "Enter a 10-digit mobile number.", false);
  const email = str(form, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) go("tab=all", "Enter a valid email.", false);
  const assigned = str(form, "assigned_to");
  const res = await (await leadRepo()).create(
    { full_name, phone: phone || null, email: email || null, city: str(form, "city") || null, source: str(form, "source") || "Manual call", course_code: str(form, "course_code") || null, remarks: str(form, "remarks") || null, assigned_to: assigned || name },
    name,
    { allowDuplicate: isAdmin(session) && form.get("allow_duplicate") === "on" },
  );
  if (!res.ok) {
    const { duplicate, student } = res;
    const what = student ? `registered student ${student.full_name} (${student.enrollment_no})` : `lead ${duplicate?.full_name} (${duplicate?.lead_no})`;
    go(duplicate ? `tab=duplicates&id=${duplicate.id}` : "tab=duplicates", `Duplicate mobile number — already used by ${what}.`, false);
    return;
  }
  refresh();
  redirect(`/leads?id=${res.lead.id}`);
}

export async function allocateAction(form: FormData) {
  const s = await adminOnly();
  const mode = str(form, "mode") as "individual" | "bulk" | "stage";
  const to = str(form, "to");
  const roundRobin = to === "__round_robin";
  const counsellors = await (await leadRepo()).counsellors();
  if (!roundRobin && !counsellors.some((c) => c.full_name === to)) go("tab=allocation", "Choose an active counsellor.", false);
  let ids: string[] = [];
  if (mode === "stage") {
    const stage = str(form, "stage") as LeadStage;
    if (!LEAD_STAGES.some((x) => x.key === stage)) go("tab=allocation", "Choose a pipeline stage.", false);
    const onlyUnassigned = form.get("only_unassigned") === "on";
    ids = (await (await leadRepo()).leads()).filter((l) => l.stage === stage && (!onlyUnassigned || !l.assigned_to)).map((l) => l.id);
  } else ids = form.getAll("ids").map(String).filter(Boolean);
  if (!ids.length) go("tab=allocation", "Select at least one lead.", false);
  const n = await (await leadRepo()).allocate(ids, roundRobin ? { roundRobin: true } : { to }, { deadline: deadlineOf(form), priority: priorityOf(form), instructions: str(form, "instructions").slice(0, 300) || null, mode: mode === "stage" ? "stage" : ids.length > 1 ? "bulk" : "individual" }, s.name);
  refresh();
  const back = backQs(form);
  go(back || "tab=allocation", `${n} lead${n === 1 ? "" : "s"} allocated${roundRobin ? " (round-robin)" : ` to ${to}`}.`);
}

export async function followUpAction(leadId: string, form: FormData) {
  const { name } = await actor();
  const back = backQs(form) || `id=${leadId}`;
  const d = str(form, "next_date");
  try {
    await (await leadRepo()).completeFollowUp(leadId, {
      outcome: str(form, "outcome"),
      remarks: str(form, "remarks"),
      nextAction: str(form, "next_action"),
      nextAt: /^\d{4}-\d{2}-\d{2}$/.test(d) ? istToUtc(d, str(form, "next_time") || "11:00") : null,
      taskId: str(form, "task_id") || null,
    }, name);
  } catch (e) {
    go(back, e instanceof Error ? e.message : "Could not save the follow-up", false);
  }
  refresh();
  go(back, "Follow-up saved.");
}

export async function completeTaskAction(taskId: string, form: FormData) {
  const { name } = await actor();
  const remarks = str(form, "remarks");
  if (remarks.length < 3) go(backQs(form) || "tab=workspace", "Add a remark to complete the task.", false);
  await (await leadRepo()).completeTask(taskId, name, remarks.slice(0, 500));
  refresh();
  go(backQs(form) || "tab=workspace", "Task completed. The lead stays open until its stage is closed.");
}

export async function archiveLeadAction(id: string, form: FormData) {
  const s = await adminOnly();
  await (await leadRepo()).archive(id, str(form, "reason") || "Archived by admin", s.name);
  refresh();
  go("tab=archive", "Lead archived.");
}
export async function restoreLeadAction(id: string) {
  const s = await adminOnly();
  await (await leadRepo()).restore(id, s.name);
  refresh();
  go("tab=archive", "Lead restored.");
}
export async function mergeDuplicateAction(dupId: string, keepId: string) {
  const s = await adminOnly();
  await (await leadRepo()).mergeDuplicate(dupId, keepId, s.name);
  refresh();
  go("tab=duplicates", "Duplicate merged — kept the original lead.");
}

export async function bulkUploadAction(form: FormData) {
  const s = await adminOnly();
  const file = form.get("file");
  let text = str(form, "csv");
  if (file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) go("tab=upload", "The file must be 2 MB or smaller.", false);
    text = await file.text();
  }
  const rows = parseCsv(text);
  if (!rows.length) go("tab=upload", "No rows found. The first line must be the header (name, phone, …).", false);
  if (rows.length > 2000) go("tab=upload", "Upload at most 2,000 leads at a time.", false);
  const repo = await leadRepo();
  const to = str(form, "to");
  const counsellors = await repo.counsellors();
  if (to && to !== "__round_robin" && !counsellors.some((c) => c.full_name === to)) go("tab=upload", "Choose an active counsellor.", false);
  const seen = new Set<string>();
  let added = 0, dup = 0, invalid = 0;
  const created: string[] = [];
  for (const r of rows) {
    const full_name = r.full_name || r.name || r.student_name || "";
    const phone = r.phone || r.mobile || r.mobile_number || r.contact || "";
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (full_name.length < 2 || digits.length < 10) { invalid++; continue; }
    if (seen.has(digits)) { dup++; continue; }
    seen.add(digits);
    const res = await repo.create({ full_name, phone, email: r.email || null, city: r.city || r.location || null, source: r.source || str(form, "source") || "Bulk upload", course_code: r.course || r.course_code || null, remarks: r.remarks || null }, s.name);
    if (!res.ok) { dup++; continue; }
    added++;
    created.push(res.lead.id);
  }
  if (to && created.length) await repo.allocate(created, to === "__round_robin" ? { roundRobin: true } : { to }, { deadline: deadlineOf(form), priority: priorityOf(form), instructions: str(form, "instructions") || null, mode: "upload" }, s.name);
  refresh();
  go("tab=upload", `${added} added · ${dup} duplicates removed · ${invalid} rows skipped (missing name or mobile).`);
}

export async function saveCounsellorAction(staffId: string, form: FormData) {
  const s = await adminOnly();
  const db = await getStore();
  const [st] = await db.select<Staff>("staff", { eq: { id: staffId } });
  if (!st) go("tab=counsellors", "Staff member not found.", false);
  const active = form.get("active") === "on";
  await db.update<Staff>("staff", { id: staffId }, { counsellor: form.get("counsellor") === "on", active, lead_capacity: Math.max(1, Math.min(500, Number(str(form, "lead_capacity")) || 30)) });
  // Deactivated counsellors keep their history; their open leads can move to someone else.
  const moveTo = str(form, "move_to");
  if (!active && moveTo && moveTo !== st.full_name) {
    const open = (await (await leadRepo()).leads()).filter((l) => l.assigned_to === st.full_name && !["enrolled", "lost"].includes(l.stage)).map((l) => l.id);
    await (await leadRepo()).allocate(open, { to: moveTo }, { mode: "individual", instructions: `Moved from ${st.full_name} (deactivated)` }, s.name);
  }
  refresh();
  go("tab=counsellors", `${st.full_name} updated.`);
}

export async function saveLeadSettingsAction(form: FormData) {
  await adminOnly();
  const time = str(form, "report_time");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) go("tab=report", "Enter the report time as HH:MM.", false);
  const email = str(form, "report_email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) go("tab=report", "Enter a valid email.", false);
  await (await leadRepo()).saveSettings({ report_time: time, report_email: email || null });
  refresh();
  go("tab=report", "Report settings saved.");
}

export async function generateReportAction(form: FormData) {
  await adminOnly();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(form, "date")) ? str(form, "date") : todayISO();
  const repo = await leadRepo();
  await repo.saveReport(await repo.dailyReport(date));
  refresh();
  go(`tab=report&date=${date}`, `Report for ${date} generated and saved.`);
}

