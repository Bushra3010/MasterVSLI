import type { Student } from "../types";
import { DEFAULT_REWARD_SETTINGS, type Goodie, type RewardProgram, type RewardSetting } from "../types-rewards";

export interface RewardTables {
  reward_settings: RewardSetting[];
  reward_program: RewardProgram[];
  reward_goodies: Goodie[];
}

export function buildRewardSeed(today: string, students: Student[]): RewardTables {
  const s1 = students[0]?.id;
  return {
    reward_settings: DEFAULT_REWARD_SETTINGS.map((r) => ({ ...r })),
    reward_program: [{ id: 1, academic_year: "2026 / 2027", valid_from: "2026-06-01", valid_to: "2027-05-31", branch_id: null }],
    reward_goodies: s1
      ? [
          { id: "gd-1", student_id: s1, source: "social_media", ref: "2026 / 2027", reason: "10,000 social media activities", status: "collected", earned_at: today + "T05:00:00Z", collected_at: today + "T06:00:00Z" },
          { id: "gd-2", student_id: s1, source: "institute_feedback", ref: "block-0", reason: "Google review hamper", status: "collected", earned_at: today + "T05:00:00Z", collected_at: today + "T06:00:00Z" },
          { id: "gd-3", student_id: s1, source: "incident", ref: "demo", reason: "Incident report verified", status: "earned", earned_at: today + "T05:00:00Z" },
        ]
      : [],
  };
}
