import "server-only";
import { cache } from "react";
import { getServiceStore } from "./session";
import { addDays, addMonths, daysBetween, todayISO } from "./format";
import { createRepo } from "./repo";
import type { Store } from "./store/types";
import type {
  ActionItem,
  AssignmentRow,
  Drive,
  DriveResponse,
  Education,
  Installment,
  PaymentSubmission,
  ReminderAck,
  Student,
  StudentApplication,
  StudentDocument,
  StudentInterview,
  StudentRequest,
  StudentResume,
  Submission,
} from "./types";
import { ATTENDANCE_GAP_DAYS, FEE_DUE_SOON_DAYS, PLACEMENT_GAP_DAYS, VALIDITY_SOON_DAYS } from "./types-student360";
import { EDU_ALIASES } from "./types-profile";

const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== "");
const week = (iso: string) => Math.floor(new Date(iso + "T00:00:00Z").getTime() / (7 * 86_400_000));

export const isMarriedFemale = (s: Pick<Student, "gender" | "marital_status">) => s.gender === "Female" && s.marital_status === "Married";
/** Alumni profile opens once training validity has ended. */
export const isAlumni = (s: Pick<Student, "validity_end">, today = todayISO()) => Boolean(s.validity_end && s.validity_end < today);

export interface CompletionCheck { section: string; label: string; ok: boolean; href: string }

/** Profile completion from the mandatory fields that apply to this student (category, gender and marital status). */
export function profileCompletion(s: Student, education: Education[], resumes: StudentResume[], docs: StudentDocument[]) {
  const x = s.extra ?? {};
  const levels = new Set(education.filter((e) => has(e.institution) || has(e.year_of_passing) || has(e.board)).map((e) => EDU_ALIASES[e.level] ?? e.level));
  const P = "/portal/profile";
  const checks: CompletionCheck[] = [
    { section: "Personal", label: "Full name", ok: has(s.full_name), href: `${P}#personal` },
    { section: "Personal", label: "Date of birth", ok: has(s.dob), href: `${P}#personal` },
    { section: "Personal", label: "Gender", ok: has(s.gender), href: `${P}#personal` },
    { section: "Personal", label: "Marital status", ok: has(s.marital_status), href: `${P}#personal` },
    { section: "Personal", label: "Blood group", ok: has(s.blood_group), href: `${P}#personal` },
    { section: "Personal", label: "Mobile number", ok: has(s.phone), href: `${P}#contact` },
    { section: "Personal", label: "Email", ok: has(s.email), href: `${P}#contact` },
    { section: "Personal", label: "Permanent address", ok: has(s.address?.line) && has(s.address?.city) && has(s.address?.state) && has(s.address?.pincode), href: `${P}#address` },
    { section: "Family", label: "Father's name", ok: has(s.family?.father_name), href: `${P}#family` },
    { section: "Family", label: "Mother's name", ok: has(s.family?.mother_name), href: `${P}#family` },
    { section: "Family", label: "Emergency contact", ok: has(s.emergency?.name) && has(s.emergency?.phone), href: `${P}#family` },
    ...(isMarriedFemale(s) ? [{ section: "Family", label: "Husband details", ok: has(s.spouse?.name), href: `${P}#family` }] : []),
    { section: "Education", label: "10th", ok: levels.has("10th"), href: `${P}#education` },
    { section: "Education", label: "PUC / Diploma", ok: levels.has("12th / Diploma"), href: `${P}#education` },
    { section: "Education", label: "Graduation (UG)", ok: levels.has("B.Tech / B.E"), href: `${P}#education` },
    { section: "Professional", label: "Working status", ok: has(s.professional?.working_status), href: `${P}#professional` },
    { section: "Professional", label: "Career objective", ok: has(x.career_objective), href: `${P}#professional` },
    ...(s.category === "college"
      ? [
          { section: "College", label: "College", ok: has(s.college_id), href: `${P}#college-info` },
          { section: "College", label: "University roll number", ok: has(x.college_info?.roll_no), href: `${P}#college-info` },
        ]
      : []),
    ...(s.category === "corporate"
      ? [
          { section: "Corporate", label: "Employee ID", ok: has(x.corporate?.employee_id), href: `${P}#corporate` },
          { section: "Corporate", label: "Reporting manager", ok: has(x.corporate?.manager_name), href: `${P}#corporate` },
        ]
      : []),
    { section: "Resume", label: "At least one resume", ok: resumes.length > 0 || docs.some((d) => d.kind === "resume"), href: "/portal/resumes" },
    { section: "Photo", label: "Profile photo", ok: docs.some((d) => d.kind === "photo"), href: "/portal/documents" },
  ];
  const done = checks.filter((c) => c.ok).length;
  return { pct: Math.round((done / checks.length) * 100), done, total: checks.length, checks, missing: checks.filter((c) => !c.ok) };
}

