import { addDays } from "../format";
import type {
  AlertContact,
  AlertRow,
  Appraisal,
  AssignmentRow,
  AuditRow,
  CollegeLogin,
  CompanyProfile,
  Milestone,
  Submission,
  TpoInteraction,
  AmbassadorActivity,
  Assessment,
  Branch,
  CampusDrive,
  Client,
  College,
  Consent,
  Course,
  CourseModule,
  HrCall,
  HrContact,
  HrHistory,
  Invoice,
  Lead,
  LeadActivity,
  ModuleProgress,
  Mou,
  Project,
  Staff,
  Student,
  TermsDoc,
  Timesheet,
  TpoContact,
} from "../types";

export interface CrmTables {
  branches: Branch[];
  colleges: College[];
  tpo_contacts: TpoContact[];
  mous: Mou[];
  campus_drives: CampusDrive[];
  clients: Client[];
  projects: Project[];
  timesheets: Timesheet[];
  invoices: Invoice[];
  leads: Lead[];
  lead_activities: LeadActivity[];
  hr_contacts: HrContact[];
  hr_company_history: HrHistory[];
  hr_calls: HrCall[];
  ambassador_activities: AmbassadorActivity[];
  course_modules: CourseModule[];
  module_progress: ModuleProgress[];
  assessments: Assessment[];
  terms: TermsDoc[];
  consents: Consent[];
  alerts: AlertRow[];
  assignments: AssignmentRow[];
  assignment_submissions: Submission[];
  college_logins: CollegeLogin[];
  tpo_interactions: TpoInteraction[];
  alert_contacts: AlertContact[];
  project_milestones: Milestone[];
  staff_appraisals: Appraisal[];
  company_profiles: CompanyProfile[];
  audit_log: AuditRow[];
}

/** The 17 placement terms (summarised); admins can edit the wording in Settings › Terms. */
export const DEFAULT_PLACEMENT_TERMS = [
  ["Standard course & placement-support period", "The standard course duration and placement-support period is one year from the date of my first fee installment."],
  ["No fixed placement-opportunity limit for sincere students", "MasterVLSI does not prescribe a fixed numerical limit on placement opportunities for consistently sincere students."],
  ["MasterVLSI office decision on extended support", "The decision to grant, continue, pause, restrict or withdraw extended placement support rests with the MasterVLSI office."],
  ["Placement group eligibility", "The MasterVLSI Placement Group is only for students attending regular classes and actively participating in placements."],
  ["Placement rules & student declaration", "I have read, understood and agree to follow all MasterVLSI placement rules."],
  ["Fee commitment", "Placement support continues only while my fee installments are paid on schedule."],
  ["Attendance requirement", "I will maintain at least 75% attendance across live, recorded and lab sessions."],
  ["Assignments & assessments", "I will complete module tests and assignments on time; scores are shared with hiring partners."],
  ["Interview attendance", "Once I confirm interest in a drive, I will attend the interview; no-shows may pause my placement access."],
  ["Truthful profile", "My resume and profile details are true; misrepresentation leads to withdrawal of support."],
  ["Offer acceptance", "If I accept an offer through MasterVLSI, I will inform the placement team before joining or declining."],
  ["Multiple offers", "I will not hold multiple offers unfairly; I will release offers I do not intend to accept."],
  ["Communication etiquette", "I will communicate professionally with HRs, TPOs and the placement team."],
  ["Group conduct", "I will not share group links, job posts or interview material outside the MasterVLSI Placement Group."],
  ["Confidentiality", "Company assessments and interview content are confidential."],
  ["Placement updates", "I will keep my availability, location preference and contact details up to date."],
  ["Final authority", "In case of any dispute, the decision of the MasterVLSI management is final."],
].map(([title, body]) => ({ title, body }));

export const DEFAULT_GENERAL_TERMS = [
  ["Fees & refunds", "Course fees are payable as per the agreed installment plan. Fees once paid are non-refundable and non-transferable."],
  ["Training validity", "Access to live classes, recordings, labs and materials is valid for the period stated at admission; renewal is at the institute's discretion."],
  ["Access control", "Access may be paused if installments are overdue, attendance is irregular, or conduct rules are broken."],
  ["Course material", "All recordings, lab material and documents are for personal learning only and must not be shared or recorded."],
  ["Lab systems", "Lab systems and TeamViewer access are for training only; misuse leads to immediate withdrawal."],
  ["Certificates", "Certificates are issued only after course completion, minimum attendance and clearing assessments."],
  ["Data & communication", "I agree to receive training, fee and placement updates on WhatsApp, SMS and email."],
].map(([title, body]) => ({ title, body }));

