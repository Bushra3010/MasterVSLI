import { contentTypeFor, openFile } from "@/lib/storage";
import { getSession, getStore } from "@/lib/session";
import type { CollegeDocument } from "@/lib/types";

/** Opens an uploaded college document — staff only. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || !["super_admin", "admin", "staff"].includes(s.role)) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const [doc] = await (await getStore()).select<CollegeDocument>("college_documents", { eq: { id } });
  if (!doc) return new Response("Not found", { status: 404 });
  if (!doc.storage_path) return doc.url ? Response.redirect(doc.url, 302) : new Response("Not found", { status: 404 });
  const file = await openFile(doc.storage_path);
  if (!file) return new Response("File not available", { status: 404 });
  if ("url" in file) return Response.redirect(file.url, 302);
  return new Response(new Blob([file.bytes as BlobPart]), { headers: { "content-type": file.type || contentTypeFor(doc.storage_path), "cache-control": "private, no-store" } });
}
