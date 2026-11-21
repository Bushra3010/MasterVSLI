import type { AmbassadorActivity } from "@/lib/types";

export const EARN_WAYS = [
  { kind: "referral", title: "Referral (Bring a Student)", sub: "Refer a friend who enrolls at MasterVLSI", reward: "Earn ₹2,000", per: "per successful admission", tint: "bg-orange-50" },
  { kind: "review", title: "Google Review", sub: "Post a genuine review on Google (≥ 5-year-old Gmail)", reward: "Earn a Gift", per: "for every 3 reviews", tint: "bg-blue-50" },
  { kind: "social", title: "Like • Subscribe • Share", sub: "Like, subscribe and share MasterVLSI videos/posts on YouTube / LinkedIn / Instagram", reward: "Earn ₹100", per: "per valid activity (weekly)", tint: "bg-violet-50" },
  { kind: "mentor", title: "Be a Mentor", sub: "Guide and support new / current students (doubts, projects, career)", reward: "Earn ₹1,000", per: "per mentored student", tint: "bg-emerald-50" },
] as const;

export function ambassadorStats(rows: AmbassadorActivity[]) {
  const ok = rows.filter((r) => r.status !== "rejected" && r.status !== "pending");
  const month = new Date().toISOString().slice(0, 7);
  const earned = ok.filter((r) => r.status === "credited").reduce((a, r) => a + Number(r.reward_amount), 0);
  const monthEarned = ok.filter((r) => r.status === "credited" && r.created_at.startsWith(month)).reduce((a, r) => a + Number(r.reward_amount), 0);
  const gifts = ok.filter((r) => r.gift && r.status === "delivered");
  const by = (k: string) => ok.filter((r) => r.kind === k).length;
  const score = earned + 500 * gifts.length;
  const level = score >= 10000 ? "Gold Ambassador" : score >= 4000 ? "Silver Ambassador" : ok.length ? "Bronze Ambassador" : "New";
  const since = ok.length ? ok.map((r) => r.created_at).sort()[0] : null;
  return {
    earned, monthEarned, gifts: gifts.length, monthGifts: gifts.filter((g) => g.created_at.startsWith(month)).length,
    referrals: by("referral"), reviews: by("review"), social: by("social"), mentees: by("mentor"), level, since,
  };
}

export const ambTone = (s: AmbassadorActivity["status"]) =>
  (s === "credited" ? "green" : s === "delivered" ? "blue" : s === "approved" ? "violet" : s === "rejected" ? "red" : "amber") as "green" | "blue" | "violet" | "red" | "amber";
