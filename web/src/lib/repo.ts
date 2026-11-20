import "server-only";
import { addDays, addMonths, daysBetween, todayISO } from "./format";
import type { Store } from "./store/types";
import type {
  AccessEvent,
  AccessRow,
  Allocation,
  AttendanceInput,
  AttendanceRecord,
  AttendanceSource,
  Batch,
  Channel,
  Course,
  DashboardStats,
  Drive,
  DriveResponse,
  DriveResponseValue,
  DriveStatus,
  Education,
  Installment,
  Letter,
  LetterTemplate,
  NewDriveInput,
  NewStudentInput,
  NotificationRow,
  Payment,
  Staff,
  Student,
  StudentListItem,
  StudentProfile,
  StudentStatus,
  Vendor,
} from "./types";

const WINDOW_DAYS = 30;
export const IRREGULAR_THRESHOLD = 75;
const emptySources = (): Record<AttendanceSource, number> => ({ zoom: 0, teamviewer: 0, biometric: 0, manual: 0 });

/** Attendance % over the last 30 days: distinct days present ÷ distinct class days held. */
function attendancePct(records: AttendanceRecord[]) {
  const since = addDays(todayISO(), -WINDOW_DAYS);
  const recent = records.filter((r) => r.session_date >= since);
  const classDays = new Set(recent.map((r) => r.session_date)).size || 1;
  const byStudent = new Map<string, Set<string>>();
  for (const r of recent) {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, new Set());
    byStudent.get(r.student_id)!.add(r.session_date);
  }
  return (studentId: string) => Math.round((1000 * (byStudent.get(studentId)?.size ?? 0)) / classDays) / 10;
}

