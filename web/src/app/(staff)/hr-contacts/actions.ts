"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHrRepo, excelRecipients } from "@/lib/hr";
import { createHrDriveRepo } from "@/lib/hr-drives";
import { getRepo } from "@/lib/server";
import { getStore, isAdmin, requireStaff } from "@/lib/session";
import { HR_STAGES, istToUtc, type Drive, type DriveResponse, type HrContact, type HrFeedback, type HrHistory, type HrRequirement, type HrStage, type HrSubmission } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Math.max(0, Math.trunc(Number(str(f, k)) || 0));
const go: (qs: string, msg: string, ok?: boolean) => never = (qs, msg, ok = true) =>
  redirect(`/hr-contacts?${qs}${qs ? "&" : ""}${ok ? "saved" : "error"}=${encodeURIComponent(msg)}`);
const back = (f: FormData, fallback: string) => {
  const b = str(f, "back");
  return b.startsWith("/hr-contacts")
    ? b.replace(/^\/hr-contacts\??/, "").replace(/(^|&)(saved|error)=[^&]*/g, "").replace(/^&/, "")
    : fallback;
};
const repo = async () => createHrRepo(await getStore());
const refresh = () => revalidatePath("/", "layout");

async function actor() {
  const s = await requireStaff();
  const me = await (await getRepo()).staffForUser(s.userId, s.email);
  return { session: s, name: me?.full_name ?? s.name };
}

/** Add an HR. Duplicates block the save unless the user confirms from the warning. */
export async function addHrAction(form: FormData) {
  const { name } = await actor();
  const full_name = str(form, "full_name");
  const phone = str(form, "phone");
  const email = str(form, "email");
  if (full_name.length < 2) go("tab=database&add=1", "Enter the HR's full name.", false);
  if (phone.replace(/\D/g, "").length < 10 && !email) go("tab=database&add=1", "Give a 10-digit mobile number or an official email.", false);

  const res = await (await repo()).create(
    {
      full_name, phone: phone || null, email: email || null,
      personal_email: str(form, "personal_email") || null,
      designation: str(form, "designation") || null,
      department: str(form, "department") || null,
      linkedin: str(form, "linkedin") || null,
      city: str(form, "city") || null,
      current_company: str(form, "current_company") || null,
      company_type: str(form, "company_type") || null,
      joined_on: str(form, "joined_on") || null,
      previous_company: str(form, "previous_company") || null,
      source: str(form, "source") || null,
      introduced_by: str(form, "introduced_by") || null,
      assigned_to: str(form, "assigned_to") || null,
      alt_assigned_to: str(form, "alt_assigned_to") || null,
      preferred_contact: str(form, "preferred_contact") || null,
      relationship_status: str(form, "relationship_status") || "new",
      hiring_status: str(form, "hiring_status") || "unknown",
      reference_note: str(form, "reference_note") || null,
    },
    name,
    { allowDuplicate: str(form, "confirm_duplicate") === "1" },
  );

  if (!res.ok) {
    const d = res.duplicates[0];
    go("tab=database&add=1", `Already on file: ${d.hr.full_name} (${d.hr.hr_code ?? "no code"}) — matched on ${res.duplicates[0].on.join(", ")}. Tick "add anyway" to override.`, false);
  }
  refresh();
  go(`tab=database&id=${res.hr.id}`, `${res.hr.full_name} added as ${res.hr.hr_code}.`);
}

export async function moveHrStageAction(id: string, stage: HrStage, form: FormData) {
  const { name } = await actor();
  if (!HR_STAGES.some((s) => s.key === stage)) go("tab=pipeline", "Choose a valid stage.", false);
  await (await repo()).moveStage(id, stage, name);
  refresh();
  go(back(form, `tab=database&id=${id}`), "Stage updated.");
}

/** Log a conversation and set the next follow-up in one step. */
export async function logContactAction(id: string, form: FormData) {
  const { name } = await actor();
  const qs = back(form, `tab=database&id=${id}`);
  const d = str(form, "next_date");
  const stage = str(form, "stage") as HrStage | "";
  if (stage && !HR_STAGES.some((s) => s.key === stage)) go(qs, "Choose a valid stage.", false);
  try {
    await (await repo()).contact(id, {
      mode: str(form, "mode"), activity: str(form, "activity"), outcome: str(form, "outcome"),
      remarks: str(form, "remarks"), stage,
      nextAt: /^\d{4}-\d{2}-\d{2}$/.test(d) ? istToUtc(d, str(form, "next_time") || "11:00") : null,
      nextNote: str(form, "next_note"),
    }, name);
  } catch (e) {
    go(qs, e instanceof Error ? e.message : "Could not save", false);
  }
  refresh();
  go(qs, "Conversation logged.");
}

