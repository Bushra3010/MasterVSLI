"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCollegeRepo } from "@/lib/colleges";
import { createLeadRepo } from "@/lib/leads";
import { getRepo } from "@/lib/server";
import { getStore, isAdmin, requireStaff } from "@/lib/session";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, putFile, safeFileName } from "@/lib/storage";
import { COLLEGE_STAGES, istToUtc, type College, type CollegeDocument, type CollegeStage, type TpoContact } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const go = (qs: string, msg: string, ok = true): never => redirect(`/colleges?${qs}${qs ? "&" : ""}${ok ? "saved" : "error"}=${encodeURIComponent(msg)}`);
const back = (f: FormData, fallback: string) => {
  const b = str(f, "back");
  return b.startsWith("/colleges") ? b.replace(/^\/colleges\??/, "").replace(/(^|&)(saved|error)=[^&]*/g, "").replace(/^&/, "") : fallback;
};
const repo = async () => createCollegeRepo(await getStore());
const refresh = () => revalidatePath("/", "layout");

async function actor() {
  const s = await requireStaff();
  const me = await (await getRepo()).staffForUser(s.userId, s.email);
  return { session: s, name: me?.full_name ?? s.name };
}

export async function collegeFollowUpAction(id: string, form: FormData) {
  const { name } = await actor();
  const qs = back(form, `tab=colleges&id=${id}`);
  const d = str(form, "next_date");
  const stage = str(form, "stage") as CollegeStage | "";
  if (stage && !COLLEGE_STAGES.some((s) => s.key === stage)) go(qs, "Choose a valid stage.", false);
  try {
    await (await repo()).followUp(id, { kind: str(form, "kind"), remarks: str(form, "remarks"), stage, nextAction: str(form, "next_action"), nextAt: /^\d{4}-\d{2}-\d{2}$/.test(d) ? istToUtc(d, str(form, "next_time") || "11:00") : null }, name);
  } catch (e) {
    go(qs, e instanceof Error ? e.message : "Could not save", false);
  }
  refresh();
  go(qs, "Follow-up saved.");
}

export async function moveCollegeStageAction(id: string, stage: CollegeStage, form: FormData) {
  const { name } = await actor();
  await (await repo()).moveStage(id, stage, name);
  refresh();
  go(back(form, `tab=colleges&id=${id}`), "Stage updated.");
}

export async function allocateCollegesAction(form: FormData) {
  const s = await requireStaff();
  if (!isAdmin(s)) go("tab=dashboard", "Only admins can allocate colleges.", false);
  const to = str(form, "to");
  const staff = (await (await getRepo()).staff()).filter((x) => x.active !== false);
  if (!staff.some((x) => x.full_name === to)) go(back(form, "tab=colleges"), "Choose an active staff member.", false);
  const ids = form.getAll("ids").map(String).filter(Boolean);
  if (!ids.length) go(back(form, "tab=colleges"), "Select at least one college.", false);
  const n = await (await repo()).allocate(ids, to, s.name);
  refresh();
  go(back(form, "tab=colleges"), `${n} college${n === 1 ? "" : "s"} allocated to ${to}.`);
}

export async function verifySubmissionAction(id: string, form: FormData) {
  const { name } = await actor();
  const target = str(form, "college_id");
  if (target && target !== "__new") {
    const [c] = await (await getStore()).select<College>("colleges", { eq: { id: target } });
    if (!c) go("tab=incoming", "Choose the college to merge into.", false);
  }
  const collegeId = await (await repo()).verify(id, target && target !== "__new" ? target : null, name);
  refresh();
  if (!collegeId) go("tab=incoming", "That entry was already handled.", false);
  go("tab=incoming", target && target !== "__new" ? "Verified and merged into the existing college." : "Verified — new college created.");
}

export async function rejectSubmissionAction(id: string, form: FormData) {
  const { name } = await actor();
  await (await repo()).reject(id, name, str(form, "note"));
  refresh();
  go("tab=incoming", "Entry rejected.");
}

export async function setContactStatusAction(id: string, status: TpoContact["call_status"], form: FormData) {
  const { name } = await actor();
  const db = await getStore();
  const [t] = await db.select<TpoContact>("tpo_contacts", { eq: { id } });
  if (!t) go("tab=contacts", "Contact not found.", false);
  await db.update<TpoContact>("tpo_contacts", { id }, { call_status: status, last_interaction: new Date().toISOString().slice(0, 10) });
  await (await repo()).log(t.college_id, "call", `${t.name}: ${status === "connected" ? "connected" : "not connected"}${str(form, "note") ? ` — ${str(form, "note")}` : ""}`, name);
  refresh();
  go(back(form, "tab=contacts"), "Call status saved.");
}

export async function addCollegeLeadAction(form: FormData) {
  const { session, name } = await actor();
  const college_id = str(form, "college_id");
  const full_name = str(form, "full_name");
  const phone = str(form, "phone");
  if (!college_id || full_name.length < 2 || phone.replace(/\D/g, "").length < 10) go("tab=student-leads", "College, student name and a 10-digit mobile are required.", false);
  const res = await createLeadRepo(await getStore()).create(
    { full_name, phone, email: str(form, "email") || null, source: "College / TPO", course_code: str(form, "course_code") || null, college_id, remarks: str(form, "remarks") || null, assigned_to: str(form, "assigned_to") || null },
    name,
    { allowDuplicate: false },
  );
  void session;
  if (!res.ok) go("tab=student-leads", "Duplicate mobile number — this student is already a lead or a registered student.", false);
  refresh();
  go("tab=student-leads", "Student lead added to Lead Management.");
}

export async function uploadCollegeDocAction(form: FormData) {
  const { name } = await actor();
  const college_id = str(form, "college_id");
  const title = str(form, "title");
  if (!college_id || title.length < 2) go("tab=documents", "Choose the college and give the document a title.", false);
  const url = str(form, "url");
  if (url && !/^https:\/\//.test(url)) go("tab=documents", "Links must start with https://", false);
  const file = form.get("file");
  let storage_path: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) go("tab=documents", "Files must be 5 MB or smaller.", false);
    if (!ALLOWED_TYPES[file.type]) go("tab=documents", "Upload a PDF, JPG, PNG, WEBP or Word file.", false);
    storage_path = `colleges/${college_id}/${Date.now()}-${safeFileName(file.name)}`;
    await putFile(storage_path, file);
  }
  if (!url && !storage_path) go("tab=documents", "Attach a file or paste a link.", false);
  await (await getStore()).insert<CollegeDocument>("college_documents", [{ college_id, title: title.slice(0, 120), kind: str(form, "kind") || "other", url: url || null, storage_path, uploaded_by: name, created_at: new Date().toISOString() }]);
  refresh();
  go("tab=documents", "Document saved.");
}
