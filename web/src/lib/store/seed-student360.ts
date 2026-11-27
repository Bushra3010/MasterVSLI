import type { Drive, Installment, Student } from "../types";
import type { PaymentSubmission, ReminderAck, StudentInterview, StudentRequest, StudentResume } from "../types-student360";

export interface Student360Tables {
  student_resumes: StudentResume[];
  student_interviews: StudentInterview[];
  payment_submissions: PaymentSubmission[];
  student_requests: StudentRequest[];
  reminder_acks: ReminderAck[];
}

const at = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();
const shift = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function buildStudent360Seed(today: string, students: Student[], installments: Installment[], drives: Drive[]): Student360Tables {
  const s1 = students[0]?.id;
  const s2 = students[1]?.id;
  if (!s1) return { student_resumes: [], student_interviews: [], payment_submissions: [], student_requests: [], reminder_acks: [] };
  const open = installments.find((i) => i.student_id === s1 && i.status !== "paid");
  const open2 = s2 ? installments.find((i) => i.student_id === s2 && i.status !== "paid") : undefined;
  const qcom = drives.find((d) => d.id === "dr-qcom");
  return {
    student_resumes: [
      { id: "rs-1", student_id: s1, title: "DV Resume", domain: "Design Verification", version: "v3", document_id: null, is_default: true, created_at: shift(today, -20) + "T05:00:00Z" },
      { id: "rs-2", student_id: s1, title: "RTL Resume", domain: "RTL Design", version: "v1", document_id: null, is_default: false, created_at: shift(today, -40) + "T05:00:00Z" },
    ],
    student_interviews: [
      { id: "iv-1", student_id: s1, drive_id: qcom?.id ?? null, company: "Qualcomm", role: "Design Verification Engineer", round: "Technical round 1", scheduled_at: at(shift(today, 3), "10:30"), mode: "Online", location: "Teams link in call letter", call_letter_url: null, status: "scheduled" },
      { id: "iv-2", student_id: s1, company: "Wipro", role: "ASIC Verification Engineer", round: "HR round", scheduled_at: at(shift(today, 6), "15:00"), mode: "Offline", location: "Wipro, Sarjapur", status: "scheduled" },
      { id: "iv-3", student_id: s1, company: "Demo Semiconductor C", role: "Verification Engineer", round: "Technical round", scheduled_at: at(shift(today, -9), "11:00"), mode: "Online", status: "missed" },
      { id: "iv-4", student_id: s1, company: "TCS", role: "Physical Design Engineer", round: "Technical round", scheduled_at: at(shift(today, -14), "10:00"), mode: "Online", status: "attended", outcome: "Cleared — awaiting HR" },
    ],
    payment_submissions: [
      ...(open ? [{ id: "ps-1", student_id: s1, installment_id: open.id, amount: Math.min(5000, Number(open.amount) - Number(open.paid_amount)) || 5000, mode: "UPI", reference: "UPI-DEMO-7781", paid_on: shift(today, -1), note: "Paid via GPay", status: "pending" as const, created_at: shift(today, -1) + "T06:00:00Z" }] : []),
      ...(open2 && s2 ? [{ id: "ps-2", student_id: s2, installment_id: open2.id, amount: 3000, mode: "Bank Transfer", reference: "NEFT-DEMO-1203", paid_on: shift(today, -2), status: "pending" as const, created_at: shift(today, -2) + "T06:00:00Z" }] : []),
    ],
    student_requests: [
      { id: "rq-1", student_id: s1, kind: "certificate", subject: "Training certificate", details: "Need the certificate for a job application.", data: { type: "Training certificate" }, status: "open", created_at: shift(today, -3) + "T06:00:00Z" },
      { id: "rq-2", student_id: s1, kind: "support", subject: "Zoom link not working", details: "The batch Zoom link shows 'meeting ended'.", data: {}, status: "closed", response: "New link shared on WhatsApp.", decided_by: "Demo Admin", decided_at: shift(today, -6) + "T06:00:00Z", created_at: shift(today, -7) + "T06:00:00Z" },
      ...(s2 ? [{ id: "rq-3", student_id: s2, kind: "validity_extension" as const, subject: "Validity extension — 3 months", details: "Missed classes due to exams.", data: { months: 3 }, status: "open" as const, created_at: shift(today, -1) + "T06:00:00Z" }] : []),
    ],
    reminder_acks: [],
  };
}
