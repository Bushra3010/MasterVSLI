import { contentTypeFor, openFile } from "@/lib/storage";
import { getStore, getSession } from "@/lib/session";
import { docFileName } from "@/lib/types";
import type { TenantDocument } from "@/lib/types-finance";

/** Tenant documents are visible to super admins and admins only. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new Response("Sign in required", { status: 401 });
  if (s.role !== "super_admin" && s.role !== "admin") return new Response("Not found", { status: 404 });
  const { id } = await params;
  const [doc] = await (await getStore()).select<TenantDocument>("tenant_documents", { eq: { id } });
  if (!doc) return new Response("Not found", { status: 404 });
  const file = await openFile(doc.storage_path);
  if (!file) return new Response("File not available", { status: 404 });
  if ("url" in file) return Response.redirect(file.url, 302);
  return new Response(new Blob([file.bytes as BlobPart]), {
    headers: { "content-type": file.type || contentTypeFor(doc.storage_path), "content-disposition": `inline; filename="${docFileName(doc.storage_path)}"`, "cache-control": "private, no-store" },
  });
}
