import { addDays } from "../format";
import type { MasterOption, Student, StudentApplication, StudentNote } from "../types";

export interface ProfileTables {
  master_options: MasterOption[];
  student_applications: StudentApplication[];
  student_notes: StudentNote[];
}

/** Same defaults as the migration, so dropdowns look identical in demo and live. */
export const DEFAULT_OPTIONS: [MasterOption["category"], string[]][] = [
  ["board", ["CBSE", "ICSE", "State Board (Karnataka)", "State Board (AP)", "State Board (Telangana)", "State Board (Tamil Nadu)", "State Board (Kerala)", "State Board (Maharashtra)", "NIOS"]],
  ["university", ["VTU", "JNTU Hyderabad", "JNTU Anantapur", "JNTU Kakinada", "Anna University", "Osmania University", "Andhra University", "Autonomous / Deemed"]],
  ["stream", ["Science (PCM)", "Science (PCB)", "Commerce", "ECE", "EEE", "EIE", "CSE", "VLSI Design", "Embedded Systems"]],
  ["contact_position", ["TPO", "HOD", "Principal", "Faculty"]],
  ["validity_months", ["3", "6", "9", "12"]],
  ["designation", ["Design Engineer", "DV Engineer", "Physical Design Engineer", "Graduate Engineer Trainee"]],
];

export function buildProfileSeed(today: string, students: Student[]): ProfileTables {
  const master_options: MasterOption[] = DEFAULT_OPTIONS.flatMap(([category, values]) => values.map((value, i) => ({ id: `mo-${category}-${i}`, category, value, sort: i + 1 })));
  const s1 = students[0]?.id, s2 = students[1]?.id;
  const student_applications: StudentApplication[] = s1
    ? [
        { id: "app-1", student_id: s1, company: "Intel", role: "DV Engineer", applied_on: addDays(today, -30), rounds: 3, status: "rejected", created_at: addDays(today, -30) + "T09:00:00Z" },
        { id: "app-2", student_id: s1, company: "HCL", role: "VLSI Engineer", applied_on: addDays(today, -20), rounds: 2, status: "in_process", created_at: addDays(today, -20) + "T09:00:00Z" },
        { id: "app-3", student_id: s1, company: "Qualcomm", role: "Design Verification Engineer", applied_on: addDays(today, -12), rounds: 3, status: "shortlisted", created_at: addDays(today, -12) + "T09:00:00Z" },
        ...(s2 ? [{ id: "app-4", student_id: s2, company: "Meta", role: "Design Verification Engineer", applied_on: addDays(today, -40), rounds: 4, status: "placed" as const, package: "50 LPA", doj: addDays(today, 14), hr_name: "John Mathew", hr_email: "john.mathew@example.com", job_location: "Bengaluru", created_at: addDays(today, -40) + "T09:00:00Z" }] : []),
      ]
    : [];
  const student_notes: StudentNote[] = s1 ? [{ id: "note-1", student_id: s1, note: "Counselled on DV track; strong in SystemVerilog basics.", by_name: "Admin", created_at: addDays(today, -15) + "T10:00:00Z" }] : [];
  return { master_options, student_applications, student_notes };
}
