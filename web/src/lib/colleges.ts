import "server-only";
import { normPhone } from "./leads";
import type { Store } from "./store/types";
import type { College, Mou, TpoContact } from "./types";
import { COLLEGE_STAGES, type CollegeActivity, type CollegeEvent, type CollegeStage, type CollegeSubmission } from "./types-colleges";

const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(of|and|the|college|engineering|institute|technology|university)\b/g, "").replace(/\s+/g, " ").trim();

/** An existing college that looks like the same one (same name, or same city with a close name). */
export function matchCollege(colleges: College[], name: string, city?: string | null) {
  const n = norm(name);
  if (!n) return undefined;
  return colleges.find((c) => norm(c.name) === n) ?? colleges.find((c) => (!city || !c.city || c.city.toLowerCase() === city.toLowerCase()) && (norm(c.name).includes(n) || n.includes(norm(c.name))) && norm(c.name).length > 3);
}

export function createCollegeRepo(db: Store) {
  const repo = {
    activities: (collegeId?: string) => db.select<CollegeActivity>("college_activities", { ...(collegeId ? { eq: { college_id: collegeId } } : {}), order: { column: "created_at", ascending: false } }),
    log: (college_id: string, kind: string, summary: string, by: string, outcome?: string | null) =>
      db.insert<CollegeActivity>("college_activities", [{ college_id, kind, summary, outcome: outcome ?? null, by_name: by, created_at: new Date().toISOString() }]),

    async moveStage(id: string, stage: CollegeStage, by: string) {
      const [c] = await db.select<College>("colleges", { eq: { id } });
      if (!c || !COLLEGE_STAGES.some((s) => s.key === stage)) return;
      // Signing the MoU makes the college a partner.
      await db.update<College>("colleges", { id }, { stage, ...(stage === "mou_signed" ? { status: "partner" as const } : {}), ...(stage === "not_interested" ? { next_follow_up: null, follow_up_note: null } : {}) });
      await repo.log(id, "stage", `Moved to ${COLLEGE_STAGES.find((s) => s.key === stage)!.label}`, by, stage);
    },

    /** Every follow-up needs remarks; the next action and date are required unless the college is closed. */
    async followUp(id: string, input: { kind: string; remarks: string; stage?: CollegeStage | ""; nextAction?: string; nextAt?: string | null }, by: string) {
      if (input.remarks.trim().length < 5) throw new Error("Write the conversation remarks");
      const closing = input.stage === "not_interested";
      if (!closing && (!input.nextAction?.trim() || !input.nextAt)) throw new Error("Add the next action and its date");
      const [c] = await db.select<College>("colleges", { eq: { id } });
      if (!c) throw new Error("College not found");
      await repo.log(id, input.kind || "call", input.remarks.trim().slice(0, 2000), by, input.stage || null);
      if (input.stage && input.stage !== c.stage) await repo.moveStage(id, input.stage, by);
      if (!closing) await db.update<College>("colleges", { id }, { next_follow_up: input.nextAt, follow_up_note: input.nextAction!.trim().slice(0, 300) });
    },

    async allocate(ids: string[], to: string, by: string) {
      const all = await db.select<College>("colleges");
      let n = 0;
      for (const id of ids) {
        const c = all.find((x) => x.id === id);
        if (!c) continue;
        await db.update<College>("colleges", { id }, { assigned_to: to });
        await repo.log(id, "allocation", c.assigned_to && c.assigned_to !== to ? `Reallocated from ${c.assigned_to} to ${to}` : `Allocated to ${to}`, by);
        n++;
      }
      return n;
    },

    submissions: () => db.select<CollegeSubmission>("college_submissions", { order: { column: "created_at", ascending: false } }),
    submit: (row: Omit<CollegeSubmission, "id" | "status" | "created_at">) => db.insert<CollegeSubmission>("college_submissions", [{ ...row, status: "pending", created_at: new Date().toISOString() }]),

    /** Verify incoming data: merge into an existing college (adding the contact if new) or create the college. */
    async verify(subId: string, target: string | null, by: string) {
      const [s] = await db.select<CollegeSubmission>("college_submissions", { eq: { id: subId } });
      if (!s || s.status !== "pending") return null;
      let collegeId = target;
      if (!collegeId) {
        const all = await db.select<College>("colleges");
        // Only codes this function issued drive the sequence: a college whose code is something
        // else entirely (a pincode, say) must not push the next number up to its value.
        const max = Math.max(0, ...all.map((c) => Number(/^CLG-[A-Z]+-(\d+)$/.exec(c.code ?? "")?.[1] ?? 0)));
        const [c] = await db.insert<College>("colleges", [{
          name: s.college_name, city: s.city ?? null, state: s.state ?? null, status: "prospect", stage: "new", source: s.source,
          code: `CLG-${(s.college_name.replace(/[^A-Za-z]/g, "").slice(0, 4) || "NEW").toUpperCase()}-${String(max + 1).padStart(3, "0")}`,
        }]);
        collegeId = c.id;
        await repo.log(collegeId, "note", `College created from incoming data (${s.source.replace("_", " ")}${s.submitted_by ? ` — ${s.submitted_by}` : ""})`, by);
      }
      if (s.contact_name) {
        const contacts = await db.select<TpoContact>("tpo_contacts", { eq: { college_id: collegeId } });
        const dup = contacts.find((t) => (s.phone && normPhone(t.phone) === normPhone(s.phone)) || t.name.toLowerCase() === s.contact_name!.toLowerCase());
        if (!dup)
          await db.insert<TpoContact>("tpo_contacts", [{ college_id: collegeId, name: s.contact_name, designation: s.designation ?? null, department: s.department ?? null, phone: s.phone ?? null, email: s.email ?? null, is_primary: contacts.length === 0, active: true, call_status: "not_called" }]);
        await repo.log(collegeId, "note", dup ? `Incoming contact ${s.contact_name} already on file` : `Contact added: ${s.contact_name}${s.designation ? ` (${s.designation})` : ""}`, by);
      }
      await db.update<CollegeSubmission>("college_submissions", { id: subId }, { status: "verified", college_id: collegeId, decided_by: by, decided_at: new Date().toISOString() });
      return collegeId;
    },
    reject: (subId: string, by: string, note?: string) =>
      db.update<CollegeSubmission>("college_submissions", { id: subId }, { status: "rejected", decided_by: by, decided_at: new Date().toISOString(), note: note || null }),
  };
  return repo;
}