/** Record a company change without overwriting the previous stint. */
export async function changeCompanyAction(id: string, form: FormData) {
  const { name } = await actor();
  const qs = back(form, `tab=database&id=${id}`);
  const from = str(form, "from_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) go(qs, "Give the joining date at the new company.", false);
  try {
    await (await repo()).changeCompany(id, {
      company: str(form, "company"), designation: str(form, "designation"), email: str(form, "email"),
      from, location: str(form, "location"), replacementHrId: str(form, "replacement_hr_id") || null,
    }, name);
  } catch (e) {
    go(qs, e instanceof Error ? e.message : "Could not save", false);
  }
  refresh();
  go(qs, "Company change recorded — previous stint kept.");
}

export async function allocateHrAction(form: FormData) {
  const s = await requireStaff();
  if (!isAdmin(s)) go("tab=dashboard", "Only admins can allocate HRs.", false);
  const to = str(form, "to");
  const staff = (await (await getRepo()).staff()).filter((x) => x.active !== false);
  if (!staff.some((x) => x.full_name === to)) go(back(form, "tab=database"), "Choose an active staff member.", false);
  const ids = form.getAll("ids").map(String).filter(Boolean);
  if (!ids.length) go(back(form, "tab=database"), "Select at least one HR.", false);
  const n = await (await repo()).allocate(ids, to, s.name);
  refresh();
  go(back(form, "tab=database"), `${n} HR${n === 1 ? "" : "s"} allocated to ${to}.`);
}

export async function addRequirementAction(form: FormData) {
  const { name } = await actor();
  const hr_id = str(form, "hr_id");
  const role = str(form, "role");
  if (!hr_id || role.length < 2) go("tab=requirements", "Choose the HR and give the role.", false);
  const db = await getStore();
  const [hr] = await db.select<HrContact>("hr_contacts", { eq: { id: hr_id } });
  if (!hr) go("tab=requirements", "HR not found.", false);
  await db.insert<HrRequirement>("hr_requirements", [{
    hr_id, company: hr.current_company ?? "—", role, vacancies: num(form, "vacancies"),
    expected_period: str(form, "expected_period") || null,
    expected_date: str(form, "expected_date") || null,
    qualification: str(form, "qualification") || null,
    branches: str(form, "branches") || null,
    package: str(form, "package") || null,
    experience: str(form, "experience") || null,
    location: str(form, "location") || hr.city || null,
    assigned_to: str(form, "assigned_to") || hr.assigned_to || null,
    status: (str(form, "status") || "pending") as HrRequirement["status"],
    notes: str(form, "notes") || null,
    created_by: name, created_at: new Date().toISOString(),
  }]);
  await (await repo()).log(hr_id, "note", `Hiring requirement added: ${role} (${num(form, "vacancies")} vacancies)`, name);
  refresh();
  go("tab=requirements", "Hiring requirement added.");
}

export async function setRequirementStatusAction(id: string, status: HrRequirement["status"], form: FormData) {
  await actor();
  await (await getStore()).update<HrRequirement>("hr_requirements", { id }, { status });
  refresh();
  go(back(form, "tab=requirements"), "Requirement updated.");
}

/* -------------------------------------------------------------------------- */
/* Phase 2: drive configuration, reminder sequence, Excel submissions, feedback */

const driveRepo = async () => createHrDriveRepo(await getStore());

/** §10 Save the HR-side configuration of a drive, then refresh its reminder sequence. */
export async function saveDriveConfigAction(id: string, form: FormData) {
  await actor();
  const qs = back(form, `tab=drives&drive=${id}`);
  const db = await getStore();
  const [drive] = await db.select<Drive>("placement_drives", { eq: { id } });
  if (!drive) go(qs, "Drive not found.", false);
  const lead = Math.min(60, Math.max(1, Number(str(form, "reminder_lead_days")) || 7));
  const closeD = str(form, "interest_close_date");
  const excelD = str(form, "excel_due_date");
  await db.update<Drive>("placement_drives", { id }, {
    hr_id: str(form, "hr_id") || null,
    coordinator: str(form, "coordinator") || null,
    vacancies: num(form, "vacancies"),
    qualification: str(form, "qualification") || null,
    branches: str(form, "branches") || null,
    passout: str(form, "passout") || null,
    experience: str(form, "experience") || null,
    interest_close_at: /^\d{4}-\d{2}-\d{2}$/.test(closeD) ? istToUtc(closeD, str(form, "interest_close_time") || "10:00") : null,
    excel_due_at: /^\d{4}-\d{2}-\d{2}$/.test(excelD) ? istToUtc(excelD, str(form, "excel_due_time") || "12:00") : null,
    sending_mode: str(form, "sending_mode") === "automatic" ? "automatic" : "after_approval",
    jd_url: str(form, "jd_url") || null,
    excel_format: str(form, "excel_format") || null,
    consent_required: str(form, "consent_required") === "1",
    reminder_lead_days: lead,
    confirmation: (str(form, "confirmation") || "pending") as Drive["confirmation"],
  });
  const added = await (await driveRepo()).syncSequence(id);
  refresh();
  go(qs, added ? `Drive saved — ${added} reminder step${added === 1 ? "" : "s"} created.` : "Drive saved.");
}

export async function syncSequenceAction(id: string, form: FormData) {
  await actor();
  const added = await (await driveRepo()).syncSequence(id);
  refresh();
  go(back(form, `tab=drives&drive=${id}`), added ? `${added} reminder step${added === 1 ? "" : "s"} created.` : "Sequence already complete.");
}

export async function completeTaskAction(id: string, form: FormData) {
  const { name } = await actor();
  await (await driveRepo()).completeTask(id, name);
  refresh();
  go(back(form, "tab=activities"), "Activity marked done.");
}

/**
 * §13 Prepare the student sheet. The recipient must be a current HR at the company
 * with a verified email — a previous HR is never a valid destination.
 */
export async function prepareSubmissionAction(driveId: string, form: FormData) {
  const { name } = await actor();
  const qs = back(form, `tab=interest&drive=${driveId}`);
  const db = await getStore();
  const [drive] = await db.select<Drive>("placement_drives", { eq: { id: driveId } });
  if (!drive) go(qs, "Drive not found.", false);
  const [contacts, history] = await Promise.all([
    db.select<HrContact>("hr_contacts"),
    db.select<HrHistory>("hr_company_history"),
  ]);
  const allowed = excelRecipients(contacts, history, drive.company);
  const hr = allowed.find((h) => h.id === str(form, "hr_id")) ?? allowed[0];
  if (!hr) go(qs, `No current HR with a verified email at ${drive.company} — the sheet cannot be sent.`, false);
  const responses = await db.select<DriveResponse>("drive_responses", { eq: { drive_id: driveId } });
  const count = responses.filter((r) => r.response === "yes").length;
  if (!count) go(qs, "No student has registered interest in this drive yet.", false);
  await db.insert<HrSubmission>("hr_submissions", [{
    drive_id: driveId, hr_id: hr.id, recipient_email: hr.email!, student_count: count,
    file_name: `${drive.company.replace(/[^A-Za-z0-9]+/g, "_")}_Interested_Students.xlsx`,
    scheduled_at: drive.excel_due_at ?? null,
    status: drive.sending_mode === "automatic" ? "scheduled" : "awaiting_approval",
    prepared_by: name, created_at: new Date().toISOString(),
  }]);
  refresh();
  go(qs, `Sheet prepared for ${hr.full_name} (${count} student${count === 1 ? "" : "s"}).`);
}

export async function approveSubmissionAction(id: string, form: FormData) {
  const { name } = await actor();
  const db = await getStore();
  const [sub] = await db.select<HrSubmission>("hr_submissions", { eq: { id } });
  if (!sub) go("tab=interest", "Submission not found.", false);
  if (sub.status === "sent") go(back(form, "tab=interest"), "That sheet has already been sent.", false);
  await db.update<HrSubmission>("hr_submissions", { id }, { status: "scheduled", approved_by: name });
  refresh();
  go(back(form, "tab=interest"), "Sheet approved and scheduled.");
}

/** §17 Record feedback from an HR together with the action we will take. */
export async function addFeedbackAction(form: FormData) {
  const { name } = await actor();
  const hr_id = str(form, "hr_id");
  const feedback = str(form, "feedback");
  if (!hr_id || feedback.length < 3) go("tab=feedback", "Choose the HR and write the feedback.", false);
  const db = await getStore();
  const [hr] = await db.select<HrContact>("hr_contacts", { eq: { id: hr_id } });
  if (!hr) go("tab=feedback", "HR not found.", false);
  await db.insert<HrFeedback>("hr_feedback", [{
    hr_id, drive_id: str(form, "drive_id") || null, company: hr.current_company ?? null,
    feedback: feedback.slice(0, 2000), sentiment: (str(form, "sentiment") || "neutral") as HrFeedback["sentiment"],
    action: str(form, "action") || null, assigned_to: str(form, "assigned_to") || hr.assigned_to || null,
    due_on: str(form, "due_on") || null, status: "open", created_by: name, created_at: new Date().toISOString(),
  }]);
  refresh();
  go("tab=feedback", "Feedback recorded.");
}

export async function closeFeedbackAction(id: string, form: FormData) {
  const { name } = await actor();
  await (await getStore()).update<HrFeedback>("hr_feedback", { id }, { status: "closed", closed_by: name, closed_at: new Date().toISOString() });
  refresh();
  go(back(form, "tab=feedback"), "Feedback closed.");
}
