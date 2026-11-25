import "server-only";
import { addDays, daysBetween, todayISO } from "./format";
import type { Query, Store, TableName } from "./store/types";
import type {
  AlertContact,
  AlertRow,
  DriveResponse,
  Drive,
  Milestone,
  Project,
  AttendanceRecord,
  Consent,
  FeeAccount,
  Installment,
  Invoice,
  Lead,
  LeadActivity,
  LeadStage,
  Mou,
  Staff,
  Student,
  TermsDoc,
} from "./types";

/** Tables the generic save/remove actions may touch, and the columns each accepts. */
export const EDITABLE: Partial<Record<TableName, string[]>> = {
  branches: ["name", "city", "domain", "company"],
  colleges: ["code", "name", "city", "state", "affiliation", "college_type", "since", "status"],
  tpo_contacts: ["college_id", "name", "designation", "phone", "alt_phone", "email", "is_primary", "active", "remarks", "next_follow_up", "last_interaction"],
  mous: ["college_id", "mou_no", "agreement_type", "start_date", "end_date", "scope", "status", "document_url"],
  campus_drives: ["college_id", "company", "job_role", "drive_date", "mode", "eligibility", "package", "registered", "attended", "shortlisted", "selected", "status"],
  clients: ["name", "contact_person", "email", "phone", "gstin", "kind", "city", "state"],
  projects: ["client_id", "name", "status", "start_date", "end_date", "hourly_rate"],
  timesheets: ["project_id", "staff_id", "work_date", "hours", "note"],
  hr_contacts: ["full_name", "designation", "department", "phone", "email", "linkedin", "city", "current_company", "company_type", "joined_on", "reference_note"],
  hr_company_history: ["hr_id", "company", "designation", "from_date", "to_date"],
  hr_calls: ["hr_id", "call_date", "activity", "outcome", "remarks"],
  course_modules: ["course_id", "seq", "name", "total_videos"],
  assessments: ["student_id", "module_id", "title", "marks", "max_marks", "taken_on"],
  assignments: ["course_id", "batch_id", "module_id", "title", "instructions", "due_date", "max_marks"],
  tpo_interactions: ["tpo_id", "on_date", "mode", "summary", "next_follow_up", "by_name"],
  alert_contacts: ["role_name", "name", "email", "phone"],
  project_milestones: ["project_id", "title", "due_date", "done", "done_on"],
  staff_appraisals: ["staff_id", "period", "rating", "increment_pct", "comments"],
};
const NUMERIC = new Set(["registered", "attended", "shortlisted", "selected", "hourly_rate", "hours", "seq", "total_videos", "marks", "max_marks", "rating", "increment_pct"]);
const BOOL = new Set(["is_primary", "active", "done"]);

/** SLA (hours) and escalation chain per alert kind. */
export const ALERT_RULES: Record<string, { label: string; owner: string; sla: number; chain: [string, string, string] }> = {
  fee_overdue: { label: "Fee overdue", owner: "Finance", sla: 48, chain: ["Finance", "Admin / Manager", "Director"] },
  attendance: { label: "Attendance irregularity", owner: "Academic", sla: 72, chain: ["Academic", "HOD", "Director"] },
  training_expiry: { label: "Training expiry", owner: "Training", sla: 48, chain: ["Training", "Admin / Manager", "Director"] },
  mou_renewal: { label: "MoU renewal", owner: "Corporate relations", sla: 72, chain: ["Corporate relations", "Admin / Manager", "Director"] },
  corporate_payment: { label: "Pending corporate payment", owner: "Finance", sla: 72, chain: ["Finance", "Admin / Manager", "Director"] },
  project_delay: { label: "Project milestone delay", owner: "Projects", sla: 48, chain: ["Projects", "Delivery manager", "Director"] },
  lead_follow_up: { label: "Lead follow-up missed", owner: "Admissions", sla: 24, chain: ["Admissions", "Admin / Manager", "Director"] },
  placement_no_show: { label: "Placement no-show", owner: "Placement", sla: 48, chain: ["Placement", "Admin / Manager", "Director"] },
};

