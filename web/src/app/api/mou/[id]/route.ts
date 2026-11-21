import { getServiceRepo } from "@/lib/server";
import { getSession } from "@/lib/session";
import { contentTypeFor, openFile } from "@/lib/storage";
import type { Mou } from "@/lib/types";

/** Signed MoU copy: staff, or the TPO of that college. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.role === "student") return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const mou = await getServiceRepo().one<Mou>("mous", id);
  if (!mou?.document_path || (s.role === "college" && s.collegeId !== mou.college_id)) return new Response("Not found", { status: 404 });
  const file = await openFile(mou.document_path);
  if (!file) return new Response("File not available", { status: 404 });
  if ("url" in file) return Response.redirect(file.url, 302);
  const name = mou.document_path.split("/").pop()?.replace(/^\d+-/, "") ?? "mou";
  return new Response(file.bytes as BodyInit, { headers: { "content-type": file.type || contentTypeFor(name), "content-disposition": `inline; filename="${name}"` } });
}
