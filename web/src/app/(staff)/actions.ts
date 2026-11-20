"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/session";
import { getRepo } from "@/lib/server";
import { syncDriveToSheet } from "@/lib/integrations/google-sheets";
import type { Channel, DriveStatus, LetterTemplate, StudentStatus } from "@/lib/types";

const money = z.coerce.number().min(0);

export async function createStudentAction(form: FormData) {
  await requireStaff();
  const allocations = [0, 1, 2]
    .map((i) => ({
      vendor_id: String(form.get(`alloc_vendor_${i}`) || ""),
      sub_vendor_id: String(form.get(`alloc_sub_${i}`) || "") || undefined,
      amount: Number(form.get(`alloc_amount_${i}`) || 0),
      installments: Number(form.get(`alloc_n_${i}`) || 1),
    }))
    .filter((a) => a.vendor_id && a.amount > 0);

  const input = z
    .object({
      full_name: z.string().min(2),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      gender: z.string().optional(),
      dob: z.string().optional(),
      course_id: z.string().min(1),
      batch_id: z.string().optional(),
      training_mode: z.enum(["online", "offline", "hybrid"]),
      admission_date: z.string().min(10),
      total_fee: money,
      lead_source: z.string().optional(),
      referred_by: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .parse(Object.fromEntries(form));

  const repo = await getRepo();
  const s = await repo.createStudent({ ...input, allocations });
  revalidatePath("/students");
  redirect(`/students/${s.id}`);
}

export async function setStatusAction(id: string, status: StudentStatus, reason?: string) {
  await requireStaff();
  await (await getRepo()).setStatus(id, status, reason);
  revalidatePath("/", "layout");
}

export async function toggleChannelAction(id: string, channel: Channel, enabled: boolean) {
  await requireStaff();
  await (await getRepo()).setChannel(id, channel, enabled);
  revalidatePath("/", "layout");
}

export async function renewAction(id: string, months: number) {
  await requireStaff();
  await (await getRepo()).renew(id, months);
  revalidatePath("/", "layout");
}

export async function recordPaymentAction(form: FormData) {
  await requireStaff();
  const { installment_id, amount, mode, reference } = z
    .object({ installment_id: z.string(), amount: z.coerce.number().positive(), mode: z.string(), reference: z.string().optional() })
    .parse(Object.fromEntries(form));
  await (await getRepo()).recordPayment(installment_id, amount, mode, reference);
  revalidatePath("/", "layout");
}

export async function createDriveAction(form: FormData) {
  await requireStaff();
  const input = z
    .object({
      company: z.string().min(2),
      job_role: z.string().min(2),
      location: z.string().optional(),
      drive_date: z.string().optional(),
      interview_mode: z.string().optional(),
      ctc: z.string().optional(),
      eligibility: z.string().optional(),
      status: z.enum(["upcoming", "open", "closed"]),
    })
    .parse(Object.fromEntries(form));
  const d = await (await getRepo()).createDrive({ ...input, drive_date: input.drive_date || undefined });
  revalidatePath("/placements");
  redirect(`/placements?drive=${d.id}`);
}

export async function setDriveStatusAction(id: string, status: DriveStatus) {
  await requireStaff();
  await (await getRepo()).setDriveStatus(id, status);
  revalidatePath("/placements");
}

export async function setStageAction(driveId: string, studentId: string, stage: string) {
  await requireStaff();
  await (await getRepo()).setStage(driveId, studentId, stage);
  revalidatePath("/placements");
}

export async function syncDriveAction(driveId: string) {
  await requireStaff();
  const result = await syncDriveToSheet(await getRepo(), driveId);
  revalidatePath("/placements");
  return result;
}

export async function issueLetterAction(form: FormData) {
  await requireStaff();
  const template = String(form.get("template")) as LetterTemplate;
  const subject = String(form.get("subject") || "");
  const data: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("d_") && String(v)) data[k.slice(2)] = String(v);
  const target = subject.startsWith("staff:") ? { staff_id: subject.slice(6) } : { student_id: subject.replace(/^student:/, "") };
  const l = await (await getRepo()).issueLetter(template, target, data);
  revalidatePath("/documents");
  redirect(`/documents/${l.serial_no}`);
}

export async function runExpiryAction() {
  await requireStaff();
  const out = await (await getRepo()).processExpiry();
  revalidatePath("/", "layout");
  return out;
}
