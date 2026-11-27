"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServiceRepo } from "@/lib/server";
import { getServiceStore, requireStudent } from "@/lib/session";
import { createStudent360Repo, isAlumni } from "@/lib/student360";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, putFile, safeFileName } from "@/lib/storage";
import { todayISO } from "@/lib/format";
import { ALUMNI_PARTICIPATION, PAYMENT_MODES, REQUEST_KINDS, type AlumniProfile, type RequestKind, type Student } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (path: string, msg: string, ok = true): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${ok ? "saved" : "error"}=${encodeURIComponent(msg)}`);
/** Only same-site portal paths may be used as a return address. */
const safeBack = (v: string) => (v.startsWith("/portal") && !v.startsWith("//") ? v.split("#")[0] : "/portal");

/** Stores an optional file the student attached; returns the document id. */
async function saveFile(studentId: string, kind: string, file: FormDataEntryValue | null): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Files must be 5 MB or smaller.");
  if (!ALLOWED_TYPES[file.type]) throw new Error("Upload a PDF, JPG, PNG, WEBP or Word file.");
  const path = `${studentId}/${kind}/${Date.now()}-${safeFileName(file.name)}`;
  await putFile(path, file);
  const d = await getServiceRepo().addDocument(studentId, kind, path);
  return d?.id ?? null;
}

const repo = () => createStudent360Repo(getServiceStore());

export async function ackReminderAction(key: string, form: FormData) {
  const s = await requireStudent();
  if (!/^(attendance|placement|interview|validity)-[\w-]+$/.test(key)) back("/portal", "That reminder can't be dismissed.", false);
  await repo().ack(s.studentId, key);
  revalidatePath("/portal", "layout");
  redirect(safeBack(str(form, "back")));
}

export async function explainMissedAction(id: string, form: FormData) {
  const s = await requireStudent();
  const text = str(form, "explanation");
  if (text.length < 10) back("/portal/interviews", "Please write at least a sentence explaining what happened.", false);
  const [iv] = (await repo().interviews(s.studentId)).filter((x) => x.id === id);
  if (!iv || iv.status !== "missed") back("/portal/interviews", "Interview not found.", false);
  await repo().explain(id, s.studentId, text.slice(0, 2000));
  revalidatePath("/portal", "layout");
  back("/portal/interviews", "Explanation submitted to the placement team.");
}

export async function addResumeAction(form: FormData) {
  const s = await requireStudent();
  const title = str(form, "title");
  if (title.length < 2) back("/portal/resumes", "Give the resume a name.", false);
  let document_id: string | null = null;
  try {
    document_id = await saveFile(s.studentId, "resume", form.get("file"));
  } catch (e) {
    back("/portal/resumes", e instanceof Error ? e.message : "Upload failed", false);
  }
  if (!document_id) back("/portal/resumes", "Choose the resume file to upload.", false);
  await repo().addResume({ student_id: s.studentId, title: title.slice(0, 80), domain: str(form, "domain") || null, version: str(form, "version") || "v1", document_id });
  revalidatePath("/portal", "layout");
  back("/portal/resumes", "Resume added.");
}

export async function setDefaultResumeAction(id: string) {
  const s = await requireStudent();
  await repo().setDefaultResume(s.studentId, id);
  revalidatePath("/portal/resumes");
  back("/portal/resumes", "Default resume updated.");
}

export async function removeResumeAction(id: string) {
  const s = await requireStudent();
  await repo().removeResume(s.studentId, id);
  revalidatePath("/portal", "layout");
  back("/portal/resumes", "Resume removed.");
}

export async function submitPaymentAction(form: FormData) {
  const s = await requireStudent();
  const installment_id = str(form, "installment_id");
  const amount = Number(str(form, "amount"));
  const mode = str(form, "mode");
  const reference = str(form, "reference");
  const paid_on = str(form, "paid_on") || todayISO();
  const p = await getServiceRepo().profile(s.studentId);
  const inst = p?.installments.find((i) => i.id === installment_id);
  if (!inst || inst.status === "paid") back("/portal/fees", "Choose an unpaid installment.", false);
  if (!(amount > 0)) back("/portal/fees", "Enter the amount you paid.", false);
  if (!PAYMENT_MODES.includes(mode)) back("/portal/fees", "Choose how you paid.", false);
  if (mode !== "Cash" && reference.length < 3) back("/portal/fees", "Enter the transaction / UTR reference.", false);
  if (paid_on > todayISO()) back("/portal/fees", "The payment date can't be in the future.", false);
  let document_id: string | null = null;
  try {
    document_id = await saveFile(s.studentId, "other", form.get("proof"));
  } catch (e) {
    back("/portal/fees", e instanceof Error ? e.message : "Upload failed", false);
  }
  await repo().submitPayment({ student_id: s.studentId, installment_id, amount, mode, reference: reference || null, paid_on, document_id, note: str(form, "note").slice(0, 500) || null });
  revalidatePath("/portal", "layout");
  back("/portal/fees", "Payment submitted. The office will verify it; your receipt appears once it is approved.");
}

export async function submitRequestAction(form: FormData) {
  const s = await requireStudent();
  const kind = str(form, "kind") as RequestKind;
  if (!REQUEST_KINDS.some(([k]) => k === kind)) back("/portal/requests", "Choose a request type.", false);
  const data: Record<string, unknown> = {};
  let subject = str(form, "subject");
  if (kind === "certificate") {
    data.type = str(form, "cert_type") || "Training certificate";
    subject ||= String(data.type);
  }
  if (kind === "validity_extension") {
    const months = Number(str(form, "months"));
    if (![1, 2, 3, 6].includes(months)) back("/portal/requests?kind=validity_extension", "Choose how many months.", false);
    data.months = months;
    subject = `Validity extension — ${months} month${months > 1 ? "s" : ""}`;
    const open = (await repo().requests(s.studentId)).some((r) => r.kind === "validity_extension" && (r.status === "open" || r.status === "in_progress"));
    if (open) back("/portal/requests", "You already have a validity extension request waiting.", false);
  }
  if (subject.length < 3) back(`/portal/requests?kind=${kind}`, "Add a short subject.", false);
  await repo().addRequest({ student_id: s.studentId, kind, subject: subject.slice(0, 120), details: str(form, "details").slice(0, 2000) || null, data });
  revalidatePath("/portal", "layout");
  back("/portal/requests", "Request sent to the office. You can track it here.");
}

export async function saveAlumniAction(form: FormData) {
  const s = await requireStudent();
  const db = getServiceStore();
  const [st] = await db.select<Student>("students", { eq: { id: s.studentId } });
  if (!st || !isAlumni(st)) back("/portal", "The Alumni Profile opens after your training validity ends.", false);
  const changes = [0, 1, 2]
    .map((i) => ({ company: str(form, `chg.${i}.company`), designation: str(form, `chg.${i}.designation`) || undefined, from: str(form, `chg.${i}.from`) || undefined }))
    .filter((c) => c.company);
  const alumni: AlumniProfile = {
    company: str(form, "company") || undefined,
    designation: str(form, "designation") || undefined,
    location: str(form, "location") || undefined,
    package: str(form, "package") || undefined,
    since: str(form, "since") || undefined,
    linkedin: str(form, "linkedin") || undefined,
    changes,
    hiring: str(form, "hiring").slice(0, 1000) || undefined,
    participation: form.getAll("participation").map(String).filter((p) => ALUMNI_PARTICIPATION.includes(p)),
    updated_at: new Date().toISOString(),
  };
  await db.update<Student>("students", { id: s.studentId }, { extra: { ...(st.extra ?? {}), alumni } });
  revalidatePath("/portal", "layout");
  back("/portal/alumni", "Alumni profile saved. Thank you for staying in touch!");
}

/** Students share their college's TPO / HOD / faculty contact; staff verify it under College Management → Incoming Leads. */
export async function submitCollegeContactAction(form: FormData) {
  const s = await requireStudent();
  const college_name = str(form, "college_name");
  const contact_name = str(form, "contact_name");
  const phone = str(form, "phone");
  if (college_name.length < 3 || contact_name.length < 2) back("/portal/requests", "Enter the college and the contact person's name.", false);
  if (phone.replace(/\D/g, "").length < 10) back("/portal/requests", "Enter the contact's 10-digit mobile number.", false);
  const { createCollegeRepo } = await import("@/lib/colleges");
  const [st] = await getServiceStore().select<Student>("students", { eq: { id: s.studentId } });
  await createCollegeRepo(getServiceStore()).submit({
    college_name: college_name.slice(0, 160), city: str(form, "city").slice(0, 80) || null, state: null, contact_name: contact_name.slice(0, 120),
    designation: str(form, "designation") || null, department: str(form, "department").slice(0, 80) || null, phone, email: null,
    source: st && st.validity_end && st.validity_end < todayISO() ? "alumni" : "student", submitted_by: st ? `${st.full_name} (${st.enrollment_no})` : s.name,
  });
  back("/portal/requests", "Thank you! The college contact was shared with our college relations team.");
}
