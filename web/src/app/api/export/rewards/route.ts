import { fmtDate, todayISO } from "@/lib/format";
import { createRewardsRepo, rewardsSummary } from "@/lib/rewards";
import { getRepo } from "@/lib/server";
import { getSession, getStore } from "@/lib/session";
import { KIND_LABEL } from "@/lib/types-rewards";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Earn & Rewards reports for staff: ?type=activities | students | claims (Excel-ready CSV). */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role === "student" || s.role === "college") return new Response("Forbidden", { status: 403 });
  const type = new URL(req.url).searchParams.get("type") ?? "activities";
  const rewards = createRewardsRepo(await getStore());
  const [rows, goodies, settings, students] = await Promise.all([rewards.activities(), rewards.goodies(), rewards.settings(), (await getRepo()).students()]);
  const who = new Map(students.map((x) => [x.id, x]));
  let table: unknown[][];
  if (type === "students") {
    table = [["Student", "Enrollment", "Rank", "Lifetime ₹", "This month ₹", "Goodies earned", "Goodies collected", "Pending", "Verified", "Rejected", "Progress %"]];
    for (const st of students) {
      const mine = rows.filter((r) => r.student_id === st.id);
      if (!mine.length) continue;
      const x = rewardsSummary(mine, goodies.filter((g) => g.student_id === st.id), settings, todayISO().slice(0, 7));
      table.push([st.full_name, st.enrollment_no, x.rank, x.lifetime, x.monthEarned, x.goodiesEarned, x.goodiesCollected, x.counts.pending, x.counts.verified, x.counts.rejected, x.progress]);
    }
  } else if (type === "claims") {
    table = [["Student", "Enrollment", "Goodie for", "Earned on", "Status", "Collected on"]];
    for (const g of goodies) table.push([who.get(g.student_id)?.full_name, who.get(g.student_id)?.enrollment_no, g.reason, fmtDate(g.earned_at), g.status, g.collected_at ? fmtDate(g.collected_at) : ""]);
  } else {
    table = [["Date", "Student", "Enrollment", "Activity", "Details", "Proof", "Reward ₹", "Status", "Decided by", "Decided on"]];
    for (const r of rows) table.push([fmtDate(r.created_at), who.get(r.student_id)?.full_name, who.get(r.student_id)?.enrollment_no, KIND_LABEL[r.kind] ?? r.kind, r.kind === "incident" ? `${r.details}: ${r.data?.description ?? ""}` : r.details, r.proof_url ?? "", r.reward_amount, r.status, r.decided_by ?? "", r.decided_at ? fmtDate(r.decided_at) : ""]);
  }
  const body = table.map((r) => r.map(esc).join(",")).join("\n");
  return new Response("﻿" + body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="earn_rewards_${type}_${todayISO()}.csv"` } });
}