export function createRepo(db: Store) {
  const recentAttendance = () =>
    db.select<AttendanceRecord>("attendance_records", { gte: { session_date: addDays(todayISO(), -WINDOW_DAYS) } });

  const repo = {
    mode: db.kind,

    courses: () => db.select<Course>("courses", { order: { column: "code" } }),
    batches: () => db.select<Batch>("batches", { order: { column: "name" } }),
    vendors: () => db.select<Vendor>("vendors", { order: { column: "name" } }),
    staff: () => db.select<Staff>("staff", { order: { column: "employee_code" } }),

    async students(filter: { q?: string; status?: StudentStatus | "all"; batch?: string } = {}): Promise<StudentListItem[]> {
      const [students, courses, batches, att, inst] = await Promise.all([
        db.select<Student>("students", { order: { column: "enrollment_no" } }),
        repo.courses(),
        repo.batches(),
        recentAttendance(),
        db.select<Installment>("installments"),
      ]);
      const pct = attendancePct(att);
      const today = todayISO();
      const q = filter.q?.trim().toLowerCase();
      return students
        .filter((s) => !filter.status || filter.status === "all" || s.status === filter.status)
        .filter((s) => !filter.batch || s.batch_id === filter.batch)
        .filter((s) => !q || [s.full_name, s.enrollment_no, s.email, s.phone].some((v) => v?.toLowerCase().includes(q)))
        .map((s) => {
          const paid = inst.filter((i) => i.student_id === s.id).reduce((a, i) => a + Number(i.paid_amount), 0);
          return {
            ...s,
            course_name: courses.find((c) => c.id === s.course_id)?.name,
            batch_name: batches.find((b) => b.id === s.batch_id)?.name,
            attendance_pct: pct(s.id),
            paid,
            balance: Number(s.total_fee) - paid,
            days_left: s.validity_end ? daysBetween(today, s.validity_end) : null,
          };
        });
    },

    async dashboard(): Promise<DashboardStats> {
      const [list, drives, responses, att] = await Promise.all([
        repo.students(),
        db.select<Drive>("placement_drives"),
        db.select<DriveResponse>("drive_responses", { eq: { response: "yes" } }),
        recentAttendance(),
      ]);
      const lastClassDay = att.reduce((m, r) => (r.session_date > m ? r.session_date : m), "");
      const by = emptySources();
      for (const r of att) by[r.source]++;
      const active = list.filter((s) => s.status === "active");
      return {
        total: list.length,
        active: active.length,
        on_hold: list.filter((s) => s.status === "on_hold").length,
        expired: list.filter((s) => s.status === "expired").length,
        expiring_month: list.filter((s) => s.days_left !== null && s.days_left >= 0 && s.days_left <= 30 && s.status !== "expired").length,
        pending_fees: list.reduce((a, s) => a + Math.max(0, s.balance), 0),
        collected: list.reduce((a, s) => a + s.paid, 0),
        open_drives: drives.filter((d) => d.status === "open").length,
        interested: responses.length,
        // present on the most recent class day (today, if classes ran today)
        today_present: new Set(att.filter((r) => r.session_date === lastClassDay).map((r) => r.student_id)).size,
        attendance_by_source: by,
        irregular: active.filter((s) => s.attendance_pct < IRREGULAR_THRESHOLD).length,
      };
    },

    async profile(id: string): Promise<StudentProfile | null> {
      const [student] = await db.select<Student>("students", { eq: { id } });
      if (!student) return null;
      const [courses, batches, vendors, education, access, events, allocations, installments, payments, responses, drives, letters, att, allAtt] =
        await Promise.all([
          repo.courses(),
          repo.batches(),
          repo.vendors(),
          db.select<Education>("student_education", { eq: { student_id: id } }),
          db.select<AccessRow>("student_access", { eq: { student_id: id } }),
          db.select<AccessEvent>("access_events", { eq: { student_id: id }, order: { column: "created_at", ascending: false } }),
          db.select<Allocation>("fee_allocations", { eq: { student_id: id } }),
          db.select<Installment>("installments", { eq: { student_id: id }, order: { column: "due_date" } }),
          db.select<Payment>("payments", { eq: { student_id: id }, order: { column: "paid_at", ascending: false } }),
          db.select<DriveResponse>("drive_responses", { eq: { student_id: id } }),
          db.select<Drive>("placement_drives"),
          db.select<Letter>("issued_letters", { eq: { student_id: id } }),
          db.select<AttendanceRecord>("attendance_records", { eq: { student_id: id }, order: { column: "session_date", ascending: false } }),
          recentAttendance(),
        ]);
      const bySource = emptySources();
      for (const r of att) bySource[r.source]++;
      const paid = installments.reduce((a, i) => a + Number(i.paid_amount), 0);
      return {
        student,
        course: courses.find((c) => c.id === student.course_id),
        batch: batches.find((b) => b.id === student.batch_id),
        education,
        access,
        events,
        allocations: allocations.map((a) => ({ ...a, vendor: vendors.find((v) => v.id === a.vendor_id)! })),
        installments: installments.map((i) => ({ ...i, sub_vendor: vendors.find((v) => v.id === i.sub_vendor_id) })),
        payments,
        responses: responses
          .map((r) => ({ ...r, drive: drives.find((d) => d.id === r.drive_id)! }))
          .filter((r) => r.drive),
        letters,
        attendance: { pct: attendancePct(allAtt)(id), bySource, recent: att.slice(0, 15) },
        fee: {
          total: Number(student.total_fee),
          paid,
          balance: Number(student.total_fee) - paid,
          next_due: installments.find((i) => i.status !== "paid")?.due_date ?? null,
        },
      };
    },

    async createStudent(input: NewStudentInput): Promise<Student> {
      const [course] = await db.select<Course>("courses", { eq: { id: input.course_id } });
      const existing = await db.select<Student>("students", { order: { column: "enrollment_no", ascending: false }, limit: 1 });
      const lastNo = Number(existing[0]?.enrollment_no?.replace(/\D/g, "") || "2026000");
      const [student] = await db.insert<Student>("students", [
        {
          enrollment_no: `MVL${lastNo + 1}`,
          status: "active",
          full_name: input.full_name,
          email: input.email || null,
          phone: input.phone || null,
          gender: input.gender || null,
          dob: input.dob || null,
          course_id: input.course_id,
          batch_id: input.batch_id || null,
          training_mode: input.training_mode,
          admission_date: input.admission_date,
          validity_end: course ? addMonths(input.admission_date, course.validity_months) : null,
          total_fee: input.total_fee,
          payment_plan: "Installments",
          lead_source: input.lead_source || null,
          referred_by: input.referred_by || null,
          address: { city: input.city, state: input.state },
          family: {},
          spouse: {},
          emergency: {},
          professional: {},
          placement_consent: true,
          placement_eligible: false,
        },
      ]);
      for (const a of input.allocations.filter((x) => x.amount > 0)) {
        const [alloc] = await db.insert<Allocation>("fee_allocations", [{ student_id: student.id, vendor_id: a.vendor_id, amount: a.amount }]);
        const n = Math.max(1, a.installments);
        const per = Math.round(a.amount / n);
        await db.insert<Installment>(
          "installments",
          Array.from({ length: n }, (_, k) => ({
            allocation_id: alloc.id,
            student_id: student.id,
            sub_vendor_id: a.sub_vendor_id || null,
            seq: k + 1,
            due_date: addDays(input.admission_date, 30 * k),
            amount: k === n - 1 ? a.amount - per * (n - 1) : per,
            paid_amount: 0,
            status: "pending" as const,
          })),
        );
      }
      if (input.email) await db.update<AccessRow>("student_access", { student_id: student.id, channel: "zoom" }, { external_ref: input.email });
      await db.update<AccessRow>("student_access", { student_id: student.id, channel: "biometric" }, { external_ref: student.enrollment_no });
      return student;
    },

    setStatus: (id: string, status: StudentStatus, reason?: string) =>
      db.rpc<void>("set_student_status", { p_student: id, p_status: status, p_reason: reason ?? null }),

    setChannel: (id: string, channel: Channel, enabled: boolean) =>
      db.update<AccessRow>("student_access", { student_id: id, channel }, { enabled }),

    async renew(id: string, months: number) {
      const [s] = await db.select<Student>("students", { eq: { id } });
      if (!s) return;
      const base = s.validity_end && s.validity_end > todayISO() ? s.validity_end : todayISO();
      await db.update<Student>("students", { id }, { validity_end: addMonths(base, months) });
      await repo.setStatus(id, "active", `Renewed for ${months} months`);
    },

    accessOverview: () => db.select<AccessRow>("student_access"),
    accessEvents: () => db.select<AccessEvent>("access_events", { order: { column: "created_at", ascending: false }, limit: 30 }),

    attendance: (from: string, to: string) =>
      db.select<AttendanceRecord>("attendance_records", {
        gte: { session_date: from },
        lte: { session_date: to },
        order: { column: "session_date", ascending: false },
      }),

    /** Resolve an external identity (zoom email, biometric code, teamviewer id, enrollment no) to a student. */
    async findByRef(channel: Channel, ref: string): Promise<Student | null> {
      const rows = await db.select<AccessRow>("student_access", { eq: { channel, external_ref: ref } });
      const id = rows[0]?.student_id;
      if (id) return (await db.select<Student>("students", { eq: { id } }))[0] ?? null;
      const byEnroll = await db.select<Student>("students", { eq: { enrollment_no: ref } });
      if (byEnroll[0]) return byEnroll[0];
      const byEmail = await db.select<Student>("students", { eq: { email: ref } });
      return byEmail[0] ?? null;
    },

    /** Central sync point for all three attendance channels. Blocked channels are rejected. */
    async recordAttendance(input: AttendanceInput) {
      if (input.source !== "manual") {
        const [acc] = await db.select<AccessRow>("student_access", { eq: { student_id: input.student_id, channel: input.source } });
        if (acc && !acc.enabled) return { ok: false as const, reason: `${input.source} access is blocked for this student` };
      }
      try {
        await db.insert<AttendanceRecord>("attendance_records", [input]);
        return { ok: true as const };
      } catch (e) {
        if (String(e).includes("duplicate")) {
          await db.update<AttendanceRecord>(
            "attendance_records",
            { student_id: input.student_id, source: input.source, session_date: input.session_date, external_ref: input.external_ref ?? "" },
            { check_out: input.check_out, duration_minutes: input.duration_minutes },
          );
          return { ok: true as const, updated: true };
        }
        throw e;
      }
    },

    async ledger() {
      const [vendors, allocations, installments, payments, students] = await Promise.all([
        repo.vendors(),
        db.select<Allocation>("fee_allocations"),
        db.select<Installment>("installments", { order: { column: "due_date" } }),
        db.select<Payment>("payments", { order: { column: "paid_at", ascending: false } }),
        db.select<Student>("students"),
      ]);
      return { vendors, allocations, installments, payments, students };
    },

    async recordPayment(installment_id: string, amount: number, mode: string, reference?: string) {
      const [inst] = await db.select<Installment>("installments", { eq: { id: installment_id } });
      if (!inst) throw new Error("Installment not found");
      await db.insert<Payment>("payments", [{ installment_id, student_id: inst.student_id, amount, mode, reference: reference || null }]);
    },

    drives: () => db.select<Drive>("placement_drives", { order: { column: "drive_date" } }),
    async createDrive(input: NewDriveInput) {
      const [d] = await db.insert<Drive>("placement_drives", [input]);
      return d;
    },
    setDriveStatus: (id: string, status: DriveStatus) => db.update<Drive>("placement_drives", { id }, { status }),
    responses: (driveId?: string) => db.select<DriveResponse>("drive_responses", driveId ? { eq: { drive_id: driveId } } : {}),
    respond: (drive_id: string, student_id: string, response: DriveResponseValue) =>
      db.upsert<DriveResponse>(
        "drive_responses",
        [{ drive_id, student_id, response, stage: response === "yes" ? "Applied" : null, synced_to_sheet: false, updated_at: new Date().toISOString() }],
        "drive_id,student_id",
      ),
    async markSynced(drive_id: string, studentIds: string[]) {
      const now = new Date().toISOString();
      for (const student_id of studentIds)
        await db.update<DriveResponse>("drive_responses", { drive_id, student_id }, { synced_to_sheet: true, synced_at: now });
    },
    setStage: (drive_id: string, student_id: string, stage: string) =>
      db.update<DriveResponse>("drive_responses", { drive_id, student_id }, { stage }),

    letters: () => db.select<Letter>("issued_letters", { order: { column: "issued_at", ascending: false } }),
    async letter(serial: string) {
      return (await db.select<Letter>("issued_letters", { eq: { serial_no: serial } }))[0] ?? null;
    },
    async issueLetter(template: LetterTemplate, target: { student_id?: string; staff_id?: string }, data: Record<string, string> = {}) {
      const year = new Date().getFullYear();
      const prefix = `MV-${LETTER_CODES[template]}-${year}-`;
      const all = await db.select<Letter>("issued_letters", { eq: { template } });
      const n = all.filter((l) => l.serial_no.startsWith(prefix)).length + 1;
      const [l] = await db.insert<Letter>("issued_letters", [
        { serial_no: prefix + String(n).padStart(4, "0"), template, student_id: target.student_id ?? null, staff_id: target.staff_id ?? null, data, revoked: false, issued_at: new Date().toISOString() },
      ]);
      return l;
    },

    notifications: () => db.select<NotificationRow>("notifications", { order: { column: "created_at", ascending: false }, limit: 50 }),
    processExpiry: () => db.rpc<{ student_id: string; kind: string }[]>("process_expiry", {}),
  };
  return repo;
}

export type Repo = ReturnType<typeof createRepo>;

export const LETTER_CODES: Record<LetterTemplate, string> = {
  training_certificate: "CRT",
  internship_offer: "INO",
  internship_completion: "INC",
  admission_confirmation: "ADM",
  placement_confirmation: "PLC",
  student_id_card: "IDC",
  visiting_card: "VC",
  staff_offer: "SOF",
  payslip: "PAY",
  service_agreement: "SAG",
  experience_letter: "EXP",
};
