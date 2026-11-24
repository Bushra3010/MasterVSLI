import { driveSheetRows, SHEET_COLUMNS } from "@/lib/integrations/google-sheets";
import { getRepo } from "@/lib/server";
import { getSession } from "@/lib/session";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** The drive's "Yes" list with the same columns as the Google Sheet, as an Excel-ready CSV. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role === "student" || s.role === "college") return new Response("Forbidden", { status: 403 });
  const driveId = new URL(req.url).searchParams.get("drive") ?? "";
  const repo = await getRepo();
  const drive = (await repo.drives()).find((d) => d.id === driveId);
  if (!drive) return new Response("Drive not found", { status: 404 });
  const yes = (await repo.responses(driveId)).filter((r) => r.response === "yes");
  const rows = await driveSheetRows(repo, yes);
  const stage = new Map(yes.map((r) => [r.student_id, r.stage ?? ""]));
  const body = [[...SHEET_COLUMNS, "Stage"], ...rows.map((r, i) => [...r, stage.get(yes[i].student_id) ?? ""])].map((r) => r.map(esc).join(",")).join("\n");
  const name = `${drive.company}_${drive.job_role}`.replace(/[^\w-]+/g, "_").slice(0, 60);
  return new Response("﻿" + body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="drive_${name}.csv"` } });
}
