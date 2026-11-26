"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProfileRepo, parseProfileForm } from "@/lib/profile";
import { getRepo } from "@/lib/server";
import { getStore, requireStaff } from "@/lib/session";
import type { ApplicationStatus, MasterCategory, Student } from "@/lib/types";

export type ProfileResult = { ok: boolean; message: string } | null;
const CATEGORIES: MasterCategory[] = ["board", "university", "stream", "contact_position", "validity_months", "designation"];

/** Office edit of the full profile. */
export async function saveProfileAction(id: string, _: ProfileResult, form: FormData): Promise<ProfileResult> {
  await requireStaff();
  const repo = await getRepo();
  const [current] = await (await getStore()).select<Student>("students", { eq: { id } });
  if (!current) return { ok: false, message: "Student not found" };
  try {
    const { patch, education, refs, contacts } = parseProfileForm(form, "staff", current);
    await repo.updateStudent(id, patch);
    await repo.replaceEducation(id, education);
    if (refs) await repo.setExternalRefs(id, refs);
    const collegeId = (patch.category ?? current.category) === "college" ? (patch.college_id ?? current.college_id) : null;
    if (collegeId) await createProfileRepo(await getStore()).saveCollegeContacts(collegeId, contacts);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not save" };
  }
  revalidatePath("/", "layout");
  redirect(`/students/${id}?saved=1`);
}

export async function addMasterOptionAction(category: MasterCategory, value: string): Promise<{ ok: boolean; value?: string; message?: string }> {
  await requireStaff();
  if (!CATEGORIES.includes(category)) return { ok: false, message: "Unknown list" };
  try {
    const v = await createProfileRepo(await getStore()).addOption(category, value);
    revalidatePath("/", "layout");
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not add" };
  }
}

export async function removeMasterOptionAction(category: MasterCategory, value: string): Promise<{ ok: boolean }> {
  const me = await requireStaff();
  if (me.role !== "super_admin" && me.role !== "admin") return { ok: false };
  if (!CATEGORIES.includes(category)) return { ok: false };
  await createProfileRepo(await getStore()).removeOption(category, value);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveApplicationAction(studentId: string, form: FormData) {
  await requireStaff();
  const g = (k: string) => String(form.get(k) ?? "").trim();
  if (!g("company")) throw new Error("Company is required");
  await createProfileRepo(await getStore()).saveApplication({
    id: g("id") || undefined,
    student_id: studentId,
    company: g("company"),
    role: g("role") || null,
    applied_on: g("applied_on") || new Date().toISOString().slice(0, 10),
    rounds: Number(g("rounds") || 0),
    status: (g("status") || "applied") as ApplicationStatus,
    package: g("package") || null,
    doj: g("doj") || null,
    hr_name: g("hr_name") || null,
    hr_email: g("hr_email") || null,
    job_location: g("job_location") || null,
  });
  revalidatePath(`/students/${studentId}`);
}

export async function removeApplicationAction(studentId: string, id: string) {
  await requireStaff();
  await createProfileRepo(await getStore()).removeApplication(id);
  revalidatePath(`/students/${studentId}`);
}

export async function addNoteAction(studentId: string, form: FormData) {
  const me = await requireStaff();
  const note = String(form.get("note") ?? "").trim();
  if (note.length < 2) return;
  await createProfileRepo(await getStore()).addNote(studentId, note, me.name);
  revalidatePath(`/students/${studentId}`);
}

export async function verifyProfileAction(studentId: string) {
  const me = await requireStaff();
  await (await getRepo()).updateStudent(studentId, { profile_verified_by: me.name, profile_verified_at: new Date().toISOString() });
  revalidatePath(`/students/${studentId}`);
}

/** Inline "Master Data" edit on the profile: branch, course, batch, training mode and validity. */
export async function saveMasterDataAction(id: string, form: FormData) {
  await requireStaff();
  const [cur] = await (await getStore()).select<Student>("students", { eq: { id } });
  if (!cur) throw new Error("Student not found");
  const g = (k: string) => String(form.get(k) ?? "").trim();
  const mode = g("training_mode");
  const months = Number(g("validity_months")) || null;
  const extra = { ...(cur.extra ?? {}) };
  const patch: Partial<Student> = {
    branch_id: g("branch_id") || null,
    course_id: g("course_id") || cur.course_id,
    batch_id: g("batch_id") || null,
    training_mode: mode === "online" || mode === "offline" || mode === "hybrid" ? mode : cur.training_mode,
  };
  if (months && months !== extra.validity_months) {
    extra.validity_months = months;
    patch.extra = extra;
    // Valid until = joining date + validity + any complementary months.
    if (cur.admission_date) {
      const { addMonths } = await import("@/lib/format");
      patch.validity_end = addMonths(cur.admission_date, months + Number(extra.complementary_months ?? 0));
    }
  }
  await (await getRepo()).updateStudent(id, patch);
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}?saved=master#overview`);
}

/** Remove a college or company from the master — only when no student is linked to it. */
export async function removeOrgAction(kind: "college" | "client", id: string): Promise<{ ok: boolean; message: string }> {
  const me = await requireStaff();
  if (me.role !== "super_admin" && me.role !== "admin") return { ok: false, message: "Only admins can remove entries." };
  const db = await getStore();
  const linked = await db.select<Student>("students", { eq: { [kind === "college" ? "college_id" : "client_id"]: id } });
  if (linked.length) return { ok: false, message: `Can't remove: ${linked.length} student(s) are linked to it.` };
  await db.remove(kind === "college" ? "colleges" : "clients", { id });
  revalidatePath("/", "layout");
  return { ok: true, message: "Removed." };
}
