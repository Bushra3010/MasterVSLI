import "server-only";
import type { Store } from "./store/types";
import type { Education, MasterCategory, MasterOption, Student, StudentApplication, StudentExtra, StudentNote, TpoContact } from "./types";
import { EDU_ROWS } from "./types-profile";

export type ProfileMode = "staff" | "student";

/** Reads the enhanced profile form. Students may only change their own personal, contact, address, family, education and pre-joining details. */
export function parseProfileForm(form: FormData, mode: ProfileMode, current: Student) {
  const g = (k: string) => {
    const v = form.get(k);
    return v === null ? undefined : String(v).trim();
  };
  const opt = (k: string) => g(k) || null;
  const on = (k: string) => form.get(k) === "on";
  const group = (prefix: string, keys: string[]) => Object.fromEntries(keys.map((k) => [k, g(`${prefix}.${k}`) || undefined]).filter(([, v]) => v !== undefined));

  const full_name = g("full_name");
  if (!full_name || full_name.length < 2) throw new Error("Full name is required");

  const address = group("address", ["line", "city", "district", "state", "pincode"]);
  const currentSame = on("extra.current_same");
  const prev = current.extra ?? {};
  const extra: StudentExtra = {
    ...prev,
    phone_whatsapp: on("extra.phone_whatsapp"),
    alt_whatsapp: on("extra.alt_whatsapp"),
    current_same: currentSame,
    current_address: currentSame ? address : group("current", ["line", "city", "district", "state", "pincode"]),
    before: { designation: g("before.designation") || undefined, from: g("before.from") || undefined, to: g("before.to") || undefined, location: g("before.location") || undefined },
    ...(form.has("career_objective") ? { career_objective: g("career_objective")?.slice(0, 500) || undefined } : {}),
    ...(form.has("gap.from") ? { career_gap: group("gap", ["from", "to", "reason"]) } : {}),
    ...(form.has("ci.roll_no") ? { college_info: group("ci", ["roll_no", "department", "hod", "tpo", "faculty"]) } : {}),
    ...(form.has("co.employee_id") ? { corporate: { ...group("co", ["employee_id", "department", "hr_name", "hr_contact", "manager_name", "manager_contact"]), ...(mode === "staff" ? group("co", ["billing"]) : prev.corporate?.billing ? { billing: prev.corporate.billing } : {}) } } : {}),
  };
  if (mode === "staff") {
    extra.admin_contact = g("extra.admin_contact") || undefined;
    extra.complementary_months = g("extra.complementary_months") ? Number(g("extra.complementary_months")) : 0;
    extra.validity_type = g("extra.validity_type") === "extendable" ? "extendable" : "fixed";
    extra.company_designation = g("extra.company_designation") || undefined;
    extra.placement = group("after", ["status", "company", "designation", "package", "doj", "hr_name", "hr_email", "location"]);
  }

  const patch: Partial<Student> = {
    full_name,
    dob: opt("dob"),
    gender: opt("gender"),
    marital_status: opt("marital_status"),
    blood_group: opt("blood_group"),
    nationality: opt("nationality"),
    languages: (g("languages") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    native_place: opt("native_place"),
    phone: opt("phone"),
    alt_phone: opt("alt_phone"),
    email: opt("email"),
    alt_email: opt("alt_email"),
    linkedin: opt("linkedin"),
    address,
    family: group("family", ["father_name", "father_occupation", "father_phone", "mother_name", "mother_occupation", "mother_phone"]),
    emergency: group("emergency", ["name", "relation", "phone"]),
    spouse: form.has("spouse.name") ? group("spouse", ["name", "occupation", "phone"]) : (current.spouse ?? {}),
    professional: {
      ...(current.professional ?? {}),
      ...group("pro", ["working_status", "company", "total_exp", "relevant_exp", "current_ctc", "expected_ctc", "notice_period", "preferred_location", "interview_mode"]),
      relocate: on("pro.relocate"),
    },
    extra,
  };
  if (mode === "staff") {
    const cat = g("category");
    Object.assign(patch, {
      ...(cat ? { category: (["normal", "college", "corporate"].includes(cat) ? cat : "normal") as Student["category"] } : {}),
      ...(form.has("branch_id") ? { branch_id: opt("branch_id") } : {}),
      ...(form.has("college_id") ? { college_id: cat === "college" ? opt("college_id") : null } : {}),
      ...(form.has("client_id") ? { client_id: cat === "corporate" ? opt("client_id") : null } : {}),
      course_id: opt("course_id"),
      batch_id: opt("batch_id"),
      training_mode: (g("training_mode") as Student["training_mode"]) || "hybrid",
      admission_date: g("admission_date") || current.admission_date,
      validity_end: opt("validity_end"),
      payment_plan: opt("payment_plan"),
      referred_by: opt("referred_by"),
      lead_source: opt("lead_source"),
      placement_consent: on("placement_consent"),
      placement_eligible: on("placement_eligible"),
    } satisfies Partial<Student>);
  }

  const num = (k: string) => (g(k) ? Number(g(k)) : null);
  const education: Omit<Education, "id" | "student_id">[] = EDU_ROWS.map((r, i) => ({
    level: r.key,
    board: opt(`edu.${i}.board`),
    stream: opt(`edu.${i}.stream`),
    institution: opt(`edu.${i}.institution`),
    start_year: num(`edu.${i}.start`),
    end_year: num(`edu.${i}.end`),
    year_of_passing: num(`edu.${i}.year`),
    score: opt(`edu.${i}.score`),
    state: opt(`edu.${i}.state`),
    location: opt(`edu.${i}.state`),
  }));

  const refs = mode === "staff" ? { zoom: g("ref.zoom")?.toLowerCase() || null, teamviewer: opt("ref.teamviewer"), biometric: opt("ref.biometric") } : null;

  const contacts = [0, 1, 2, 3, 4].map((i) => ({
    id: g(`contact.${i}.id`) || undefined,
    designation: g(`contact.${i}.position`) || "",
    name: g(`contact.${i}.name`) || "",
    phone: g(`contact.${i}.phone`) || null,
    email: g(`contact.${i}.email`) || null,
    remove: on(`contact.${i}.remove`),
  }));

  return { patch, education, refs, contacts };
}

export function createProfileRepo(db: Store) {
  return {
    async options(): Promise<Record<MasterCategory, string[]>> {
      const rows = await db.select<MasterOption>("master_options", { order: { column: "sort" } });
      const out = { board: [], university: [], stream: [], contact_position: [], validity_months: [], designation: [] } as Record<MasterCategory, string[]>;
      for (const r of rows) out[r.category]?.push(r.value);
      for (const k of Object.keys(out) as MasterCategory[]) if (k !== "validity_months") out[k].sort((a, b) => a.localeCompare(b));
      out.validity_months.sort((a, b) => Number(a) - Number(b));
      return out;
    },
    async addOption(category: MasterCategory, value: string) {
      const v = value.trim();
      if (!v) throw new Error("Enter a value");
      if (category === "validity_months" && !(Number(v) > 0)) throw new Error("Validity must be a number of months");
      const existing = await db.select<MasterOption>("master_options", { eq: { category, value: v } });
      if (!existing.length) await db.insert<MasterOption>("master_options", [{ category, value: v, sort: 100, created_at: new Date().toISOString() } as Partial<MasterOption>]);
      return v;
    },
    removeOption: (category: MasterCategory, value: string) => db.remove("master_options", { category, value }),

    applications: (studentId: string) => db.select<StudentApplication>("student_applications", { eq: { student_id: studentId }, order: { column: "applied_on", ascending: false } }),
    async saveApplication(a: Partial<StudentApplication> & { student_id: string }) {
      const now = new Date().toISOString();
      if (a.id) await db.update<StudentApplication>("student_applications", { id: a.id }, { ...a, updated_at: now });
      else await db.insert<StudentApplication>("student_applications", [{ status: "applied", rounds: 0, applied_on: now.slice(0, 10), ...a, created_at: now, updated_at: now }]);
    },
    removeApplication: (id: string) => db.remove("student_applications", { id }),

    notes: (studentId: string) => db.select<StudentNote>("student_notes", { eq: { student_id: studentId }, order: { column: "created_at", ascending: false } }),
    addNote: (studentId: string, note: string, by: string) => db.insert<StudentNote>("student_notes", [{ student_id: studentId, note, by_name: by, created_at: new Date().toISOString() }]),

    collegeContacts: (collegeId: string) => db.select<TpoContact>("tpo_contacts", { eq: { college_id: collegeId }, order: { column: "created_at" } }),
    async saveCollegeContacts(collegeId: string, contacts: { id?: string; designation: string; name: string; phone: string | null; email: string | null; remove: boolean }[]) {
      for (const c of contacts) {
        if (c.id && c.remove) await db.remove("tpo_contacts", { id: c.id });
        else if (c.id) await db.update<TpoContact>("tpo_contacts", { id: c.id }, { designation: c.designation || null, name: c.name, phone: c.phone, email: c.email });
        else if (c.name) await db.insert<TpoContact>("tpo_contacts", [{ college_id: collegeId, designation: c.designation || null, name: c.name, phone: c.phone, email: c.email, is_primary: false, active: true, created_at: new Date().toISOString() } as Partial<TpoContact>]);
      }
    },
  };
}
