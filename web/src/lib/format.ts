/** Calendar date in India Standard Time (UTC+5:30) — the institute's business day. */
export const istDate = (iso: string | number | Date = Date.now()) =>
  new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
export const todayISO = () => istDate();

export function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string) {
  return Math.round((Date.parse(toISO + "T00:00:00Z") - Date.parse(fromISO + "T00:00:00Z")) / 86_400_000);
}

export const inr = (n: number) =>
  (Math.round(n) < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    // plain dates are calendar days; full timestamps are shown in India time
    timeZone: iso.length === 10 ? "UTC" : "Asia/Kolkata",
  });
}

export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** HH:MM in India time for an ISO timestamp. */
export function istTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
}

/** "YYYY-MM-DD HH:MM" in India time, for exports. */
export function istDateTime(iso?: string | null) {
  if (!iso) return "";
  return `${istDate(iso)} ${istTime(iso)}`;
}