export interface CollegeReminder { key: string; college_id: string; title: string; when: string; tone: "red" | "amber" | "blue"; owner?: string | null }

/** Follow-ups due, contacts to call back, MoUs expiring and events coming up. */
export function collegeReminders(colleges: College[], contacts: TpoContact[], mous: Mou[], events: CollegeEvent[], today: string, nowMs: number): CollegeReminder[] {
  const out: CollegeReminder[] = [];
  const name = new Map(colleges.map((c) => [c.id, c]));
  for (const c of colleges.filter((x) => x.next_follow_up && x.stage !== "not_interested")) {
    const due = Date.parse(c.next_follow_up!);
    if (due - nowMs < 3 * 86_400_000) out.push({ key: `cf-${c.id}`, college_id: c.id, title: `${due < nowMs ? "Overdue follow-up" : "Follow-up"}: ${c.name} — ${c.follow_up_note ?? "call"}`, when: c.next_follow_up!, tone: due < nowMs ? "red" : "amber", owner: c.assigned_to });
  }
  for (const t of contacts.filter((x) => x.active && x.next_follow_up)) {
    const due = Date.parse(t.next_follow_up!);
    if (due - nowMs < 3 * 86_400_000) out.push({ key: `tf-${t.id}`, college_id: t.college_id, title: `Call ${t.name} (${t.designation ?? "contact"}) — ${name.get(t.college_id)?.name ?? ""}`, when: t.next_follow_up!, tone: due < nowMs ? "red" : "blue", owner: name.get(t.college_id)?.assigned_to });
  }
  const in90 = new Date(nowMs + 90 * 86_400_000).toISOString().slice(0, 10);
  for (const m of mous.filter((x) => x.status === "active" && x.end_date && x.end_date <= in90))
    out.push({ key: `mou-${m.id}`, college_id: m.college_id, title: `MoU ${m.mou_no ?? ""} ${m.end_date! < today ? "expired" : "expires"} — ${name.get(m.college_id)?.name ?? ""}`, when: m.end_date!, tone: m.end_date! < today ? "red" : "amber", owner: name.get(m.college_id)?.assigned_to });
  const in14 = new Date(nowMs + 14 * 86_400_000).toISOString().slice(0, 10);
  for (const e of events.filter((x) => x.status === "planned" && x.event_date && x.event_date >= today && x.event_date <= in14))
    out.push({ key: `ev-${e.id}`, college_id: e.college_id, title: `${e.kind[0].toUpperCase() + e.kind.slice(1)}: ${e.title} — ${name.get(e.college_id)?.name ?? ""}`, when: e.event_date!, tone: "blue", owner: name.get(e.college_id)?.assigned_to });
  return out.sort((a, b) => a.when.localeCompare(b.when));
}
