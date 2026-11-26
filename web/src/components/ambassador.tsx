import type { AmbassadorActivity } from "@/lib/types";

export const ambTone = (s: AmbassadorActivity["status"]) =>
  (s === "credited" ? "green" : s === "delivered" ? "blue" : s === "approved" ? "violet" : s === "rejected" ? "red" : "amber") as "green" | "blue" | "violet" | "red" | "amber";
