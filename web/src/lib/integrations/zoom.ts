/** Zoom attendance settings shared by the webhook and the Attendance page. */
export const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Meetings that count for attendance (ZOOM_ATTENDANCE_MEETINGS, comma-separated; default "Regular Meeting"). */
export const attendanceMeetingNames = () =>
  (process.env.ZOOM_ATTENDANCE_MEETINGS || "Regular Meeting").split(",").map((s) => s.trim()).filter(Boolean);
export const attendanceMeetings = () => attendanceMeetingNames().map(norm);
