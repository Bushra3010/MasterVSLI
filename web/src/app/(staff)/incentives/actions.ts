"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createIncentiveRepo } from "@/lib/incentives";
import { getRepo } from "@/lib/server";
import { getStore, isAdmin, requireStaff } from "@/lib/session";
import { type IncentiveMetric, METRICS } from "@/lib/types-incentives";

const inc = async () => createIncentiveRepo(await getStore());
const t = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
const back = (form: FormData, msg: string) => {
  const b = t(form, "back");
  const url = b.startsWith("/incentives") ? b.replace(/([?&])(saved|error)=[^&]*/g, "$1").replace(/[?&]+$/, "") : "/incentives";
  return url + (url.includes("?") ? "&" : "?") + msg;
};
function refresh() {
  revalidatePath("/incentives", "layout");
}
async function requireAdmin() {
  const me = await requireStaff();
  if (!isAdmin(me)) throw new Error("Only admins can do this");
  return me;
}
async function myStaffId() {
  const me = await requireStaff();
  const repo = await getRepo();
  const s = (await repo.staffForUser(me.userId, me.email)) ?? (me.demo ? (await repo.staff())[0] : null);
  return { me, staffId: s?.id ?? null };
}

/** HR logs an activity (review, video, interview, tie-up…). Admins may log on behalf of anyone. */
export async function logActivityAction(form: FormData) {
  const { me, staffId } = await myStaffId();
  const forStaff = isAdmin(me) && t(form, "staff_id") ? t(form, "staff_id") : staffId;
  if (!forStaff) throw new Error("Your login isn't linked to a staff record yet");
  const date = t(form, "occurred_on");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 4) < "2000" || date.slice(0, 4) > "2100") throw new Error("Pick a valid date");
  const category = t(form, "category");
  await (await inc()).log({
    staff_id: forStaff,
    rule_key: t(form, "rule_key"),
    quantity: Number(t(form, "quantity") || 1),
    occurred_on: date,
    ref_label: t(form, "ref_label") || null,
    note: t(form, "note") || null,
    proof_url: t(form, "proof_url") || null,
    amount: t(form, "amount") ? Number(t(form, "amount")) : null,
    category: category === "normal" || category === "college" || category === "corporate" ? category : null,
    created_by: me.name,
  });
  refresh();
  redirect(back(form, "saved=logged"));
}

export async function decideAction(id: string, status: "approved" | "rejected", form: FormData) {
  const me = await requireAdmin();
  const amount = t(form, "amount");
  await (await inc()).decide(id, status, me.name, amount ? Number(amount) : null);
  refresh();
  redirect(back(form, `saved=${status}`));
}

export async function markPaidAction(staffId: string, month: string, form: FormData) {
  await requireAdmin();
  await (await inc()).markPaid(staffId, month);
  refresh();
  redirect(back(form, "saved=paid"));
}

export async function deleteEntryAction(id: string, form: FormData) {
  const { me, staffId } = await myStaffId();
  const repo = await inc();
  const e = await repo.entry(id);
  if (!e) return;
  if (!isAdmin(me) && (e.staff_id !== staffId || e.status !== "pending")) throw new Error("You can only remove your own pending activities");
  await repo.remove(id);
  await repo.syncMilestones(e.staff_id, e.occurred_on.slice(0, 7));
  refresh();
  redirect(back(form, "saved=removed"));
}

export async function saveRulesAction(form: FormData) {
  await requireAdmin();
  const repo = await inc();
  for (const r of await repo.rules()) {
    const amount = Number(t(form, `amount.${r.key}`));
    const threshold = t(form, `threshold.${r.key}`);
    await repo.saveRule(r.key, {
      amount: Number.isFinite(amount) && amount >= 0 ? amount : r.amount,
      active: form.get(`active.${r.key}`) === "on",
      ...(r.kind === "milestone" && Number(threshold) > 0 ? { threshold: Number(threshold) } : {}),
    });
  }
  refresh();
  redirect(back(form, "saved=rules"));
}

/** Targets for everyone (default) or one staff member, for all months or one month. Blank removes an override. */
export async function saveTargetsAction(form: FormData) {
  await requireAdmin();
  const staffId = t(form, "scope_staff") || null;
  const month = t(form, "scope_month") || null;
  if (month && !/^\d{4}-\d{2}$/.test(month)) throw new Error("Pick a valid month");
  const repo = await inc();
  for (const m of METRICS) {
    const v = t(form, `target.${m.key}`);
    if (!staffId && !month && !v) continue; // the institute default always stays
    await repo.setTarget(staffId, month, m.key as IncentiveMetric, v === "" ? null : Math.max(0, Number(v)));
  }
  refresh();
  redirect(back(form, "saved=targets"));
}
