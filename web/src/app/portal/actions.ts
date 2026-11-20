"use server";

import { revalidatePath } from "next/cache";
import { syncDriveToSheet } from "@/lib/integrations/google-sheets";
import { getRepo, getServiceRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import type { DriveResponseValue } from "@/lib/types";

export async function respondAction(driveId: string, response: DriveResponseValue) {
  const s = await requireStudent();
  const repo = await getRepo();
  const profile = await repo.profile(s.studentId);
  const placement = profile?.access.find((a) => a.channel === "placement");
  if (!profile || profile.student.status !== "active" || !placement?.enabled) {
    throw new Error("Placement access is blocked for your account. Please contact the admin.");
  }
  const drive = (await repo.drives()).find((d) => d.id === driveId);
  if (!drive || drive.status !== "open") throw new Error("This drive is not accepting responses.");
  await repo.respond(driveId, s.studentId, response);
  // "Yes" → auto-export to the drive's Google Sheet (best effort; admins can re-sync from the dashboard).
  if (response === "yes") await syncDriveToSheet(getServiceRepo(), driveId).catch(() => null);
  revalidatePath("/portal", "layout");
}

export async function changePasswordAction(_: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  await requireStudent();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { ok: false, message: "Use at least 8 characters." };
  if (password !== confirm) return { ok: false, message: "The two passwords don't match." };
  const { isSupabaseConfigured, supabaseServer } = await import("@/lib/supabase/clients");
  if (!isSupabaseConfigured()) return { ok: false, message: "Demo mode has no passwords." };
  const { error } = await (await supabaseServer()).auth.updateUser({ password });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Password updated. Use it next time you sign in." };
}

/** Students may add their own resume, photo, certificates or ID proof; staff verify them. */
export async function portalUploadAction(_: unknown, form: FormData) {
  const s = await requireStudent();
  const { uploadStudentDocument } = await import("@/lib/documents");
  const { getStudentReadRepo } = await import("@/lib/server");
  // Writes go through the service role because students have read-only access to their document rows.
  const res = await uploadStudentDocument(await getStudentReadRepo(), s.studentId, form);
  if (res.ok) revalidatePath("/portal", "layout");
  return res;
}