const MODULES: Record<string, [string, number][]> = {
  "c-dv": [["Digital Design", 24], ["Verilog HDL", 28], ["SystemVerilog", 32], ["UVM", 36], ["FastTrack (TB & DV flow)", 18], ["APB Protocol", 16], ["AHB Protocol", 16], ["AXI Protocol", 20], ["I²C Protocol", 14], ["PCIe Protocol", 40], ["DDR Protocol", 28], ["Ethernet / SoC / USB", 34]],
  "c-pd": [["Unix & Tcl", 12], ["Synthesis", 18], ["STA", 24], ["Floorplanning", 16], ["Placement & CTS", 20], ["Routing & signoff", 22]],
  "c-dft": [["DFT basics", 10], ["Scan insertion", 14], ["ATPG", 16], ["MBIST", 12]],
  "c-al": [["CMOS fundamentals", 12], ["Virtuoso layout", 18], ["Matching & parasitics", 10], ["DRC / LVS", 14]],
};

export function buildCrmSeed(today: string, r: () => number, students: Student[], courses: Course[], staff: Staff[]): CrmTables {
  const ts = (d: number, h = 10) => `${addDays(today, d)}T${String(h).padStart(2, "0")}:00:00Z`;
  const branches: Branch[] = [
    { id: "br-hyd", name: "Hyderabad (Head office)", city: "Hyderabad", domain: "Design Verification", company: "mastervlsi" },
    { id: "br-blr", name: "Bengaluru", city: "Bengaluru", domain: "Physical Design", company: "mastervlsi" },
    { id: "br-es", name: "Enrich Silicon, Bengaluru", city: "Bengaluru", domain: "VLSI services", company: "enrich" },
  ];
  students.forEach((s, i) => {
    s.branch_id = i % 3 === 1 ? "br-blr" : "br-hyd";
    s.category = i % 7 === 3 ? "college" : i % 11 === 5 ? "corporate" : "normal";
    s.college_id = s.category === "college" ? (i % 2 ? "col-atme" : "col-bms") : null;
    s.client_id = s.category === "corporate" ? "cl-advlogics" : null;
    s.placement_group = i < 2 ? "added" : i === 2 ? "requested" : "none";
  });
  staff.forEach((s) => ((s.company = "mastervlsi"), (s.branch_id = "br-hyd")));
  staff.push(
    { id: "st-es1", employee_code: "ES001", full_name: "Arvind Menon", designation: "Verification Lead", department: "Engineering", joining_date: "2024-01-10", monthly_salary: 180000, email: "arvind@enrichsilicon.example", phone: "9900000101", company: "enrich", branch_id: "br-es" },
    { id: "st-es2", employee_code: "ES002", full_name: "Keerthi Varma", designation: "DV Engineer", department: "Engineering", joining_date: addDays(today, -40), monthly_salary: 65000, email: "keerthi@enrichsilicon.example", phone: "9900000102", company: "enrich", branch_id: "br-es", source_student_id: students[21]?.id ?? null },
  );

  const colleges: College[] = [
    { id: "col-atme", code: "CLG-ATME-001", name: "ATME College of Engineering", city: "Mysuru", state: "Karnataka", affiliation: "VTU", college_type: "Private", since: "2024-06-01", status: "partner", stage: "mou_signed", assigned_to: "Rakesh Kumar", student_strength: 3200, target_students: 840, departments: "ECE, EEE, CSE", next_follow_up: ts(3, 5), follow_up_note: "Plan DV seminar for 3rd years" },
    { id: "col-bms", code: "CLG-BMS-002", name: "BMS Institute of Technology", city: "Bengaluru", state: "Karnataka", affiliation: "VTU", college_type: "Private", since: "2024-07-15", status: "partner", stage: "mou_signed", assigned_to: "Sowmya Rao", student_strength: 2400, target_students: 600, departments: "ECE, EEE" },
    { id: "col-pes", code: "CLG-PES-003", name: "PES University", city: "Bengaluru", state: "Karnataka", affiliation: "Autonomous", college_type: "Private", since: "2024-09-20", status: "partner", stage: "proposal_sent", assigned_to: "Rakesh Kumar", student_strength: 4000, target_students: 900, departments: "ECE, EEE, CSE, ISE", next_follow_up: ts(-1, 5), follow_up_note: "Chase proposal approval" },
    { id: "col-jntu", code: "CLG-JNTU-004", name: "JNTU Hyderabad", city: "Hyderabad", state: "Telangana", affiliation: "JNTU", college_type: "Government", since: null, status: "prospect", stage: "interested", assigned_to: "Sowmya Rao", student_strength: 5000, target_students: 1000, departments: "ECE" },
    { id: "col-sit", code: "CLG-SIT-005", name: "Siddaganga Institute of Technology", city: "Tumakuru", state: "Karnataka", affiliation: "VTU", college_type: "Private", since: null, status: "prospect", stage: "new", assigned_to: null, student_strength: 1800, target_students: 450, departments: "ECE" },
    { id: "col-mce", code: "CLG-MCE-006", name: "Malnad College of Engineering", city: "Hassan", state: "Karnataka", affiliation: "VTU", college_type: "Private-aided", since: null, status: "prospect", stage: "meeting_scheduled", assigned_to: "Rakesh Kumar", student_strength: 1200, target_students: 300, next_follow_up: ts(2, 5), follow_up_note: "Meet the principal and HOD ECE" },
    { id: "col-kle", code: "CLG-KLE-007", name: "KLE Technological University", city: "Hubballi", state: "Karnataka", affiliation: "Autonomous", college_type: "Private", since: null, status: "prospect", stage: "non_connected", assigned_to: "Sowmya Rao", student_strength: 1600, target_students: 400 },
  ];
  const tpo_contacts: TpoContact[] = [
    { id: "tpo-1", college_id: "col-atme", name: "Dr. Manjunath R", designation: "Training & Placement Officer", phone: "9845011223", alt_phone: "9141177889", email: "tpo@atme.example", is_primary: true, active: true, remarks: "Supportive, open for trainings & drives", next_follow_up: ts(3, 5), last_interaction: addDays(today, -4) },
    { id: "tpo-2", college_id: "col-atme", name: "Sushma G", designation: "Placement Coordinator", phone: "9007255766", email: "placements@atme.example", is_primary: false, active: true, remarks: null, next_follow_up: null, last_interaction: addDays(today, -12) },
    { id: "tpo-3", college_id: "col-bms", name: "Rakesh Kumar", designation: "TPO", phone: "9886677889", email: "tpo@bmsit.example", is_primary: true, active: true, remarks: null, next_follow_up: ts(1, 6), last_interaction: addDays(today, -20) },
    { id: "tpo-4", college_id: "col-pes", name: "Vishal R", designation: "TPO", phone: "9632566771", email: "tpo@pes.example", is_primary: true, active: false, remarks: "Moved to another role", next_follow_up: null, last_interaction: addDays(today, -90) },
  ];
  const mous: Mou[] = [
    { id: "mou-1", college_id: "col-atme", mou_no: "MVL-MOU-001", agreement_type: "MoU (Training + Placement)", start_date: "2024-06-01", end_date: "2027-05-31", scope: "Student training & certifications; Internship / project guidance; Campus placement drives; Industry workshops", status: "active" },
    { id: "mou-2", college_id: "col-bms", mou_no: "MVL-MOU-002", agreement_type: "MoU (Training)", start_date: "2024-07-15", end_date: addDays(today, 60), scope: "Student training & certifications", status: "active" },
    { id: "mou-3", college_id: "col-pes", mou_no: "MVL-AGR-003", agreement_type: "Agreement (Campus Drive)", start_date: "2024-09-20", end_date: addDays(today, -10), scope: "Campus placement drives", status: "expired" },
  ];
  const campus_drives: CampusDrive[] = [
    { id: "cd-1", college_id: "col-atme", company: "Qualcomm", job_role: "Design Verification Engineer", drive_date: addDays(today, -6), mode: "onsite", eligibility: "B.E / B.Tech (ECE, EEE, CSE), CGPA ≥ 7.0", package: "₹10–14 LPA", registered: 248, attended: 220, shortlisted: 68, selected: 52, status: "completed" },
    { id: "cd-2", college_id: "col-bms", company: "HCLTech", job_role: "Verification Intern", drive_date: addDays(today, -25), mode: "hybrid", eligibility: "B.E 2026 batch", package: "₹25k/month", registered: 196, attended: 178, shortlisted: 56, selected: 44, status: "completed" },
    { id: "cd-3", college_id: "col-atme", company: "Enrich Silicon", job_role: "DV Engineer", drive_date: addDays(today, 28), mode: "onsite", eligibility: "MasterVLSI-trained, ≥ 75% score", package: "₹6–8 LPA", registered: 85, attended: 0, shortlisted: 0, selected: 0, status: "upcoming" },
  ];

  const clients: Client[] = [
    { id: "cl-advlogics", name: "AdvLogics Semiconductors", contact_person: "Ravi Teja", email: "ravi@advlogics.example", phone: "9700000001", gstin: "29ABCDE1234F1Z5", kind: "corporate_training" },
    { id: "cl-siliconx", name: "SiliconX Labs", contact_person: "Meera Iyer", email: "meera@siliconx.example", phone: "9700000002", gstin: "36PQRSX9876K1Z2", kind: "services" },
  ];
  const projects: Project[] = [
    { id: "pr-1", client_id: "cl-siliconx", name: "AXI interconnect verification", status: "active", start_date: addDays(today, -60), end_date: addDays(today, 60), hourly_rate: 2500 },
    { id: "pr-2", client_id: "cl-advlogics", name: "Corporate DV training batch", status: "active", start_date: addDays(today, -30), end_date: addDays(today, 30), hourly_rate: null },
  ];
  const timesheets: Timesheet[] = [];
  for (let d = 1; d <= 6; d++)
    for (const sid of ["st-es1", "st-es2"]) timesheets.push({ id: `ts-${sid}-${d}`, project_id: "pr-1", staff_id: sid, work_date: addDays(today, -d), hours: 7 + Math.round(r() * 2), note: null });
  const invoices: Invoice[] = [
    { id: "inv-1", invoice_no: "ES-INV-2026-0001", company: "enrich", client_id: "cl-siliconx", issue_date: addDays(today, -30), description: "AXI verification — October", amount: 420000, gst_pct: 18, status: "paid", paid_on: addDays(today, -12) },
    { id: "inv-2", invoice_no: "ES-INV-2026-0002", company: "enrich", client_id: "cl-siliconx", issue_date: addDays(today, -2), description: "AXI verification — November", amount: 380000, gst_pct: 18, status: "unpaid", paid_on: null },
    { id: "inv-3", invoice_no: "MV-INV-2026-0001", company: "mastervlsi", client_id: "cl-advlogics", issue_date: addDays(today, -15), description: "Corporate DV training (10 seats)", amount: 250000, gst_pct: 18, status: "unpaid", paid_on: null },
  ];

  const leadNames: [string, string, string, Lead["stage"], number][] = [
    ["Rohit Gupta", "Website", "DV", "interested", -3], ["Vishal Sharma", "Website", "DV", "interested", -2], ["Sushma P", "WhatsApp", "DV", "visited", -6],
    ["Sneha Kulkarni", "WhatsApp", "PD", "lead", 0], ["Aditya Kumar", "Referral", "DV", "lead", -1], ["Pooja M", "Manual call", "DFT", "lead", -4],
    ["Neha R", "WhatsApp", "DV", "interested", -2], ["Deepak L", "Instagram", "PD", "visited", -5], ["Manjunath P", "Referral", "DV", "interested", -1],
    ["Rakesh K", "Website", "AL", "visited", -7], ["Karthik Reddy", "Website", "DV", "lead", -1], ["Pooja Nair", "Website", "PD", "lost", -9],
    ["Priya S", "Website", "DV", "non_connected", -2], ["Sanjay R", "WhatsApp", "PD", "connected", -1], ["Arjun K", "Referral", "DV", "visit_scheduled", -1],
    ["Manoj H", "Walk-in", "DV", "admission_pending", -4], ["Vijay K", "Google", "PD", "future_follow_up", -12],
  ];
  const leads: Lead[] = leadNames.map(([full_name, source, course_code, stage, d], k) => {
    const stage_dates: Record<string, string> = { lead: ts(d - 2) };
    if (["interested", "visited", "visit_scheduled", "admission_pending"].includes(stage)) stage_dates.interested = ts(d - 1);
    if (stage !== "lead" && stage !== "interested" && stage !== "visited") stage_dates[stage] = ts(d);
    if (stage === "visited") stage_dates.visited = ts(d);
    return {
      id: `ld-${k + 1}`, lead_no: `MVL-LEAD-${String(8450 + k)}`, full_name, phone: `98${String(76500000 + k * 1111).slice(0, 8)}`,
      email: `${full_name.split(" ")[0].toLowerCase()}@example.com`, city: k % 2 ? "Bengaluru" : "Hyderabad", source, course_code, stage,
      assigned_to: k % 2 ? "Sowmya Rao" : "Rakesh Kumar", next_follow_up: stage === "lost" ? null : k === 12 ? ts(-1, 5) : ts(1 + (k % 3), 5),
      follow_up_note: stage === "visited" ? "Confirm enrollment & preferred batch" : "Share fee & batch details",
      batch_pref: "Dec 2026", mode_pref: k % 2 ? "Online" : "Offline", fee_plan: "Installment", education: "B.E ECE 2024",
      remarks: stage === "visited" ? "Liked the curriculum and placement support" : null,
      referred_by_student: source === "Referral" ? students[0]?.id ?? null : null, student_id: null, stage_dates, created_at: ts(d - 2),
    };
  });
  const lead_activities: LeadActivity[] = [];
  for (const l of leads) {
    lead_activities.push({ id: `la-${l.id}-1`, lead_id: l.id, kind: "call", summary: "Initial discussion: DV training, duration, fee and placements", outcome: l.stage === "lead" ? "Callback" : "Interested", by_name: l.assigned_to, created_at: l.stage_dates.lead });
    if (l.stage_dates.visited) lead_activities.push({ id: `la-${l.id}-2`, lead_id: l.id, kind: "visit", summary: "Visited the institute, attended counselling session", outcome: "Visited", by_name: l.assigned_to, created_at: l.stage_dates.visited });
  }

  const hr_contacts: HrContact[] = [
    { id: "hr-1", hr_code: "HR-0001", full_name: "Priya Sharma", designation: "HR Manager", department: "Human Resources", phone: "9876543210", email: "priya.sharma@qualcomm.example", personal_email: "priya.sharma.hr@example.com", linkedin: "linkedin.com/in/priyasharma", city: "Bangalore", current_company: "Qualcomm", company_type: "Semiconductor", joined_on: "2026-02-01", previous_company: "ABC Technologies Pvt. Ltd.", stage: "active_hiring", relationship_status: "strong", hiring_status: "active_hiring", assigned_to: "Rakesh Kumar", alt_assigned_to: "Sowmya Rao", introduced_by: "Rakesh Kumar", source: "employee_reference", preferred_contact: "Call", next_follow_up: ts(1, 10), follow_up_note: "Confirm December drive and collect JD", last_verified: addDays(today, -4), active: true, reference_note: "Known since TechSolutions India. Hired our students in 2022 & 2023 batches. Good reference for future hiring." },
    { id: "hr-2", hr_code: "HR-0002", full_name: "Rohan Kapoor", designation: "Talent Acquisition Lead", department: "HR", phone: "9811122233", email: "rohan@techvision.example", linkedin: null, city: "Hyderabad", current_company: "TechVision Solutions", company_type: "Semiconductor", joined_on: "2023-02-01", stage: "rapport_building", relationship_status: "developing", hiring_status: "future_hiring", assigned_to: "Sowmya Rao", introduced_by: "Sowmya Rao", source: "linkedin", preferred_contact: "Email", last_verified: addDays(today, -30), active: true, reference_note: null },
    { id: "hr-3", hr_code: "HR-0003", full_name: "Anjali Singh", designation: "Senior Recruiter", department: "HR", phone: "9822233344", email: "anjali@globalinfotech.example", linkedin: null, city: "Bangalore", current_company: "Global Infotech Ltd.", company_type: "VLSI Services", joined_on: "2022-08-10", stage: "new_hr", relationship_status: "new", hiring_status: "unknown", assigned_to: null, source: "cold_call", active: true, reference_note: null },
  ];
  const hr_company_history: HrHistory[] = [
    { id: "hh-0", hr_id: "hr-1", company: "Qualcomm", designation: "HR Manager", from_date: "2026-02-01", to_date: null, official_email: "priya.sharma@qualcomm.example", location: "Bangalore" },
    { id: "hh-1", hr_id: "hr-1", company: "ABC Technologies Pvt. Ltd.", designation: "HR Manager", from_date: "2024-04-15", to_date: "2026-01-28", official_email: "priya.sharma@abctech.example", location: "Bangalore" },
    { id: "hh-2", hr_id: "hr-1", company: "TechSolutions India Pvt. Ltd.", designation: "Senior HR Executive", from_date: "2021-06-01", to_date: "2024-04-10", official_email: "priya@techsolutions.example", location: "Bangalore" },
    { id: "hh-3", hr_id: "hr-1", company: "BrightMind Systems", designation: "HR Executive", from_date: "2019-01-15", to_date: "2021-05-31", official_email: "priya@brightmind.example", location: "Pune" },
    { id: "hh-4", hr_id: "hr-2", company: "TechVision Solutions", designation: "Talent Acquisition Lead", from_date: "2023-02-01", to_date: null, official_email: "rohan@techvision.example", location: "Hyderabad" },
    { id: "hh-5", hr_id: "hr-3", company: "Global Infotech Ltd.", designation: "Senior Recruiter", from_date: "2022-08-10", to_date: null, official_email: "anjali@globalinfotech.example", location: "Bangalore" },
  ];
  const hr_calls: HrCall[] = [
    { id: "hc-1", hr_id: "hr-1", call_date: addDays(today, -4), mode: "call", by_name: "Rakesh Kumar", activity: "Placement discussion", outcome: "Interested", remarks: "Open for 2026 batch hiring. Share student profiles." },
    { id: "hc-2", hr_id: "hr-1", call_date: addDays(today, -14), mode: "email", by_name: "Sowmya Rao", activity: "Follow-up", outcome: "Replied", remarks: "Will check requirement and revert next week." },
    { id: "hc-3", hr_id: "hr-1", call_date: addDays(today, -22), mode: "meeting", by_name: "Rakesh Kumar", activity: "Placement discussion", outcome: "Connected", remarks: "Met at the Bengaluru office; agreed on a December drive." },
    { id: "hc-4", hr_id: "hr-1", call_date: addDays(today, -40), mode: "whatsapp", by_name: "Imran Sheikh", activity: "Follow-up", outcome: "Replied", remarks: "Shared the institute profile deck." },
    { id: "hc-5", hr_id: "hr-2", call_date: addDays(today, -30), mode: "call", by_name: "Sowmya Rao", activity: "Introduction call", outcome: "Connected", remarks: "Introduced our placement services." },
  ];

  const ambassador_activities: AmbassadorActivity[] = [
    { id: "am-1", student_id: students[0].id, kind: "referral", details: "Aditya Kumar — enrolled (DV)", reward_amount: 2000, gift: null, status: "credited", created_at: ts(-4) },
    { id: "am-2", student_id: students[0].id, kind: "review", details: "Google review #3 — approved", reward_amount: 0, gift: "Hamper", status: "delivered", created_at: ts(-7) },
    { id: "am-3", student_id: students[0].id, kind: "social", details: "Liked, subscribed & shared (week 2)", reward_amount: 100, gift: null, status: "credited", created_at: ts(-10) },
    { id: "am-4", student_id: students[1].id, kind: "mentor", details: "Guided 1 student (UVM project)", reward_amount: 1000, gift: null, status: "approved", created_at: ts(-2) },
    { id: "am-5", student_id: students[2].id, kind: "referral", details: "Referred Manjunath P (visited)", reward_amount: 0, gift: null, status: "pending", created_at: ts(-1) },
    // Earn & Rewards demo for the first student: feedback cycle, social media counts, a referral
    { id: "am-6", student_id: students[0].id, kind: "feedback", details: "Trainer explains UVM very clearly; labs are well organised.", reward_amount: 0, gift: null, status: "approved", created_at: ts(-12), data: { text: "Trainer explains UVM very clearly; labs are well organised." } },
    { id: "am-7", student_id: students[0].id, kind: "feedback", details: "Mock interviews helped a lot.", reward_amount: 0, gift: null, status: "approved", created_at: ts(-9), data: { text: "Mock interviews helped a lot." } },
    { id: "am-8", student_id: students[0].id, kind: "feedback", details: "Good placement support.", reward_amount: 0, gift: null, status: "approved", created_at: ts(-6), data: { text: "Good placement support." } },
    { id: "am-9", student_id: students[0].id, kind: "feedback", details: "Would like more weekend doubt sessions.", reward_amount: 0, gift: null, status: "pending", created_at: ts(-1), data: { text: "Would like more weekend doubt sessions." } },
    { id: "am-10", student_id: students[0].id, kind: "social", details: "YouTube – 2,500 likes, 2,500 shares, 2,000 subscribes", reward_amount: 0, gift: null, status: "approved", created_at: ts(-8), data: { platform: "youtube", likes: 2500, shares: 2500, subscribes: 2000 } },
    { id: "am-11", student_id: students[0].id, kind: "social", details: "Instagram – 500 / 500 / 500", reward_amount: 0, gift: null, status: "approved", created_at: ts(-8), data: { platform: "instagram", likes: 500, shares: 500, subscribes: 500 } },
    { id: "am-12", student_id: students[0].id, kind: "social", details: "Facebook – 500 / 500 / 500", reward_amount: 0, gift: null, status: "approved", created_at: ts(-8), data: { platform: "facebook", likes: 500, shares: 500, subscribes: 500 } },
  ];

  const course_modules: CourseModule[] = [];
  for (const c of courses) (MODULES[c.id] ?? []).forEach(([name, total_videos], k) => course_modules.push({ id: `cm-${c.id}-${k + 1}`, course_id: c.id, seq: k + 1, name, total_videos }));
  const module_progress: ModuleProgress[] = [];
  const assessments: Assessment[] = [];
  students.forEach((s, i) => {
    const mods = course_modules.filter((m) => m.course_id === s.course_id);
    const done = Math.min(mods.length, 2 + ((i * 3) % mods.length));
    mods.forEach((m, k) => {
      if (k > done) return;
      const videos = k < done ? m.total_videos : Math.round(m.total_videos * r());
      const max = k < 5 ? 50 : 40;
      const score = k < done ? Math.round(max * (0.7 + r() * 0.28)) : null;
      module_progress.push({ student_id: s.id, module_id: m.id, videos_done: videos, test_score: score, test_max: score === null ? null : max, updated_at: ts(-(done - k)) });
      if (score !== null && k >= done - 3) assessments.push({ id: `as-${s.id}-${k}`, student_id: s.id, module_id: m.id, title: `Module test — ${m.name}`, marks: score, max_marks: max, taken_on: addDays(today, -(done - k) * 3) });
    });
  });

  const terms: TermsDoc[] = [
    { id: "t-place-1", kind: "placement", version: 1, title: "MasterVLSI Placement Terms & Conditions", items: DEFAULT_PLACEMENT_TERMS, active: true, created_at: ts(-60) },
    { id: "t-gen-1", kind: "general", version: 1, title: "MasterVLSI Terms & Conditions", items: DEFAULT_GENERAL_TERMS, active: true, created_at: ts(-60) },
  ];
  const consents: Consent[] = students.slice(0, 3).flatMap((s, k) => [
    { id: `cs-p-${s.id}`, consent_no: `MVL-PC-2026-${String(k + 1).padStart(5, "0")}`, student_id: s.id, kind: "placement", version: 1, accepted_at: ts(-20 + k), user_agent: "demo" },
    { id: `cs-g-${s.id}`, consent_no: `MVL-TC-2026-${String(k + 1).padStart(5, "0")}`, student_id: s.id, kind: "general", version: 1, accepted_at: ts(-30 + k), user_agent: "demo" },
  ]);

  return {
    branches, colleges, tpo_contacts, mous, campus_drives, clients, projects, timesheets, invoices, leads, lead_activities,
    hr_contacts, hr_company_history, hr_calls, ambassador_activities, course_modules, module_progress, assessments, terms, consents, alerts: [],
    assignments: [
      { id: "asg-1", course_id: "c-dv", batch_id: null, module_id: "cm-c-dv-3", title: "SV: constrained-random packet generator", instructions: "Write a class with constraints for a packet (len 4–64, crc valid). Share a GitHub/EDA Playground link.", due_date: addDays(today, 3), max_marks: 10, created_at: ts(-4) },
      { id: "asg-2", course_id: "c-dv", batch_id: null, module_id: "cm-c-dv-4", title: "UVM: APB agent (driver + monitor)", instructions: "Build an APB agent and a simple test.", due_date: addDays(today, 10), max_marks: 20, created_at: ts(-1) },
      { id: "asg-3", course_id: "c-pd", batch_id: null, module_id: null, title: "Floorplan a 2-macro block", instructions: "Upload screenshots + utilisation report.", due_date: addDays(today, 5), max_marks: 10, created_at: ts(-2) },
    ],
    assignment_submissions: students.filter((s) => s.course_id === "c-dv").slice(0, 4).map((s, k) => ({
      id: `sub-${k}`, assignment_id: "asg-1", student_id: s.id, link: `https://edaplayground.example/x/${k}`, note: null, submitted_at: ts(-1 - k),
      marks: k < 2 ? 8 + k : null, feedback: k < 2 ? "Good constraints; add coverage next time." : null, status: (k < 2 ? "graded" : "submitted") as Submission["status"],
    })),
    college_logins: [],
    tpo_interactions: [
      { id: "ti-1", tpo_id: "tpo-1", on_date: addDays(today, -4), mode: "call", summary: "Discussed next DV campus drive and 2026 batch strength.", next_follow_up: addDays(today, 3), by_name: "Sowmya Rao", created_at: ts(-4) },
      { id: "ti-2", tpo_id: "tpo-1", on_date: addDays(today, -18), mode: "visit", summary: "Visited campus; seminar for 3rd-year ECE students.", next_follow_up: null, by_name: "Rakesh Kumar", created_at: ts(-18) },
      { id: "ti-3", tpo_id: "tpo-3", on_date: addDays(today, -20), mode: "email", summary: "Shared MoU renewal draft.", next_follow_up: addDays(today, 1), by_name: "Sowmya Rao", created_at: ts(-20) },
    ],
    alert_contacts: [
      { id: "ac-1", role_name: "Finance", name: "Accounts desk", email: "accounts@mastervlsi.example", phone: "9900000201" },
      { id: "ac-2", role_name: "Admin / Manager", name: "Operations manager", email: "ops@mastervlsi.example", phone: "9900000202" },
      { id: "ac-3", role_name: "Director", name: "Director", email: "director@mastervlsi.example", phone: "9900000203" },
    ],
    project_milestones: [
      { id: "ms-1", project_id: "pr-1", title: "Testbench architecture sign-off", due_date: addDays(today, -20), done: true, done_on: addDays(today, -21) },
      { id: "ms-2", project_id: "pr-1", title: "Coverage closure 80%", due_date: addDays(today, -3), done: false, done_on: null },
      { id: "ms-3", project_id: "pr-1", title: "Regression sign-off", due_date: addDays(today, 40), done: false, done_on: null },
    ],
    staff_appraisals: [
      { id: "ap-1", staff_id: "st-1", period: "FY 2025-26", rating: 4, increment_pct: 10, comments: "Strong DV delivery; mentor more juniors.", created_at: ts(-60) },
    ],
    company_profiles: [
      { company: "mastervlsi", legal_name: "MasterVLSI Training Institute", address: "Hyderabad, Telangana", gstin: "36AAAAA0000A1Z5", pan: "AAAAA0000A", bank_name: "HDFC Bank", bank_account: "XXXXXX1234", bank_ifsc: "HDFC0000001", email: "accounts@mastervlsi.example", phone: "9900000300" },
      { company: "enrich", legal_name: "Enrich Silicon Pvt. Ltd.", address: "Bengaluru, Karnataka", gstin: "29BBBBB1111B1Z6", pan: "BBBBB1111B", bank_name: "ICICI Bank", bank_account: "XXXXXX5678", bank_ifsc: "ICIC0000002", email: "billing@enrichsilicon.example", phone: "9900000301" },
    ],
    audit_log: [],
  };
}
