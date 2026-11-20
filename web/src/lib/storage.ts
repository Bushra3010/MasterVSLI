import "server-only";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase/clients";

/**
 * Student document files. Supabase Storage (private bucket "student-docs", written with the service
 * role after the app has checked permissions); in demo mode, an in-memory map.
 */
const BUCKET = "student-docs";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const g = globalThis as unknown as { __mvlFiles?: Map<string, { bytes: Uint8Array; type: string }> };
const demoFiles = () => (g.__mvlFiles ??= new Map());
const supabaseMode = () => isSupabaseConfigured();

export function contentTypeFor(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  return Object.entries(ALLOWED_TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}

export function safeFileName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").slice(-80);
  return cleaned || "file";
}

export async function putFile(path: string, file: File) {
  if (!supabaseMode()) {
    demoFiles().set(path, { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type });
    return;
  }
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

export async function deleteFile(path: string) {
  if (!supabaseMode()) {
    demoFiles().delete(path);
    return;
  }
  await supabaseAdmin().storage.from(BUCKET).remove([path]);
}

/** A short-lived link (Supabase) or the bytes themselves (demo). */
export async function openFile(path: string): Promise<{ url: string } | { bytes: Uint8Array; type: string } | null> {
  if (!supabaseMode()) return demoFiles().get(path) ?? null;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(path, 120);
  return error || !data ? null : { url: data.signedUrl };
}
