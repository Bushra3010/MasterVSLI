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
