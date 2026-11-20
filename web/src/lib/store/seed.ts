import { addDays, todayISO } from "../format";
import type {
  AccessRow,
  Allocation,
  AttendanceRecord,
  Batch,
  Course,
  Drive,
  DriveResponse,
  Education,
  Installment,
  Letter,
  Payment,
  Staff,
  Student,
  StudentStatus,
  TrainingMode,
  Vendor,
} from "../types";
import { CHANNELS } from "../types";

/** Deterministic PRNG so demo data is stable across reloads. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoTables {
  courses: Course[];
  batches: Batch[];
  vendors: Vendor[];
  students: Student[];
  student_education: Education[];
  student_documents: { id: string; student_id: string; kind: string; storage_path: string; verified: boolean }[];
  student_access: AccessRow[];
  access_events: { id: number; student_id: string; action: string; reason?: string | null; created_at: string }[];
  attendance_records: AttendanceRecord[];
  fee_allocations: Allocation[];
  installments: Installment[];
  payments: Payment[];
  notifications: { id: number; student_id: string; kind: string; channel: string; sent_at?: string | null; created_at: string }[];
  placement_drives: Drive[];
  drive_responses: DriveResponse[];
  staff: Staff[];
  issued_letters: Letter[];
}

const NAMES: [string, string, string][] = [
  ["Manthu Mahalakshmi", "F", "Nellore"],
  ["Adarsh Hullur", "M", "Hubballi"],
  ["Suzain Khan", "M", "Hyderabad"],
  ["Darshan K", "M", "Mysuru"],
  ["Neha G S", "F", "Bengaluru"],
  ["Priya Sharma", "F", "Jaipur"],
  ["Rahul Verma", "M", "Lucknow"],
  ["Ananya Iyer", "F", "Chennai"],
  ["Vikram Reddy", "M", "Warangal"],
  ["Sneha Patil", "F", "Pune"],
  ["Karthik Nair", "M", "Kochi"],
  ["Divya Menon", "F", "Thrissur"],
  ["Arjun Rao", "M", "Vijayawada"],
  ["Pooja Desai", "F", "Surat"],
  ["Mohammed Faiz", "M", "Kozhikode"],
  ["Lakshmi Prasanna", "F", "Guntur"],
  ["Sai Teja", "M", "Tirupati"],
  ["Harshitha B", "F", "Davanagere"],
  ["Rohit Kulkarni", "M", "Belagavi"],
  ["Meghana R", "F", "Mangaluru"],
  ["Abhishek Singh", "M", "Patna"],
  ["Keerthi Varma", "F", "Kakinada"],
  ["Nikhil Joshi", "M", "Nagpur"],
  ["Bhavana S", "F", "Tumakuru"],
];

const COLLEGES = [
  "Sri Venkateswara University",
  "JNTU Anantapur",
  "PES University",
  "RV College of Engineering",
  "VIT Vellore",
  "BMS College of Engineering",
  "NIT Warangal",
  "Manipal Institute of Technology",
];

export function buildSeed(): DemoTables {
  const r = rng(20261121);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const today = todayISO();
  let auto = 1;

  const courses: Course[] = [
    { id: "c-dv", code: "DV", name: "ASIC Design Verification (SV + UVM)", duration_months: 6, validity_months: 12, fee: 30000 },
    { id: "c-pd", code: "PD", name: "Physical Design (RTL to GDSII)", duration_months: 6, validity_months: 12, fee: 35000 },
    { id: "c-dft", code: "DFT", name: "Design for Testability", duration_months: 5, validity_months: 10, fee: 28000 },
    { id: "c-al", code: "AL", name: "Analog Layout", duration_months: 4, validity_months: 9, fee: 25000 },
  ];
  const batches: Batch[] = [
    { id: "b-dv-jan", course_id: "c-dv", name: "DV-Online-Jan26", mode: "online", start_date: addDays(today, -60) },
    { id: "b-dv-oct", course_id: "c-dv", name: "DV-Hybrid-Oct25", mode: "hybrid", start_date: addDays(today, -140) },
    { id: "b-pd-nov", course_id: "c-pd", name: "PD-Offline-Nov25", mode: "offline", start_date: addDays(today, -110) },
    { id: "b-dft-sep", course_id: "c-dft", name: "DFT-Hybrid-Sep25", mode: "hybrid", start_date: addDays(today, -200) },
    { id: "b-al-aug", course_id: "c-al", name: "AL-Online-Aug25", mode: "online", start_date: addDays(today, -240) },
  ];
  const vendors: Vendor[] = [
    { id: "v1", name: "SkillEdge Partners", contact_person: "Ramesh Gowda", phone: "9845012345", email: "accounts@skilledge.example" },
    { id: "v2", name: "TechBridge Services", contact_person: "Farah Ali", phone: "9900112233", email: "billing@techbridge.example" },
    { id: "sv1", parent_id: "v1", name: "Raj Associates", contact_person: "Raj Kumar", phone: "9886001100" },
    { id: "sv2", parent_id: "v1", name: "Sai Consultancy", contact_person: "Sai Krishna", phone: "9886002200" },
    { id: "sv3", parent_id: "v2", name: "Kiran Ventures", contact_person: "Kiran B", phone: "9886003300" },
  ];

  const students: Student[] = [];
  const education: Education[] = [];
  const access: AccessRow[] = [];
  const attendance: AttendanceRecord[] = [];
  const allocations: Allocation[] = [];
  const installments: Installment[] = [];
  const payments: Payment[] = [];
  const docs: DemoTables["student_documents"] = [];

  // validity offsets chosen so the expiry pipeline has something at each stage
  const validityOffsets = [210, 30, 15, 7, 1, 120, 25, 180, 300, -3, 60, 12, 95, 240, 45, 160, 5, 75, 200, 28, 140, 330, 20, 100];

  NAMES.forEach(([name, gender, city], i) => {
    const batch = batches[i % batches.length];
    const course = courses.find((c) => c.id === batch.course_id)!;
    const id = `s-${String(i + 1).padStart(3, "0")}`;
    const status: StudentStatus =
      i === 6 || i === 13 ? "on_hold" : validityOffsets[i] < 0 ? "expired" : i === 21 ? "completed" : "active";
    const admission = addDays(today, -Math.floor(40 + r() * 200));
    const validity = addDays(today, validityOffsets[i]);
    const first = name.split(" ")[0].toLowerCase();
    const mode: TrainingMode = batch.mode;

    students.push({
      id,
      enrollment_no: `MVL${String(2026001 + i)}`,
      status,
      full_name: name,
      dob: `${1997 + (i % 6)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
      gender: gender === "F" ? "Female" : "Male",
      marital_status: i % 5 === 0 ? "Married" : "Single",
      blood_group: pick(["O+", "B+", "A+", "AB+", "O-"]),
      nationality: "Indian",
      languages: ["English", "Hindi", pick(["Telugu", "Kannada", "Tamil", "Malayalam", "Marathi"])],
      native_place: city,
      phone: `9${String(800000000 + i * 7919123).slice(0, 9)}`,
      alt_phone: `8${String(700000000 + i * 3571).slice(0, 9)}`,
      email: `${first}${i + 1}@gmail.example`,
      linkedin: `linkedin.com/in/${first}-${i + 1}`,
      address: { line: `${10 + i}, ${pick(["MG Road", "Gandhi Nagar", "Kothapet", "Jayanagar", "Indiranagar"])}`, city, district: city, state: pick(["Andhra Pradesh", "Karnataka", "Telangana", "Tamil Nadu", "Kerala", "Maharashtra"]), pincode: String(500000 + i * 137) },
      family: {
        father_name: `${pick(["Venkata", "Suresh", "Ramesh", "Prakash", "Mahesh"])} ${name.split(" ").at(-1)}`,
        father_occupation: pick(["Farmer", "Business", "Teacher", "Government Service", "Retired"]),
        father_phone: `97${String(10000000 + i * 4111).slice(0, 8)}`,
        mother_name: `${pick(["Lakshmi", "Saraswati", "Padma", "Kavitha", "Usha"])} ${name.split(" ").at(-1)}`,
        mother_occupation: "Homemaker",
        mother_phone: `96${String(10000000 + i * 5333).slice(0, 8)}`,
      },
      spouse: i % 5 === 0 ? { name: pick(["Rakesh Kumar", "Sunita Rao"]), occupation: "Software Engineer", phone: "9845000000" } : {},
      emergency: { name: "Parent", relation: "Father", phone: `97${String(10000000 + i * 4111).slice(0, 8)}` },
      professional: {
        working_status: i % 3 === 0 ? "Working" : "Fresher",
        company: i % 3 === 0 ? pick(["Infosys", "Wipro", "Tech Mahindra", "Cognizant"]) : undefined,
        total_exp: i % 3 === 0 ? `${1 + (i % 4)} yrs` : "0",
        relevant_exp: i % 3 === 0 ? `${i % 2} yrs` : "0",
        current_ctc: i % 3 === 0 ? `${3 + (i % 4)} LPA` : undefined,
        expected_ctc: `${6 + (i % 5)} LPA`,
        notice_period: i % 3 === 0 ? "30 days" : "Immediate",
        preferred_location: pick(["Bengaluru", "Hyderabad", "Noida", "Any"]),
        relocate: r() > 0.2,
        interview_mode: pick(["Online", "Offline", "Both"]),
      },
      course_id: course.id,
      batch_id: batch.id,
      training_mode: mode,
      admission_date: admission,
      validity_end: validity,
      total_fee: course.fee,
      payment_plan: "Installments",
      referred_by: i % 4 === 0 ? pick(NAMES)[0] : null,
      lead_source: pick(["Website", "Google", "Instagram", "Referral", "LinkedIn", "Walk-in"]),
      placement_consent: r() > 0.15,
      placement_eligible: r() > 0.25,
      created_at: admission + "T09:00:00Z",
    });

    education.push(
      { id: `e-${id}-1`, student_id: id, level: "10th", institution: `${city} High School`, board: "State Board", stream: "General", year_of_passing: 2013 + (i % 5), score: `${(8 + r() * 2).toFixed(1)} CGPA`, location: city },
      { id: `e-${id}-2`, student_id: id, level: "12th / Diploma", institution: `${city} Junior College`, board: "State Board", stream: "MPC", year_of_passing: 2015 + (i % 5), score: `${Math.round(75 + r() * 22)}%`, location: city },
      { id: `e-${id}-3`, student_id: id, level: "B.Tech / B.E", institution: pick(COLLEGES), board: "University", stream: pick(["ECE", "EEE", "EIE"]), year_of_passing: 2019 + (i % 5), score: `${(6.5 + r() * 3).toFixed(1)} CGPA`, location: city },
    );
    if (i % 4 === 0)
      education.push({ id: `e-${id}-4`, student_id: id, level: "M.Tech", institution: pick(COLLEGES), board: "University", stream: "VLSI Design", year_of_passing: 2023 + (i % 3), score: `${(7 + r() * 2.5).toFixed(1)} CGPA`, location: city });

    for (const ch of CHANNELS)
      access.push({
        student_id: id,
        channel: ch,
        enabled: status === "active",
        external_ref: ch === "zoom" ? `${first}${i + 1}@gmail.example` : ch === "biometric" ? `MVL${2026001 + i}` : ch === "teamviewer" ? `TV-${100200 + i}` : null,
      });

    docs.push(
      { id: `d-${id}-1`, student_id: id, kind: "resume", storage_path: `${id}/resume.pdf`, verified: true },
      { id: `d-${id}-2`, student_id: id, kind: "photo", storage_path: `${id}/photo.jpg`, verified: true },
      { id: `d-${id}-3`, student_id: id, kind: "id_proof", storage_path: `${id}/aadhaar.pdf`, verified: i % 3 !== 0 },
    );

    // attendance: last 30 days, no Sundays; regularity varies per student
    const regularity = i % 6 === 2 ? 0.55 : 0.75 + r() * 0.23;
    const holdFrom = status === "active" ? 0 : status === "on_hold" ? 9 : 31;
    for (let d = 30; d >= 1; d--) {
      const day = addDays(today, -d);
      if (new Date(day + "T00:00:00Z").getUTCDay() === 0) continue;
      if (d < holdFrom || status === "expired" || status === "completed") continue;
      if (r() > regularity) continue;
      const source =
        mode === "offline" ? "biometric" : mode === "online" ? (r() < 0.8 ? "zoom" : "teamviewer") : pick(["zoom", "biometric", "teamviewer"] as const);
      const start = source === "biometric" ? "04:00" : "13:30";
      const dur = source === "teamviewer" ? Math.round(40 + r() * 80) : Math.round(110 + r() * 70);
      const checkIn = `${day}T${start}:00Z`;
      attendance.push({
        id: auto++,
        student_id: id,
        source,
        session_date: day,
        check_in: checkIn,
        check_out: new Date(Date.parse(checkIn) + dur * 60000).toISOString(),
        duration_minutes: dur,
        external_ref: source === "zoom" ? `zm-${day}` : source === "biometric" ? "BIO-HYD-01" : `rec-${day}`,
      });
    }

    // fee split: 2/3 to vendor 1 (3 installments via sub-vendors), 1/3 to vendor 2 (2 installments)
    const v1Amt = Math.round((course.fee * 2) / 3 / 1000) * 1000;
    const v2Amt = course.fee - v1Amt;
    const plan: [string, number, string[], number][] = [
      ["v1", v1Amt, ["sv1", "sv2", "sv1"], 3],
      ["v2", v2Amt, ["sv3", "sv3"], 2],
    ];
    const paidUpTo = status === "completed" ? 5 : Math.floor(r() * 6); // number of installments already paid overall
    let instIndex = 0;
    for (const [vid, amt, subs, n] of plan) {
      const alloc: Allocation = { id: `a-${id}-${vid}`, student_id: id, vendor_id: vid, amount: amt };
      allocations.push(alloc);
      const per = Math.round(amt / n);
      for (let k = 0; k < n; k++) {
        const amount = k === n - 1 ? amt - per * (n - 1) : per;
        const due = addDays(admission, 30 * k + (vid === "v2" ? 10 : 0));
        const paid = instIndex < paidUpTo;
        const partial = !paid && instIndex === paidUpTo && r() > 0.6;
        const paidAmount = paid ? amount : partial ? Math.round(amount / 2) : 0;
        const inst: Installment = {
          id: `i-${id}-${vid}-${k + 1}`,
          allocation_id: alloc.id,
          student_id: id,
          sub_vendor_id: subs[k],
          seq: k + 1,
          due_date: due,
          amount,
          paid_amount: paidAmount,
          status: paid ? "paid" : partial ? "partial" : due < today ? "overdue" : "pending",
        };
        installments.push(inst);
        if (paidAmount > 0)
          payments.push({ id: `p-${inst.id}`, installment_id: inst.id, student_id: id, amount: paidAmount, mode: pick(["UPI", "Bank Transfer", "Card", "Cash"]), reference: `TXN${100000 + auto * 7}`, paid_at: due + "T10:00:00Z" });
        instIndex++;
      }
    }
  });

  const drives: Drive[] = [
    { id: "dr-qcom", company: "Qualcomm", job_role: "Design Verification Engineer", location: "Bengaluru", drive_date: addDays(today, 18), interview_mode: "Online", ctc: "12–18 LPA", eligibility: "B.Tech/M.Tech ECE, 2023–2025, ≥ 65%", status: "open" },
    { id: "dr-wipro", company: "Wipro", job_role: "ASIC Verification Engineer", location: "Bengaluru", drive_date: addDays(today, 24), interview_mode: "Offline", ctc: "6–8 LPA", eligibility: "B.E/B.Tech ECE/EEE", status: "open" },
    { id: "dr-hcl", company: "HCLTech", job_role: "VLSI Engineer", location: "Noida", drive_date: addDays(today, 40), interview_mode: "Online", ctc: "5–7 LPA", eligibility: "Any DV/PD trained", status: "upcoming" },
    { id: "dr-tcs", company: "TCS", job_role: "Physical Design Engineer", location: "Hyderabad", drive_date: addDays(today, -12), interview_mode: "Online", ctc: "5–6.5 LPA", eligibility: "PD batch", status: "closed" },
  ];
  const responses: DriveResponse[] = [];
  for (const s of students) {
    if (!s.placement_consent) continue;
    for (const d of drives) {
      if (d.status === "upcoming") continue;
      const x = r();
      const response = x < 0.55 ? "yes" : x < 0.75 ? "no" : "pending";
      responses.push({
        drive_id: d.id,
        student_id: s.id,
        response,
        stage: response === "yes" ? pick(["Applied", "Applied", "Shortlisted", "Interview", "Offered"]) : null,
        synced_to_sheet: response === "yes" && r() > 0.25,
        synced_at: response === "yes" ? addDays(today, -2) + "T08:00:00Z" : null,
        updated_at: addDays(today, -Math.floor(r() * 10)) + "T08:00:00Z",
      });
    }
  }

  const staff: Staff[] = [
    { id: "st-1", employee_code: "MVE001", full_name: "Rakesh Kumar", designation: "Senior DV Trainer", department: "Training", joining_date: "2023-06-01", monthly_salary: 95000, email: "rakesh@mastervlsi.example", phone: "9900000001" },
    { id: "st-2", employee_code: "MVE002", full_name: "Sowmya Rao", designation: "Placement Coordinator", department: "Placements", joining_date: "2024-02-15", monthly_salary: 55000, email: "sowmya@mastervlsi.example", phone: "9900000002" },
    { id: "st-3", employee_code: "MVE003", full_name: "Imran Sheikh", designation: "PD Trainer", department: "Training", joining_date: "2024-09-01", monthly_salary: 85000, email: "imran@mastervlsi.example", phone: "9900000003" },
  ];

  const letters: Letter[] = [
    { id: "l-1", serial_no: "MV-ADM-2026-0001", template: "admission_confirmation", student_id: "s-001", data: {}, issued_at: addDays(today, -50) + "T10:00:00Z", revoked: false },
    { id: "l-2", serial_no: "MV-CRT-2026-0001", template: "training_certificate", student_id: "s-022", data: {}, issued_at: addDays(today, -5) + "T10:00:00Z", revoked: false },
    { id: "l-3", serial_no: "MV-INO-2026-0001", template: "internship_offer", student_id: "s-002", data: { role: "DV Intern", start: addDays(today, 7) }, issued_at: addDays(today, -1) + "T10:00:00Z", revoked: false },
  ];

  const events: DemoTables["access_events"] = students
    .filter((s) => s.status === "on_hold")
    .map((s, k) => ({ id: k + 1, student_id: s.id, action: "hold", reason: "Fee installment overdue", created_at: addDays(today, -9) + "T07:00:00Z" }));

  return {
    courses,
    batches,
    vendors,
    students,
    student_education: education,
    student_documents: docs,
    student_access: access,
    access_events: events,
    attendance_records: attendance,
    fee_allocations: allocations,
    installments,
    payments,
    notifications: [],
    placement_drives: drives,
    drive_responses: responses,
    staff,
    issued_letters: letters,
  };
}
