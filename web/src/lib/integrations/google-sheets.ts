import "server-only";
import type { Repo } from "../repo";

/**
 * Placement drive → Google Sheet sync.
 * Every student who answered "Yes" is appended as a row on a tab named after the drive.
 * Auth: service account JWT signed with Web Crypto (works on Node and Cloudflare Workers).
 * Share the spreadsheet with the service account's client_email as Editor.
 */
export const SHEET_COLUMNS = [
  "Enrollment No", "Name", "Email", "Phone", "Gender", "Higher Degree", "Stream", "College", "Year of Passing", "Score",
  "Working Status", "Current Company", "Total Exp", "Relevant Exp", "Current CTC", "Expected CTC", "Notice Period",
  "Preferred Location", "Willing to Relocate", "Interview Mode", "Course", "Batch", "Attendance % (30d)", "Responded At",
];

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const b64url = (buf: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function accessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Google auth failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function sheetsFetch(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  return res;
}

export type SyncResult = { ok: boolean; synced: number; mode: "google" | "simulated"; message: string };

/** One sheet row per "yes" response, with the student's full placement profile. */
export async function driveSheetRows(repo: Repo, responses: { student_id: string; updated_at?: string | null }[]) {
  const rows: string[][] = [];
  for (const r of responses) {
    const p = await repo.profile(r.student_id);
    if (!p) continue;
    const s = p.student;
    const deg = [...p.education].sort((a, b) => (b.year_of_passing ?? 0) - (a.year_of_passing ?? 0))[0];
    const pr = s.professional ?? {};
    rows.push([
      s.enrollment_no, s.full_name, s.email ?? "", s.phone ?? "", s.gender ?? "",
      deg?.level ?? "", deg?.stream ?? "", deg?.institution ?? "", String(deg?.year_of_passing ?? ""), deg?.score ?? "",
      pr.working_status ?? "", pr.company ?? "", pr.total_exp ?? "", pr.relevant_exp ?? "", pr.current_ctc ?? "", pr.expected_ctc ?? "",
      pr.notice_period ?? "", pr.preferred_location ?? "", pr.relocate ? "Yes" : "No", pr.interview_mode ?? "",
      p.course?.name ?? "", p.batch?.name ?? "", String(p.attendance.pct), r.updated_at ?? "",
    ]);
  }
  return rows;
}

export async function syncDriveToSheet(repo: Repo, driveId: string): Promise<SyncResult> {
  const drive = (await repo.drives()).find((d) => d.id === driveId);
  if (!drive) return { ok: false, synced: 0, mode: "simulated", message: "Drive not found" };
  const pending = (await repo.responses(driveId)).filter((r) => r.response === "yes" && !r.synced_to_sheet);
  if (!pending.length) return { ok: true, synced: 0, mode: "simulated", message: "Nothing new to sync — mark students as Yes first" };
  const rows = await driveSheetRows(repo, pending);

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = drive.sheet_id || process.env.GOOGLE_SHEET_ID;
  if (!raw || !sheetId) {
    if (repo.mode === "demo") {
      await repo.markSynced(driveId, pending.map((r) => r.student_id));
      return { ok: true, synced: rows.length, mode: "simulated", message: `Demo: ${rows.length} rows marked as synced (Google Sheets not configured)` };
    }
    return { ok: false, synced: 0, mode: "google", message: "Google Sheets isn't connected yet — use “Download sheet (Excel)” for now" };
  }

  const token = await accessToken(JSON.parse(raw) as ServiceAccount);
  const tab = `${drive.company} - ${drive.job_role}`.replace(/[\[\]\*\?\/\\:]/g, " ").slice(0, 90);
  // Create the tab with a header row if it doesn't exist yet (400 = already exists).
  const add = await sheetsFetch(token, `${sheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
  });
  if (add.ok) {
    await sheetsFetch(token, `${sheetId}/values/${encodeURIComponent(`'${tab}'!A1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [SHEET_COLUMNS] }),
    });
  }
  const append = await sheetsFetch(
    token,
    `${sheetId}/values/${encodeURIComponent(`'${tab}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: rows }) },
  );
  if (!append.ok) return { ok: false, synced: 0, mode: "google", message: `Sheets append failed: ${append.status}` };
  await repo.markSynced(driveId, pending.map((r) => r.student_id));
  return { ok: true, synced: rows.length, mode: "google", message: `${rows.length} rows appended to "${tab}"` };
}
