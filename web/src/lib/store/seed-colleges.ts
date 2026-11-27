import type { Student } from "../types";
import type { CollegeActivity, CollegeDocument, CollegeEvent, CollegeFeedback, CollegeFinance, CollegeOpportunity, CollegeReference, CollegeSubmission } from "../types-colleges";

export interface CollegeTables {
  college_activities: CollegeActivity[];
  college_submissions: CollegeSubmission[];
  college_references: CollegeReference[];
  college_opportunities: CollegeOpportunity[];
  college_events: CollegeEvent[];
  college_feedback: CollegeFeedback[];
  college_finance: CollegeFinance[];
  college_documents: CollegeDocument[];
}

const shift = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function buildCollegeSeed(today: string, students: Student[]): CollegeTables {
  const at = (d: number) => shift(today, d) + "T06:00:00Z";
  const s1 = students[0];
  return {
    college_activities: [
      { id: "ca-1", college_id: "col-atme", kind: "meeting", summary: "Reviewed MoU progress with the TPO; agreed on a DV seminar.", outcome: "mou_signed", by_name: "Rakesh Kumar", created_at: at(-4) },
      { id: "ca-2", college_id: "col-pes", kind: "proposal", summary: "Sent the training + placement proposal to the Dean.", outcome: "proposal_sent", by_name: "Rakesh Kumar", created_at: at(-6) },
      { id: "ca-3", college_id: "col-jntu", kind: "call", summary: "HOD ECE interested in a VLSI value-added course.", outcome: "interested", by_name: "Sowmya Rao", created_at: at(-2) },
    ],
    college_submissions: [
      { id: "cs-1", college_name: "ATME College of Engineering", city: "Mysuru", state: "Karnataka", contact_name: "Prof. Kavitha N", designation: "HOD", department: "ECE", phone: "9000000017", email: null, source: "student", submitted_by: s1?.full_name ?? "Student", status: "pending", created_at: at(-1) },
      { id: "cs-2", college_name: "Vidyavardhaka College of Engineering", city: "Mysuru", state: "Karnataka", contact_name: "Mr. Harish", designation: "TPO", department: null, phone: "9000000018", email: "tpo@vvce.example", source: "public_form", submitted_by: null, status: "pending", created_at: at(0) },
    ],
    college_references: [
      ...(s1 ? [{ id: "cr-1", college_id: "col-atme", student_id: s1.id, person_name: s1.full_name, person_type: "active_student" as const, department: "ECE", batch: "2027", reference_to: "TPO", phone: s1.phone ?? null }] : []),
      { id: "cr-2", college_id: "col-atme", student_id: null, person_name: "Alumni B", person_type: "placed_alumni", department: "ECE", batch: "2024", reference_to: "HOD", phone: null },
      { id: "cr-3", college_id: "col-sit", student_id: null, person_name: "Alumni C", person_type: "alumni", department: "EEE", batch: "2025", reference_to: "Faculty", phone: null },
    ],
    college_opportunities: [
      { id: "co-1", college_id: "col-atme", kind: "Seminar / workshop", title: "DV seminar for 3rd year ECE", students: 180, value: 0, expected_date: shift(today, 14), status: "proposed", owner: "Rakesh Kumar" },
      { id: "co-2", college_id: "col-pes", kind: "Training", title: "Semester VLSI training (60 students)", students: 60, value: 900000, expected_date: shift(today, 30), status: "open", owner: "Rakesh Kumar" },
    ],
    college_events: [
      { id: "ce-1", college_id: "col-atme", kind: "seminar", title: "Careers in VLSI Design Verification", event_date: shift(today, -20), speaker: "Rakesh Kumar", attendees: 220, leads_generated: 35, status: "done" },
      { id: "ce-2", college_id: "col-bms", kind: "workshop", title: "Hands-on SystemVerilog workshop", event_date: shift(today, 10), speaker: "Imran Sheikh", attendees: 0, leads_generated: 0, status: "planned" },
    ],
    college_feedback: [{ id: "cf-1", college_id: "col-atme", given_by: "Dr. Manjunath R (TPO)", rating: 5, comments: "Seminar was very well received by students.", on_date: shift(today, -18) }],
    college_finance: [
      { id: "cfin-1", college_id: "col-atme", description: "Semester training fee — batch 1", amount: 450000, kind: "invoice", due_date: shift(today, -10), reference: "MV-COL-INV-001" },
      { id: "cfin-2", college_id: "col-atme", description: "Payment against MV-COL-INV-001", amount: 300000, kind: "payment", paid_on: shift(today, -5), reference: "NEFT-ATME-55" },
    ],
    college_documents: [{ id: "cd-1", college_id: "col-atme", title: "Signed MoU (scan)", kind: "mou", url: "https://example.com/atme-mou.pdf", uploaded_by: "Demo Admin", created_at: at(-60) }],
  };
}