export function createCrmRepo(db: Store) {
  const crm = {
    list: <T,>(table: TableName, q?: Query) => db.select<T>(table, q),
    async one<T>(table: TableName, id: string) {
      return (await db.select<T>(table, { eq: { id } }))[0] ?? null;
    },
    /** Insert or update a row from form-like values, keeping only the allowed columns. */
    async save(table: TableName, values: Record<string, unknown>) {
      const cols = EDITABLE[table];
      if (!cols) throw new Error(`${table} is not editable`);
      const row: Record<string, unknown> = {};
      for (const c of cols) {
        if (!(c in values)) {
          if (BOOL.has(c)) row[c] = false;
          continue;
        }
        const v = values[c];
        if (BOOL.has(c)) row[c] = v === true || v === "on" || v === "true";
        else if (v === "" || v === undefined) row[c] = null;
        else row[c] = NUMERIC.has(c) ? Number(v) : v;
      }
      const id = values.id ? String(values.id) : "";
      if (id) await db.update(table, { id }, row);
      else return (await db.insert<{ id: string }>(table, [row]))[0];
    },
    remove: (table: TableName, id: string) => db.remove(table, { id }),

    // ---- leads ------------------------------------------------------------------
    async createLead(l: Partial<Lead>) {
      const all = await db.select<Lead>("leads", { order: { column: "created_at", ascending: false }, limit: 500 });
      const max = Math.max(8449, ...all.map((x) => Number(x.lead_no?.replace(/\D/g, "") || 0)));
      const now = new Date().toISOString();
      const [row] = await db.insert<Lead>("leads", [{ stage: "lead", source: "manual", ...l, lead_no: `MVL-LEAD-${max + 1}`, stage_dates: { lead: now }, created_at: now }]);
      return row;
    },
    async moveLead(id: string, stage: LeadStage, by?: string) {
      const lead = await crm.one<Lead>("leads", id);
      if (!lead) return;
      const now = new Date().toISOString();
      await db.update<Lead>("leads", { id }, { stage, stage_dates: { ...lead.stage_dates, [stage]: now } });
      await crm.addLeadActivity(id, "stage", `Moved to ${stage}`, stage, by);
      // Lead-to-admission commission for the HR the lead is assigned to (300 / 300 / 400 by default).
      const { createIncentiveRepo } = await import("./incentives");
      await createIncentiveRepo(db).creditLeadStage(lead, stage, { by }).catch(() => null);
    },
    addLeadActivity: (lead_id: string, kind: string, summary: string, outcome?: string | null, by_name?: string | null) =>
      db.insert<LeadActivity>("lead_activities", [{ lead_id, kind, summary, outcome: outcome ?? null, by_name: by_name ?? null, created_at: new Date().toISOString() }]),

    // ---- terms & consent ---------------------------------------------------------
    async activeTerms(kind: "general" | "placement") {
      const rows = await db.select<TermsDoc>("terms", { eq: { kind, active: true }, order: { column: "version", ascending: false }, limit: 1 });
      return rows[0] ?? null;
    },
    async saveTerms(kind: "general" | "placement", title: string, items: { title: string; body: string }[]) {
      const prev = await db.select<TermsDoc>("terms", { eq: { kind }, order: { column: "version", ascending: false } });
      for (const p of prev.filter((x) => x.active)) await db.update<TermsDoc>("terms", { id: p.id }, { active: false });
      await db.insert<TermsDoc>("terms", [{ kind, version: (prev[0]?.version ?? 0) + 1, title, items, active: true, created_at: new Date().toISOString() }]);
    },
    async consentFor(student_id: string, kind: "general" | "placement"): Promise<{ terms: TermsDoc | null; consent: Consent | null; required: boolean }> {
      const t = await crm.activeTerms(kind);
      if (!t) return { terms: null, consent: null, required: false };
      const [c] = await db.select<Consent>("consents", { eq: { student_id, kind, version: t.version } });
      return { terms: t, consent: c ?? null, required: !c };
    },
    async acceptTerms(student_id: string, kind: "general" | "placement", user_agent: string | null) {
      const { terms, consent } = await crm.consentFor(student_id, kind);
      if (!terms || consent) return consent;
      const year = new Date().getFullYear();
      const n = (await db.select<Consent>("consents", { eq: { kind } })).length + 1;
      const [row] = await db.insert<Consent>("consents", [{
        consent_no: `MVL-${kind === "placement" ? "PC" : "TC"}-${year}-${String(n).padStart(5, "0")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
        student_id, kind, version: terms.version, accepted_at: new Date().toISOString(), user_agent: user_agent?.slice(0, 200) ?? null,
      }]);
      return row;
    },

    // ---- Enrich Silicon ------------------------------------------------------------
    async nextInvoiceNo(company: "mastervlsi" | "enrich") {
      const year = new Date().getFullYear();
      const prefix = `${company === "enrich" ? "ES" : "MV"}-INV-${year}-`;
      const n = (await db.select<Invoice>("invoices", { eq: { company } })).filter((i) => i.invoice_no.startsWith(prefix)).length + 1;
      return prefix + String(n).padStart(4, "0");
    },
    async hireStudent(student: Student, designation: string, salary: number) {
      const staff = await db.select<Staff>("staff", { eq: { company: "enrich" } });
      const n = Math.max(0, ...staff.map((s) => Number(s.employee_code.replace(/\D/g, "") || 0))) + 1;
      await db.insert<Staff>("staff", [{
        employee_code: `ES${String(n).padStart(3, "0")}`, full_name: student.full_name, designation, department: "Engineering",
        joining_date: todayISO(), monthly_salary: salary, email: student.email ?? null, phone: student.phone ?? null, company: "enrich",
        source_student_id: student.id,
      }]);
    },

    // ---- alerts & escalation ---------------------------------------------------------
    /** Creates alerts for new events and escalates open alerts past their SLA. */
    async runAlerts() {
      const today = todayISO();
      const now = Date.now();
      const [responses, drives, milestones, projects] = await Promise.all([
        db.select<DriveResponse>("drive_responses"),
        db.select<Drive>("placement_drives"),
        db.select<Milestone>("project_milestones"),
        db.select<Project>("projects"),
      ]);
      const [students, installments, mous, invoices, att, leads, existing] = await Promise.all([
        db.select<Student>("students"),
        db.select<Installment>("installments"),
        db.select<Mou>("mous"),
        db.select<Invoice>("invoices"),
        db.select<AttendanceRecord>("attendance_records", { gte: { session_date: addDays(today, -30) } }),
        db.select<Lead>("leads"),
        db.select<AlertRow>("alerts", { eq: { status: "open" } }),
      ]);
      const open = new Set(existing.map((a) => `${a.kind}:${a.ref_id}`));
      const fresh: Partial<AlertRow>[] = [];
      const add = (kind: string, ref_id: string, title: string, details: string) => {
        if (open.has(`${kind}:${ref_id}`)) return;
        open.add(`${kind}:${ref_id}`);
        const rule = ALERT_RULES[kind];
        fresh.push({ kind, ref_id, title, details, owner_role: rule.owner, level: 1, status: "open", due_at: new Date(now + rule.sla * 3600_000).toISOString(), created_at: new Date().toISOString() });
      };
      const name = new Map(students.map((s) => [s.id, s]));
      // fee overdue (one alert per student, oldest due date)
      const overdue = new Map<string, Installment>();
      for (const i of installments.filter((x) => x.status !== "paid" && x.due_date < today))
        if (!overdue.has(i.student_id) || overdue.get(i.student_id)!.due_date > i.due_date) overdue.set(i.student_id, i);
      for (const [sid, i] of overdue) {
        const s = name.get(sid);
        if (s && s.status !== "dropped") add("fee_overdue", sid, `Fee overdue – ${s.full_name} (${s.enrollment_no})`, `Installment ${i.seq} overdue by ${daysBetween(i.due_date, today)} days.`);
      }
      // attendance irregularity: active students with < 75% of class days in 30 days
      const classDays = new Set(att.map((r) => r.session_date)).size || 1;
      const days = new Map<string, Set<string>>();
      for (const r of att) (days.get(r.student_id) ?? days.set(r.student_id, new Set()).get(r.student_id)!).add(r.session_date);
      for (const s of students.filter((x) => x.status === "active")) {
        const pct = Math.round((100 * (days.get(s.id)?.size ?? 0)) / classDays);
        if (pct < 75) add("attendance", s.id, `Attendance irregular – ${s.full_name}`, `${pct}% attendance in the last 30 days.`);
      }
      // training expiry within 7 days
      for (const s of students.filter((x) => x.validity_end && ["active", "on_hold"].includes(x.status))) {
        const left = daysBetween(today, s.validity_end!);
        if (left >= 0 && left <= 7) add("training_expiry", s.id, `Training expiry – ${s.full_name}`, `Access ends in ${left} day(s).`);
      }
      // MoU renewal within 90 days
      for (const m of mous.filter((x) => x.status === "active" && x.end_date)) {
        const left = daysBetween(today, m.end_date!);
        if (left <= 90) add("mou_renewal", m.id, `MoU renewal – ${m.mou_no ?? m.agreement_type}`, `MoU ends in ${left} days.`);
      }
      // pending corporate payment > 30 days
      for (const inv of invoices.filter((x) => x.status === "unpaid" && daysBetween(x.issue_date, today) > 30))
        add("corporate_payment", inv.id, `Pending corporate payment – ${inv.invoice_no}`, `Unpaid for ${daysBetween(inv.issue_date, today)} days.`);
      // missed lead follow-ups
      for (const l of leads.filter((x) => x.next_follow_up && !["enrolled", "lost"].includes(x.stage) && Date.parse(x.next_follow_up!) < now - 86400_000))
        add("lead_follow_up", l.id, `Lead follow-up missed – ${l.full_name}`, `Follow-up was due ${new Date(l.next_follow_up!).toLocaleDateString("en-IN")}.`);

      // placement no-show (stage marked "No-show" on a drive)
      for (const r of responses.filter((x) => x.stage === "No-show")) {
        const s = name.get(r.student_id);
        const d = drives.find((x) => x.id === r.drive_id);
        if (s && d) add("placement_no_show", `${r.drive_id}:${r.student_id}`, `Placement no-show – ${s.full_name}`, `Did not attend ${d.company} (${d.job_role}).`);
      }
      // project milestones past due and not done
      for (const m of milestones.filter((x) => !x.done && x.due_date < today)) {
        const pr = projects.find((x) => x.id === m.project_id);
        add("project_delay", m.id, `Milestone delayed – ${m.title}`, `${pr?.name ?? "Project"}: due ${m.due_date}, ${daysBetween(m.due_date, today)} days late.`);
      }

      if (fresh.length) await db.insert<AlertRow>("alerts", fresh);
      // escalate
      let escalated = 0;
      for (const a of existing.filter((x) => Date.parse(x.due_at) < now && x.level < 3)) {
        const rule = ALERT_RULES[a.kind];
        await db.update<AlertRow>("alerts", { id: a.id }, { level: a.level + 1, owner_role: rule?.chain[a.level] ?? a.owner_role, due_at: new Date(now + (rule?.sla ?? 48) * 3600_000).toISOString() });
        escalated++;
      }
      const notified = await crm.notifyAlerts().catch(() => 0);
      return { created: fresh.length, escalated, notified };
    },
    /** Emails / WhatsApps the contacts registered for each open alert's current owner, once per level. */
    async notifyAlerts() {
      const [open, contacts] = await Promise.all([db.select<AlertRow>("alerts", { eq: { status: "open" } }), db.select<AlertContact>("alert_contacts")]);
      const m = await import("./messaging");
      let sent = 0;
      for (const a of open.filter((x) => (x.notified_level ?? 0) < x.level)) {
        const to = contacts.filter((c) => c.role_name.toLowerCase() === a.owner_role.toLowerCase());
        const text = `${a.level > 1 ? `ESCALATION (level ${a.level}): ` : ""}${a.title}\n${a.details ?? ""}\nPlease act in the MasterVLSI ERP › Alerts.`;
        for (const c of to) {
          try {
            if (c.email && m.emailConfigured()) { await m.sendEmail(c.email, `[MasterVLSI alert] ${a.title}`, text); sent++; }
            const wa = m.waNumber(c.phone);
            if (wa && m.whatsappConfigured()) { await m.sendWhatsApp(wa, text); sent++; }
          } catch {
            /* try next contact */
          }
        }
        await db.update<AlertRow>("alerts", { id: a.id }, { notified_level: a.level });
      }
      return sent;
    },
    async saveCompanyProfile(p: Record<string, unknown>) {
      const company = p.company === "enrich" ? "enrich" : "mastervlsi";
      const keys = ["legal_name", "address", "gstin", "pan", "bank_name", "bank_account", "bank_ifsc", "email", "phone"];
      const row: Record<string, unknown> = { company };
      for (const k of keys) row[k] = String(p[k] ?? "").trim() || null;
      if (!row.legal_name) row.legal_name = company === "enrich" ? "Enrich Silicon" : "MasterVLSI";
      await db.upsert("company_profiles", [row], "company");
    },
    resolveAlert: (id: string, note: string | null) =>
      db.update<AlertRow>("alerts", { id }, { status: "resolved", resolved_at: new Date().toISOString(), resolved_note: note }),
  };
  return crm;
}

/** Hide Kacha (other-account) allocations unless the viewer is a super admin. */
export const visibleAccount = (account: FeeAccount | undefined, superAdmin: boolean) => superAdmin || (account ?? "paka") === "paka";
