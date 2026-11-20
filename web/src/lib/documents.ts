import "server-only";
import type { Repo } from "./repo";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, putFile, safeFileName } from "./storage";
import { DOC_KINDS } from "./types";

export type UploadResult = { ok: true } | { ok: false; message: string };

/** Validates and stores one uploaded file for a student. Callers check permissions first. */
export async function uploadStudentDocument(repo: Repo, studentId: string, form: FormData, allowedKinds = Object.keys(DOC_KINDS)): Promise<UploadResult> {
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!allowedKinds.includes(kind)) return { ok: false, message: "Choose a document type." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "Files must be 5 MB or smaller." };
  if (!ALLOWED_TYPES[file.type]) return { ok: false, message: "Upload a PDF, JPG, PNG, WEBP or Word file." };
  const path = `${studentId}/${kind}/${Date.now()}-${safeFileName(file.name)}`;
  try {
    await putFile(path, file);
    await repo.addDocument(studentId, kind, path);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Upload failed" };
  }
}
