import type { LetterTemplate } from "./types";

export interface TemplateMeta {
  id: LetterTemplate;
  title: string;
  audience: "student" | "staff";
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
}

export const TEMPLATES: TemplateMeta[] = [
  { id: "admission_confirmation", title: "Admission Confirmation Letter", audience: "student", fields: [] },
  { id: "student_id_card", title: "Student ID Card", audience: "student", fields: [] },
  { id: "visiting_card", title: "Visiting Card", audience: "student", fields: [{ key: "designation", label: "Designation", placeholder: "VLSI Trainee" }] },
  {
    id: "internship_offer",
    title: "Internship Offer Letter",
    audience: "student",
    fields: [
      { key: "role", label: "Internship role", placeholder: "Design Verification Intern" },
      { key: "department", label: "Department", placeholder: "Technology" },
      { key: "start", label: "Start date", type: "date" },
      { key: "end", label: "End date", type: "date" },
    ],
  },
  {
    id: "internship_completion",
    title: "Internship Completion Letter",
    audience: "student",
    fields: [
      { key: "role", label: "Internship role", placeholder: "Design Verification Intern" },
      { key: "start", label: "Start date", type: "date" },
      { key: "end", label: "End date", type: "date" },
    ],
  },
  { id: "training_certificate", title: "Training Completion Certificate", audience: "student", fields: [{ key: "grade", label: "Grade", placeholder: "A" }] },
  {
    id: "placement_confirmation",
    title: "Placement Confirmation Letter",
    audience: "student",
    fields: [
      { key: "company", label: "Company", placeholder: "Qualcomm" },
      { key: "role", label: "Role", placeholder: "Design Verification Engineer" },
      { key: "ctc", label: "CTC", placeholder: "12 LPA" },
      { key: "joining", label: "Joining date", type: "date" },
    ],
  },
  {
    id: "staff_offer",
    title: "Offer Letter",
    audience: "staff",
    fields: [
      { key: "position", label: "Position" },
      { key: "joining", label: "Joining date", type: "date" },
      { key: "ctc", label: "Annual CTC", placeholder: "₹9,60,000" },
    ],
  },
  {
    id: "payslip",
    title: "Payslip",
    audience: "staff",
    fields: [
      { key: "month", label: "Month", type: "month" },
      { key: "basic", label: "Basic", type: "number" },
      { key: "hra", label: "HRA", type: "number" },
      { key: "allowances", label: "Other allowances", type: "number" },
      { key: "pf", label: "PF deduction", type: "number" },
      { key: "tax", label: "Professional tax", type: "number" },
    ],
  },
  { id: "service_agreement", title: "Service Agreement", audience: "staff", fields: [{ key: "term", label: "Term", placeholder: "24 months" }] },
  { id: "experience_letter", title: "Experience Letter", audience: "staff", fields: [{ key: "relieving", label: "Relieving date", type: "date" }] },
];

export const templateMeta = (id: string) => TEMPLATES.find((t) => t.id === id);
