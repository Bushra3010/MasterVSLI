import type { Drive } from "../types";
import type { HrActivity, HrDriveTask, HrFeedback, HrRequirement, HrSubmission } from "../types-hr";
import { sequenceFor } from "../hr-drives";

export interface HrTables {
  hr_activities: HrActivity[];
  hr_requirements: HrRequirement[];
  hr_drive_tasks: HrDriveTask[];
  hr_submissions: HrSubmission[];
  hr_feedback: HrFeedback[];
}

const shift = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function buildHrSeed(today: string, drives: Drive[]): HrTables {
  const at = (d: number) => shift(today, d) + "T06:00:00Z";
  return {
    hr_activities: [
      { id: "ha-1", hr_id: "hr-1", kind: "stage", summary: "Moved to Active hiring", outcome: "active_hiring", by_name: "Rakesh Kumar", created_at: at(-4) },
      { id: "ha-2", hr_id: "hr-1", kind: "allocation", summary: "Allocated to Rakesh Kumar", by_name: "Demo Admin", created_at: at(-30) },
      { id: "ha-3", hr_id: "hr-2", kind: "note", summary: "HR added — introduced by Sowmya Rao", by_name: "Demo Admin", created_at: at(-60) },
      { id: "ha-4", hr_id: "hr-3", kind: "stage", summary: "Moved to Rapport building", outcome: "rapport_building", by_name: "Sowmya Rao", created_at: at(-9) },
    ],
    hr_requirements: [
      { id: "hq-1", hr_id: "hr-1", company: "Qualcomm", role: "ASIC Design Verification", vacancies: 20, expected_period: "December", expected_date: shift(today, 20), qualification: "BE / B.Tech / M.Tech", branches: "ECE / EEE", package: "₹6 LPA", experience: "Freshers", location: "Bengaluru", assigned_to: "Rakesh Kumar", status: "confirmed", created_by: "Rakesh Kumar", created_at: at(-5) },
      { id: "hq-2", hr_id: "hr-2", company: "TechVision Solutions", role: "IP Verification", vacancies: 15, expected_period: "December", expected_date: shift(today, 28), qualification: "BE / B.Tech", branches: "ECE", package: "₹5.5 LPA", experience: "Freshers", location: "Hyderabad", assigned_to: "Sowmya Rao", status: "tentative", created_by: "Sowmya Rao", created_at: at(-3) },
      { id: "hq-3", hr_id: "hr-3", company: "Global Infotech Ltd.", role: "SoC Verification", vacancies: 25, expected_period: "January", expected_date: shift(today, 45), qualification: "M.Tech", branches: "ECE / VLSI", package: "₹7 LPA", experience: "0–1 yr", location: "Bengaluru", assigned_to: "Sowmya Rao", status: "pending", created_by: "Sowmya Rao", created_at: at(-1) },
    ],
    hr_drive_tasks: driveTasks(drives),
    hr_submissions: drives[0]
      ? [{ id: "hs-1", drive_id: drives[0].id, hr_id: "hr-1", recipient_email: "priya.sharma@qualcomm.example", student_count: 18, file_name: "ABC_Interested_Students.xlsx", scheduled_at: at(2), status: "awaiting_approval", prepared_by: "Rakesh Kumar", created_at: at(-1) }]
      : [],
    hr_feedback: [
      { id: "hfb-1", hr_id: "hr-1", company: "Qualcomm", feedback: "Strong UVM knowledge across the shortlisted students.", sentiment: "positive", action: "Maintain the current training quality", assigned_to: "Rakesh Kumar", status: "closed", closed_by: "Rakesh Kumar", closed_at: at(-6), created_by: "Rakesh Kumar", created_at: at(-8) },
      { id: "hfb-2", hr_id: "hr-3", company: "Global Infotech Ltd.", feedback: "Two students did not turn up for the interview.", sentiment: "concern", action: "Review attendance and brief the batch", assigned_to: "Sowmya Rao", due_on: shift(today, 3), status: "open", created_by: "Sowmya Rao", created_at: at(-2) },
      { id: "hfb-3", hr_id: "hr-2", company: "TechVision Solutions", feedback: "Resume formatting needs to match the company template.", sentiment: "neutral", action: "Update the resume format", assigned_to: "Imran Sheikh", due_on: shift(today, 7), status: "in_progress", created_by: "Sowmya Rao", created_at: at(-3) },
    ],
  };
}

/** The reminder sequence for whichever seeded drives have an HR attached. */
function driveTasks(drives: Drive[]): HrDriveTask[] {
  const out: HrDriveTask[] = [];
  for (const d of drives.filter((x) => x.hr_id)) {
    sequenceFor(d).forEach((t, i) => {
      out.push({ ...t, id: `hdt-${d.id}-${t.step}`, status: i === 0 ? "done" : "pending", completed_by: i === 0 ? t.assigned_to ?? null : null, created_at: new Date().toISOString() });
    });
  }
  return out;
}
