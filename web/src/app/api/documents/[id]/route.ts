import { openFile, contentTypeFor } from "@/lib/storage";
import { getStudentReadRepo } from "@/lib/server";
import { getSession } from "@/lib/session";
import { docFileName } from "@/lib/types";

/** Opens a student document: staff may open any; a student only their own. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new Response("Sign in required", { status: 401 });
  const { id } = await params;
  const doc = await (await getStudentReadRepo()).document(id);
  const staff = ["super_admin", "admin", "staff"].includes(s.role);
  if (!doc || (!staff && (s.role !== "student" || doc.student_id !== s.studentId))) return new Response("Not found", { status: 404 });
  const file = await openFile(doc.storage_path);
  if (!file) return new Response("File not available", { status: 404 });
  if ("url" in file) return Response.redirect(file.url, 302);
  return new Response(new Blob([file.bytes as BlobPart]), {
    headers: {
      "content-type": file.type || contentTypeFor(doc.storage_path),
      "content-disposition": `inline; filename="${docFileName(doc.storage_path)}"`,
      "cache-control": "private, no-store",
    },
  });
}
