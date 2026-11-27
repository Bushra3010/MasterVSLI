import "server-only";
import { normPhone } from "./leads";
import type { Store } from "./store/types";
import type { Drive, HrCall, HrContact, HrHistory, StudentApplication } from "./types";
import { HR_STAGES, type HrActivity, type HrFeedback, type HrRequirement, type HrStage, type HrSubmission, type RelationshipStatus, type StaffRelationship } from "./types-hr";

const normEmail = (e?: string | null) => (e ?? "").trim().toLowerCase();
/** LinkedIn URLs vary by protocol, host and trailing slash; compare the profile slug only. */
const normLinkedin = (l?: string | null) =>
  (l ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
const normCompany = (c?: string | null) =>
  (c ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(pvt|private|ltd|limited|inc|llp|technologies|solutions|india)\b/g, "").replace(/\s+/g, " ").trim();

export interface DuplicateHit {
  hr: HrContact;
  /** Which identifiers matched, for an explanation the user can act on. */
  on: ("phone" | "email" | "personal email" | "linkedin" | "name at company")[];
}

/**
 * An HR already on file. Mobile, email and LinkedIn are each enough on their own;
 * the same name at a company they have worked at also counts, which is how a
 * re-registration after a company change is caught.
 */
export function findDuplicates(all: HrContact[], input: Partial<HrContact>, history: HrHistory[] = []): DuplicateHit[] {
  const phone = normPhone(input.phone);
  const email = normEmail(input.email);
  const personal = normEmail(input.personal_email);
  const linkedin = normLinkedin(input.linkedin);
  const name = (input.full_name ?? "").trim().toLowerCase();
  const company = normCompany(input.current_company);
  const out: DuplicateHit[] = [];
  for (const hr of all) {
    if (input.id && hr.id === input.id) continue;
    const on: DuplicateHit["on"] = [];
    if (phone && normPhone(hr.phone) === phone) on.push("phone");
    if (email && (normEmail(hr.email) === email || normEmail(hr.personal_email) === email)) on.push("email");
    if (personal && (normEmail(hr.personal_email) === personal || normEmail(hr.email) === personal)) on.push("personal email");
    if (linkedin && normLinkedin(hr.linkedin) === linkedin) on.push("linkedin");
    if (name && company && hr.full_name.trim().toLowerCase() === name) {
      const worked = [hr.current_company, ...history.filter((h) => h.hr_id === hr.id).map((h) => h.company)];
      if (worked.some((c) => normCompany(c) && normCompany(c) === company)) on.push("name at company");
    }
    if (on.length) out.push({ hr, on });
  }
  return out;
}

/** HR-0001, HR-0002… Only codes in this format count, so a hand-entered code cannot skew the sequence. */
export function nextHrCode(all: HrContact[]) {
  const max = Math.max(0, ...all.map((h) => Number(/^HR-(\d+)$/.exec(h.hr_code ?? "")?.[1] ?? 0)));
  return `HR-${String(max + 1).padStart(4, "0")}`;
}

/** Relationship strength from how often a staff member got through, not from how often they tried. */
export function strengthFrom(connected: number): RelationshipStatus {
  if (connected >= 15) return "strong";
  if (connected >= 7) return "good";
  if (connected >= 1) return "developing";
  return "new";
}

const CONNECTED = new Set(["connected", "interested", "replied"]);

/**
 * Every staff member who has ever contacted this HR, strongest first. Built from the
 * communication log rather than a staff table, so it stays complete after someone leaves.
 */
export function staffRelationships(calls: HrCall[], hrId: string): StaffRelationship[] {
  const by = new Map<string, StaffRelationship>();
  for (const c of calls.filter((x) => x.hr_id === hrId && x.by_name)) {
    const key = c.by_name!;
    const r = by.get(key) ?? { staff: key, interactions: 0, connected: 0, last_contacted: null, strength: "new" as RelationshipStatus };
    r.interactions++;
    if (CONNECTED.has((c.outcome ?? "").toLowerCase())) r.connected++;
    if (!r.last_contacted || c.call_date > r.last_contacted) r.last_contacted = c.call_date;
    by.set(key, r);
  }
  return [...by.values()]
    .map((r) => ({ ...r, strength: strengthFrom(r.connected) }))
    .sort((a, b) => b.connected - a.connected || b.interactions - a.interactions);
}

/** Current HRs at a company are the ones whose open stint is there; everyone else who worked there is previous. */
export function companyRoster(contacts: HrContact[], history: HrHistory[], company: string) {
  const target = normCompany(company);
  const current: HrContact[] = [];
  const previous: HrContact[] = [];
  if (!target) return { current, previous };
  for (const hr of contacts) {
    const stints = history.filter((h) => h.hr_id === hr.id && normCompany(h.company) === target);
    const openHere = stints.some((h) => !h.to_date);
    if (openHere || (!stints.length && normCompany(hr.current_company) === target)) current.push(hr);
    else if (stints.length) previous.push(hr);
  }
  return { current, previous };
}

/**
 * Who may receive the student placement sheet for a company: a current HR with a verified
 * official email. Previous HRs are deliberately excluded — they are for references only.
 */
export function excelRecipients(contacts: HrContact[], history: HrHistory[], company: string) {
  return companyRoster(contacts, history, company).current.filter((h) => h.active !== false && (h.email ?? "").includes("@"));
}

export function createHrRepo(db: Store) {
  const repo = {
    activities: (hrId?: string) =>
      db.select<HrActivity>("hr_activities", { ...(hrId ? { eq: { hr_id: hrId } } : {}), order: { column: "created_at", ascending: false } }),

    log: (hr_id: string, kind: string, summary: string, by: string, outcome?: string | null) =>
      db.insert<HrActivity>("hr_activities", [{ hr_id, kind, summary, outcome: outcome ?? null, by_name: by, created_at: new Date().toISOString() }]),

    /** Create an HR with a permanent code and an opening employment stint. */
    async create(input: Partial<HrContact>, by: string, opts: { allowDuplicate?: boolean } = {}) {
      const all = await db.select<HrContact>("hr_contacts");
      const history = await db.select<HrHistory>("hr_company_history");
      const dupes = findDuplicates(all, input, history);
      if (dupes.length && !opts.allowDuplicate) return { ok: false as const, duplicates: dupes };
      const [hr] = await db.insert<HrContact>("hr_contacts", [{
        ...input,
        hr_code: nextHrCode(all),
        stage: input.stage ?? "new_hr",
        relationship_status: input.relationship_status ?? "new",
        hiring_status: input.hiring_status ?? "unknown",
        active: true,
        created_at: new Date().toISOString(),
      }]);
      if (input.current_company)
        await db.insert<HrHistory>("hr_company_history", [{
          hr_id: hr.id, company: input.current_company, designation: input.designation ?? null,
          from_date: input.joined_on ?? null, to_date: null, official_email: input.email ?? null, location: input.city ?? null,
        }]);
      await repo.log(hr.id, "note", `HR added${input.introduced_by ? ` — introduced by ${input.introduced_by}` : ""}`, by);
      return { ok: true as const, hr };
    },

    async moveStage(id: string, stage: HrStage, by: string) {
      const [hr] = await db.select<HrContact>("hr_contacts", { eq: { id } });
      if (!hr || !HR_STAGES.some((s) => s.key === stage)) return;
      await db.update<HrContact>("hr_contacts", { id }, {
        stage,
        // Reaching these stages is itself the hiring signal; keep the two fields consistent.
        ...(stage === "active_hiring" ? { hiring_status: "active_hiring" } : {}),
        ...(stage === "future_hiring" ? { hiring_status: "future_hiring" } : {}),
      });
      await repo.log(id, "stage", `Moved to ${HR_STAGES.find((s) => s.key === stage)!.label}`, by, stage);
    },

    /** Log a conversation, then advance the stage and the next follow-up in one step. */
    async contact(id: string, input: { mode: string; activity: string; outcome: string; remarks: string; stage?: HrStage | ""; nextAt?: string | null; nextNote?: string }, by: string) {
      if (input.remarks.trim().length < 3) throw new Error("Write what was discussed");
      const [hr] = await db.select<HrContact>("hr_contacts", { eq: { id } });
      if (!hr) throw new Error("HR not found");
      await db.insert<HrCall>("hr_calls", [{
        hr_id: id, call_date: new Date().toISOString().slice(0, 10), mode: input.mode || "call",
        activity: input.activity || "Follow-up", outcome: input.outcome || "Connected",
        remarks: input.remarks.trim().slice(0, 2000), by_name: by, created_at: new Date().toISOString(),
      }]);
      if (input.stage && input.stage !== hr.stage) await repo.moveStage(id, input.stage, by);
      await db.update<HrContact>("hr_contacts", { id }, {
        next_follow_up: input.nextAt ?? null,
        follow_up_note: input.nextNote?.trim().slice(0, 300) || null,
        last_verified: new Date().toISOString().slice(0, 10),
      });
    },

    /**
     * Move an HR to a new company. The previous stint is closed with a relieving date and
     * keeps its own email and designation; nothing historical is rewritten.
     */
    async changeCompany(id: string, input: { company: string; designation?: string; email?: string; from: string; location?: string; replacementHrId?: string | null }, by: string) {
      const [hr] = await db.select<HrContact>("hr_contacts", { eq: { id } });
      if (!hr) throw new Error("HR not found");
      if (!input.company.trim()) throw new Error("Give the new company");
      const history = await db.select<HrHistory>("hr_company_history", { eq: { hr_id: id } });
      const open = history.filter((h) => !h.to_date);
      for (const h of open)
        await db.update<HrHistory>("hr_company_history", { id: h.id }, {
          to_date: input.from,
          ...(h.official_email ? {} : { official_email: hr.email ?? null }),
          replacement_hr_id: input.replacementHrId ?? null,
        });
      await db.insert<HrHistory>("hr_company_history", [{
        hr_id: id, company: input.company.trim(), designation: input.designation || hr.designation || null,
        from_date: input.from, to_date: null, official_email: input.email || null, location: input.location || hr.city || null,
      }]);
      await db.update<HrContact>("hr_contacts", { id }, {
        previous_company: hr.current_company ?? null,
        current_company: input.company.trim(),
        designation: input.designation || hr.designation || null,
        email: input.email || hr.email || null,
        joined_on: input.from,
        last_verified: new Date().toISOString().slice(0, 10),
      });
      await repo.log(id, "company_change", `Moved from ${hr.current_company ?? "—"} to ${input.company.trim()}`, by);
    },

    async allocate(ids: string[], to: string, by: string) {
      const all = await db.select<HrContact>("hr_contacts");
      let n = 0;
      for (const id of ids) {
        const hr = all.find((x) => x.id === id);
        if (!hr) continue;
        await db.update<HrContact>("hr_contacts", { id }, { assigned_to: to });
        await repo.log(id, "allocation", hr.assigned_to && hr.assigned_to !== to ? `Reallocated from ${hr.assigned_to} to ${to}` : `Allocated to ${to}`, by);
        n++;
      }
      return n;
    },
  };
  return repo;
}

export interface HrReminder {
  key: string; hr_id: string; group: string; title: string; when: string;
  tone: "red" | "amber" | "blue"; owner?: string | null;
}

/** The groups the reminder centre shows, in the order the spec lists them. */
export const REMINDER_GROUPS = [
  "Upcoming drive", "HR confirmation", "Follow-up overdue", "HR not contacted", "No contact for 30 days",
  "HR changed company", "Current email missing", "Replacement HR required", "Upcoming hiring", "JD collection",
  "Student interest closing", "Excel submission due", "Email delivery failed", "Interview tomorrow",
  "Postponed drive review", "Offer letters", "Joining confirmation", "HR feedback",
] as const;

export interface ReminderCtx {
  contacts: HrContact[];
  calls: HrCall[];
  history: HrHistory[];
  drives: Drive[];
  reqs: HrRequirement[];
  subs: HrSubmission[];
  feedback: HrFeedback[];
  apps: StudentApplication[];
  today: string;
  nowMs: number;
}

const dOnly = (iso?: string | null) => (iso ? iso.slice(0, 10) : null);

/**
 * Every reminder the module raises, grouped the way the spec lists them. Each one is
 * derived from data we actually hold — nothing is invented to fill a group.
 */
export function hrReminders(ctx: ReminderCtx): HrReminder[] {
  const { contacts, calls, history, drives, reqs, subs, feedback, apps, today, nowMs } = ctx;
  const out: HrReminder[] = [];
  const add = (group: string, key: string, hr_id: string, title: string, when: string, tone: HrReminder["tone"], owner?: string | null) =>
    out.push({ group, key, hr_id, title, when, tone, owner });

  const active = contacts.filter((h) => h.active !== false);
  const byId = new Map(contacts.map((h) => [h.id, h]));
  const inDays = (n: number) => new Date(nowMs + n * 86_400_000).toISOString().slice(0, 10);

  // Last time anyone spoke to each HR.
  const lastBy = new Map<string, string>();
  for (const c of calls) {
    const prev = lastBy.get(c.hr_id);
    if (!prev || c.call_date > prev) lastBy.set(c.hr_id, c.call_date);
  }

  for (const hr of active) {
    if (hr.next_follow_up) {
      const due = Date.parse(hr.next_follow_up);
      if (due - nowMs < 3 * 86_400_000)
        add("Follow-up overdue", `hf-${hr.id}`, hr.id,
          `${due < nowMs ? "Overdue" : "Due"}: ${hr.full_name} — ${hr.follow_up_note ?? "call"}`,
          hr.next_follow_up, due < nowMs ? "red" : "amber", hr.assigned_to);
    }
    const last = lastBy.get(hr.id);
    if (!last) add("HR not contacted", `hn-${hr.id}`, hr.id, `${hr.full_name}${hr.current_company ? ` (${hr.current_company})` : ""}`, today, "blue", hr.assigned_to);
    else if (nowMs - Date.parse(last) > 30 * 86_400_000)
      add("No contact for 30 days", `hq-${hr.id}`, hr.id, `${hr.full_name} — last spoken ${last}`, last, "amber", hr.assigned_to);
    if (!(hr.email ?? "").includes("@"))
      add("Current email missing", `he-${hr.id}`, hr.id, hr.full_name, today, "red", hr.assigned_to);
  }

  // An HR whose latest stint started in the last 60 days has just moved.
  for (const h of history.filter((x) => !x.to_date && x.from_date && x.from_date >= inDays(-60))) {
    const hr = byId.get(h.hr_id);
    if (hr) add("HR changed company", `hc-${h.id}`, hr.id, `${hr.full_name} → ${h.company}`, h.from_date!, "blue", hr.assigned_to);
  }

  // A company worth keeping a contact at — one we have run a drive with, have a
  // requirement for, or where the HR left recently — but where nobody current is left.
  // An old stint at a company we never worked with is history, not a gap to chase.
  const driveCompanies = new Set(drives.map((d) => normCompany(d.company)));
  const reqCompanies = new Set(reqs.map((r) => normCompany(r.company)));
  for (const company of new Set(history.map((h) => h.company))) {
    const n = normCompany(company);
    const lastLeft = history.filter((h) => normCompany(h.company) === n && h.to_date).map((h) => h.to_date!).sort().pop();
    const recent = Boolean(lastLeft && lastLeft >= inDays(-180));
    if (!driveCompanies.has(n) && !reqCompanies.has(n) && !recent) continue;
    const { current, previous } = companyRoster(contacts, history, company);
    if (!current.length && previous.length)
      add("Replacement HR required", `hr-${company}`, previous[0].id, `${company} — no current HR on file`, lastLeft ?? today, "red", previous[0].assigned_to);
  }

  for (const r of reqs.filter((x) => ["pending", "tentative", "expected"].includes(x.status)))
    add("Upcoming hiring", `hq2-${r.id}`, r.hr_id, `${r.company} — ${r.role} (${r.vacancies} vacancies)`, r.expected_date ?? today, "blue", r.assigned_to);

  for (const d of drives) {
    const date = dOnly(d.drive_date);
    if (!date || date < today) {
      if (d.confirmation === "postponed")
        add("Postponed drive review", `pd-${d.id}`, d.hr_id ?? "", `${d.company} — postponed, needs a new date`, date ?? today, "amber", d.coordinator);
      continue;
    }
    const lead = inDays(d.reminder_lead_days ?? 7);
    if (date <= lead) {
      add("Upcoming drive", `ud-${d.id}`, d.hr_id ?? "", `${d.company} — interview ${date}`, date, "blue", d.coordinator);
      if (d.confirmation !== "confirmed")
        add("HR confirmation", `dc-${d.id}`, d.hr_id ?? "", `${d.company} — ${d.confirmation ?? "pending"}, reconfirm with the HR`, date, "amber", d.coordinator);
      if (!d.jd_url) add("JD collection", `jd-${d.id}`, d.hr_id ?? "", `${d.company} — job description not collected`, date, "amber", d.coordinator);
    }
    if (date === inDays(1)) add("Interview tomorrow", `it-${d.id}`, d.hr_id ?? "", `${d.company} — interview tomorrow`, date, "red", d.coordinator);
    const close = dOnly(d.interest_close_at);
    if (close && close >= today && close <= inDays(3))
      add("Student interest closing", `ic-${d.id}`, d.hr_id ?? "", `${d.company} — interest closes ${close}`, close, "amber", d.coordinator);
    const due = dOnly(d.excel_due_at);
    if (due && due >= today && due <= inDays(3) && !subs.some((s) => s.drive_id === d.id && s.status === "sent"))
      add("Excel submission due", `ed-${d.id}`, d.hr_id ?? "", `${d.company} — sheet due ${due}`, due, "red", d.coordinator);
    if (d.confirmation === "postponed")
      add("Postponed drive review", `pd-${d.id}`, d.hr_id ?? "", `${d.company} — postponed, needs a new date`, date, "amber", d.coordinator);
  }

  for (const s of subs.filter((x) => x.status === "failed"))
    add("Email delivery failed", `ef-${s.id}`, s.hr_id ?? "", `${s.recipient_email} — ${s.failure_reason ?? "delivery failed"}`, dOnly(s.created_at) ?? today, "red", s.prepared_by);

  // Selected but no offer recorded, and offered but not yet joined.
  for (const a of apps.filter((x) => x.status === "selected"))
    add("Offer letters", `ol-${a.id}`, "", `${a.company} — offer letter pending`, a.applied_on, "amber", null);
  for (const a of apps.filter((x) => x.status === "placed" && !x.doj))
    add("Joining confirmation", `jc-${a.id}`, "", `${a.company} — joining date not confirmed`, a.applied_on, "amber", null);

  for (const f of feedback.filter((x) => x.status !== "closed"))
    add("HR feedback", `fb-${f.id}`, f.hr_id, `${f.company ?? ""} — ${f.action ?? f.feedback}`.trim(), f.due_on ?? today, f.sentiment === "concern" ? "red" : "amber", f.assigned_to);

  return out.sort((a, b) => a.when.localeCompare(b.when));
}
