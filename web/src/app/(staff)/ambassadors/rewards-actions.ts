"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRewardsRepo } from "@/lib/rewards";
import { getStore, isAdmin, requireStaff } from "@/lib/session";
import type { RewardSetting, RewardType } from "@/lib/types";

const t = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
async function admin() {
  const me = await requireStaff();
  if (!isAdmin(me)) throw new Error("Only admins can change reward settings");
  return createRewardsRepo(await getStore());
}
function done(msg: string): never {
  revalidatePath("/ambassadors");
  revalidatePath("/portal/earn", "layout");
  redirect(`/ambassadors?saved=${encodeURIComponent(msg)}`);
}

/** Activity Target & Reward Settings: target, reward type/amount, on/off, pause. */
export async function saveRewardSettingsAction(form: FormData) {
  const repo = await admin();
  for (const s of await repo.settings()) {
    const target = t(form, `target.${s.key}`);
    const type = t(form, `type.${s.key}`) as RewardType;
    const amount = Number(t(form, `amount.${s.key}`));
    const patch: Partial<RewardSetting> = {
      active: form.get(`active.${s.key}`) === "on",
      paused: form.get(`paused.${s.key}`) === "on",
      reward_type: ["goodie", "amount", "mentorship", "none"].includes(type) ? type : s.reward_type,
      reward_amount: Number.isFinite(amount) && amount >= 0 ? amount : s.reward_amount,
    };
    if (form.has(`target.${s.key}`)) patch.target = target === "" ? null : Math.max(1, Math.floor(Number(target) || 1));
    await repo.saveSetting(s.key, patch);
  }
  done("Reward settings saved");
}

/** Program Controls: academic year, validity and which branch / domain the program covers. */
export async function saveRewardProgramAction(form: FormData) {
  const repo = await admin();
  const from = t(form, "valid_from"), to = t(form, "valid_to");
  if (from && to && to < from) throw new Error("The end date must be after the start date");
  await repo.saveProgram({ academic_year: t(form, "academic_year") || "2026 / 2027", valid_from: from || null, valid_to: to || null, branch_id: t(form, "branch_id") || null });
  done("Program settings saved");
}

export async function markGoodieCollectedAction(id: string) {
  await requireStaff();
  await createRewardsRepo(await getStore()).markCollected(id);
  done("Goodie marked as collected");
}