export interface ActionInput {
  student: Student;
  today?: string;
  nowMs: number;
  lastAttendance: string | null;
  placementOn: boolean;
  drives: Drive[];
  responses: DriveResponse[];
  applications: StudentApplication[];
  interviews: StudentInterview[];
  completion: { pct: number; missing: CompletionCheck[] };
  installments: Installment[];
  submissions: PaymentSubmission[];
  assignments: AssignmentRow[];
  learningSubs: Submission[];
  requests: StudentRequest[];
  acks: ReminderAck[];
}

/** The student's open reminders. They stay until resolved; informational ones can be acknowledged. */
export function actionItems(i: ActionInput): ActionItem[] {
  const today = i.today ?? todayISO();
  const s = i.student;
  const active = s.status === "active";
  const expired = isAlumni(s, today);
  const acked = new Set(i.acks.map((a) => a.key));
  const out: ActionItem[] = [];
  const wk = week(today);

  for (const iv of i.interviews.filter((x) => x.status === "missed" && !x.explanation))
    out.push({ key: `missed-${iv.id}`, kind: "missed_interview", title: `Missed interview — ${iv.company}`, detail: `${iv.scheduled_at.slice(0, 10)} · Submit explanation.`, href: `/portal/interviews#iv-${iv.id}`, tone: "red", ackable: false });

  if (active && !expired) {
    const gap = i.lastAttendance ? daysBetween(i.lastAttendance, today) : null;
    if (gap === null || gap > ATTENDANCE_GAP_DAYS)
      out.push({ key: `attendance-${wk}`, kind: "attendance_irregular", title: "Attendance irregular", detail: gap === null ? "No attendance recorded yet." : `${gap} days since last recorded attendance.`, href: "/portal/attendance", tone: "red", ackable: true });
  }

  const openDrives = i.drives.filter((d) => d.status === "open" && (!d.drive_date || d.drive_date >= today));
  if (i.placementOn && active) {
    const last = [
      ...i.responses.filter((r) => r.response !== "pending").map((r) => r.updated_at?.slice(0, 10)),
      ...i.applications.map((a) => (a.updated_at ?? a.created_at ?? a.applied_on)?.slice(0, 10)),
    ].filter(Boolean).sort().pop() as string | undefined;
    const gap = last ? daysBetween(last, today) : null;
    if (openDrives.length && (gap === null || gap > PLACEMENT_GAP_DAYS))
      out.push({ key: `placement-${wk}`, kind: "placement_inactive", title: "Placement inactivity", detail: gap === null ? "No placement participation yet." : `${gap} days since last placement participation.`, href: "/portal/drives", tone: "red", ackable: true });
    const answered = new Set(i.responses.filter((r) => r.response !== "pending").map((r) => r.drive_id));
    for (const d of openDrives.filter((d) => !answered.has(d.id)))
      out.push({ key: `respond-${d.id}`, kind: "placement_response", title: "Placement response pending", detail: `${d.company}${d.drive_date ? ` · ${d.drive_date}` : ""} · Submit Yes or No and choose a resume.`, href: `/portal/drives#drive-${d.id}`, tone: "red", ackable: false });
  }

  for (const iv of i.interviews.filter((x) => x.status === "scheduled" && new Date(x.scheduled_at).getTime() >= i.nowMs - 3600_000).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
    out.push({ key: `interview-${iv.id}`, kind: "upcoming_interview", title: `Upcoming interview — ${iv.company}`, detail: `${iv.scheduled_at.slice(0, 10)}${iv.round ? ` · ${iv.round}` : ""}${iv.mode ? ` · ${iv.mode}` : ""}`, href: `/portal/interviews#iv-${iv.id}`, tone: "blue", ackable: true });

  if (i.completion.pct < 100)
    out.push({ key: "profile", kind: "profile_incomplete", title: `Profile incomplete — ${i.completion.pct}%`, detail: `Missing: ${i.completion.missing.slice(0, 3).map((m) => m.label).join(", ")}${i.completion.missing.length > 3 ? ` +${i.completion.missing.length - 3} more` : ""}.`, href: i.completion.missing[0]?.href ?? "/portal/profile", tone: "amber", ackable: false });

  const pendingFor = new Set(i.submissions.filter((x) => x.status === "pending").map((x) => x.installment_id));
  for (const inst of i.installments.filter((x) => x.status !== "paid" && x.due_date <= addDays(today, FEE_DUE_SOON_DAYS) && !pendingFor.has(x.id))) {
    const due = Number(inst.amount) - Number(inst.paid_amount);
    if (due <= 0) continue;
    const overdue = inst.due_date < today;
    out.push({ key: `fee-${inst.id}`, kind: "fee_installment", title: overdue ? "Fee installment overdue" : "Fee installment due", detail: `Installment ${inst.seq} · ₹${due.toLocaleString("en-IN")} · due ${inst.due_date}`, href: "/portal/fees", tone: overdue ? "red" : "amber", ackable: false });
  }

  if (active && !expired) {
    const done = new Set(i.learningSubs.filter((x) => x.status !== "resubmit").map((x) => x.assignment_id));
    const pending = i.assignments.filter((a) => !done.has(a.id) && (!a.due_date || a.due_date <= addDays(today, 7)));
    if (pending.length)
      out.push({ key: "learning", kind: "learning_pending", title: "Learning activity pending", detail: `${pending.length} assignment${pending.length > 1 ? "s" : ""} to submit: ${pending.slice(0, 2).map((a) => a.title).join(", ")}.`, href: "/portal/learning", tone: "amber", ackable: false });
  }

  if (s.validity_end && !expired) {
    const left = daysBetween(today, s.validity_end);
    const asked = i.requests.some((r) => r.kind === "validity_extension" && (r.status === "open" || r.status === "in_progress"));
    if (left <= VALIDITY_SOON_DAYS && !asked)
      out.push({ key: `validity-${s.validity_end}`, kind: "training_validity", title: "Training validity ending", detail: `Expires in ${left} day${left === 1 ? "" : "s"} (${s.validity_end}). Request an extension if needed.`, href: "/portal/requests?kind=validity_extension", tone: "amber", ackable: true });
  }

  if (expired && !s.extra?.alumni?.updated_at)
    out.push({ key: "alumni", kind: "alumni_update", title: "Alumni update", detail: "Your training validity has ended. Complete your Alumni Profile.", href: "/portal/alumni", tone: "blue", ackable: false });

  return out.filter((a) => !(a.ackable && acked.has(a.key)));
}

export function createStudent360Repo(db: Store) {
  const repo = {
    interviews: (studentId?: string) => db.select<StudentInterview>("student_interviews", { ...(studentId ? { eq: { student_id: studentId } } : {}), order: { column: "scheduled_at" } }),
    async saveInterview(row: Partial<StudentInterview>) {
      if (row.id) await db.update<StudentInterview>("student_interviews", { id: row.id }, row);
      else await db.insert<StudentInterview>("student_interviews", [{ status: "scheduled", ...row }]);
    },
    setInterviewStatus: (id: string, status: StudentInterview["status"], outcome?: string | null) =>
      db.update<StudentInterview>("student_interviews", { id }, { status, ...(outcome !== undefined ? { outcome } : {}) }),
    explain: (id: string, studentId: string, explanation: string) =>
      db.update<StudentInterview>("student_interviews", { id, student_id: studentId }, { explanation, explained_at: new Date().toISOString() }),

    resumes: (studentId: string) => db.select<StudentResume>("student_resumes", { eq: { student_id: studentId }, order: { column: "created_at", ascending: false } }),
    async addResume(row: Omit<StudentResume, "id" | "created_at" | "is_default">) {
      const first = (await repo.resumes(row.student_id)).length === 0;
      await db.insert<StudentResume>("student_resumes", [{ ...row, is_default: first }]);
    },
    async setDefaultResume(studentId: string, id: string) {
      for (const r of await repo.resumes(studentId)) if (r.is_default !== (r.id === id)) await db.update<StudentResume>("student_resumes", { id: r.id }, { is_default: r.id === id });
    },
    removeResume: (studentId: string, id: string) => db.remove("student_resumes", { id, student_id: studentId }),

    submissions: (studentId?: string) => db.select<PaymentSubmission>("payment_submissions", { ...(studentId ? { eq: { student_id: studentId } } : {}), order: { column: "created_at", ascending: false } }),
    submitPayment: (row: Omit<PaymentSubmission, "id" | "status" | "created_at">) => db.insert<PaymentSubmission>("payment_submissions", [{ ...row, status: "pending" }]),
    /** Office approval records the payment against the installment, which makes the receipt available. */
    async decideSubmission(id: string, approve: boolean, by: string, note?: string) {
      const [sub] = await db.select<PaymentSubmission>("payment_submissions", { eq: { id } });
      if (!sub || sub.status !== "pending") return;
      let payment_id: string | null = null;
      if (approve) {
        if (!sub.installment_id) throw new Error("Pick the installment this payment is for");
        const p = await createRepo(db).recordPayment(sub.installment_id, Number(sub.amount), sub.mode, sub.reference ?? undefined);
        payment_id = p?.id ?? null;
      }
      await db.update<PaymentSubmission>("payment_submissions", { id }, { status: approve ? "approved" : "rejected", decided_by: by, decided_at: new Date().toISOString(), office_note: note || null, payment_id });
    },

    requests: (studentId?: string) => db.select<StudentRequest>("student_requests", { ...(studentId ? { eq: { student_id: studentId } } : {}), order: { column: "created_at", ascending: false } }),
    addRequest: (row: Omit<StudentRequest, "id" | "status" | "created_at">) => db.insert<StudentRequest>("student_requests", [{ ...row, status: "open" }]),
    /** Approving a validity extension extends validity and restores access; alumni details are kept. */
    async decideRequest(id: string, status: StudentRequest["status"], by: string, response?: string) {
      const [r] = await db.select<StudentRequest>("student_requests", { eq: { id } });
      if (!r) return;
      if (status === "approved" && r.kind === "validity_extension" && r.status !== "approved") {
        const months = Math.max(1, Number(r.data?.months ?? 3) || 3);
        const [s] = await db.select<Student>("students", { eq: { id: r.student_id } });
        if (s) {
          const base = s.validity_end && s.validity_end > todayISO() ? s.validity_end : todayISO();
          await db.update<Student>("students", { id: s.id }, { validity_end: addMonths(base, months) });
          if (s.status !== "active") await createRepo(db).setStatus(s.id, "active", `Validity extended ${months} months (request approved)`);
        }
      }
      await db.update<StudentRequest>("student_requests", { id }, { status, response: response || null, decided_by: by, decided_at: new Date().toISOString() });
    },

    acks: (studentId: string) => db.select<ReminderAck>("reminder_acks", { eq: { student_id: studentId } }),
    ack: (studentId: string, key: string) => db.upsert<ReminderAck>("reminder_acks", [{ student_id: studentId, key, acked_at: new Date().toISOString() }], "student_id,key"),
  };
  return repo;
}
export type Student360Repo = ReturnType<typeof createStudent360Repo>;

/** Everything the student's 360° pages need, read with service rights for one student only. */
export async function loadStudent360(db: Store, studentId: string, nowMs: number) {
  const base = createRepo(db);
  const r360 = createStudent360Repo(db);
  const p = await base.profile(studentId);
  if (!p) return null;
  const s = p.student;
  const [interviews, resumes, submissions, requests, acks, drives, applications, assignments, learningSubs, consent] = await Promise.all([
    r360.interviews(studentId),
    r360.resumes(studentId),
    r360.submissions(studentId),
    r360.requests(studentId),
    r360.acks(studentId),
    base.drives(),
    db.select<StudentApplication>("student_applications", { eq: { student_id: studentId }, order: { column: "applied_on", ascending: false } }),
    s.course_id ? db.select<AssignmentRow>("assignments", { eq: { course_id: s.course_id }, order: { column: "due_date" } }) : Promise.resolve([] as AssignmentRow[]),
    db.select<Submission>("assignment_submissions", { eq: { student_id: studentId } }),
    base.consentFor(studentId, "placement"),
  ]);
  const placementOn = !consent.required && Boolean(p.access.find((a) => a.channel === "placement")?.enabled);
  const completion = profileCompletion(s, p.education, resumes, p.documents);
  const lastAttendance = p.attendance.recent[0]?.session_date ?? null;
  const actions = actionItems({
    student: s, nowMs, lastAttendance, placementOn, drives, responses: p.responses, applications, interviews, completion,
    installments: p.installments, submissions, assignments, learningSubs, requests, acks,
  });
  return { p, interviews, resumes, submissions, requests, drives, applications, assignments, learningSubs, placementOn, completion, lastAttendance, actions };
}
export type Student360 = NonNullable<Awaited<ReturnType<typeof loadStudent360>>>;

/** Per-request cached 360° data for the signed-in student (layout and page share one read). */
export const getStudent360 = cache(async (studentId: string) => loadStudent360(getServiceStore(), studentId, Date.now()));
