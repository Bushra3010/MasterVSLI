"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStore, requireStaff } from "@/lib/session";
import { createStudent360Repo } from "@/lib/student360";
import { istToUtc, type InterviewStatus, type RequestStatus } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (tab: string, msg: string, ok = true): never => redirect(`/student-desk?tab=${tab}&${ok ? "saved" : "error"}=${encodeURIComponent(msg)}`);
const repo = async () => createStudent360Repo(await getStore());

export async function decidePaymentAction(id: string, approve: boolean, form: FormData) {
  const s = await requireStaff();
  try {
    await (await repo()).decideSubmission(id, approve, s.name, str(form, "office_note").slice(0, 300));
  } catch (e) {
    done("payments", e instanceof Error ? e.message : "Could not update the payment", false);
  }
  revalidatePath("/", "layout");
  done("payments", approve ? "Payment approved — the receipt is now available to the student." : "Payment rejected.");
}

export async function decideRequestAction(id: string, form: FormData) {
  const s = await requireStaff();
  const status = str(form, "status") as RequestStatus;
  if (!["open", "in_progress", "approved", "rejected", "closed"].includes(status)) done("requests", "Choose a status.", false);
  await (await repo()).decideRequest(id, status, s.name, str(form, "response").slice(0, 1000));
  revalidatePath("/", "layout");
  done("requests", "Request updated.");
}

export async function saveInterviewAction(form: FormData) {
  const s = await requireStaff();
  const student_id = str(form, "student_id");
  const company = str(form, "company");
  const date = str(form, "date");
  if (!student_id || company.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) done("interviews", "Student, company and date are required.", false);
  const url = str(form, "call_letter_url");
  if (url && !/^https:\/\//.test(url)) done("interviews", "The call letter link must start with https://", false);
  await (await repo()).saveInterview({
    student_id,
    company,
    role: str(form, "role") || null,
    round: str(form, "round") || null,
    scheduled_at: istToUtc(date, str(form, "time") || "10:00"),
    mode: str(form, "mode") || null,
    location: str(form, "location") || null,
    call_letter_url: url || null,
    created_by: s.name,
  });
  revalidatePath("/", "layout");
  done("interviews", "Interview scheduled — the student sees it in their reminders.");
}

export async function setInterviewStatusAction(id: string, form: FormData) {
  await requireStaff();
  const status = str(form, "status") as InterviewStatus;
  if (!["scheduled", "attended", "missed", "cancelled"].includes(status)) done("interviews", "Choose a status.", false);
  await (await repo()).setInterviewStatus(id, status, str(form, "outcome") || null);
  revalidatePath("/", "layout");
  done("interviews", status === "missed" ? "Marked as missed — the student is asked for an explanation." : "Interview updated.");
}
