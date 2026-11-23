import { BadgeCheck, ShieldX } from "lucide-react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { fmtDate } from "@/lib/format";
import { templateMeta } from "@/lib/letters";
import { createRepo } from "@/lib/repo";
import { DemoStore } from "@/lib/store/demo";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/clients";

export const metadata = { title: "Verify document" };

async function lookup(serial: string) {
  if (isSupabaseConfigured()) {
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await db.rpc("verify_letter", { p_serial: serial });
    const row = (data as { serial_no: string; template: string; holder: string; issued_at: string; revoked: boolean }[] | null)?.[0];
    return row ?? null;
  }
  const repo = createRepo(new DemoStore());
  const l = await repo.letter(serial);
  if (!l) return null;
  const holder = l.student_id
    ? (await repo.profile(l.student_id))?.student.full_name
    : (await repo.staff()).find((s) => s.id === l.staff_id)?.full_name;
  return { serial_no: l.serial_no, template: l.template, holder: holder ?? "—", issued_at: l.issued_at, revoked: l.revoked };
}

export default async function VerifyPage({ params }: PageProps<"/verify/[serial]">) {
  const { serial } = await params;
  const r = await lookup(decodeURIComponent(serial));
  const valid = r && !r.revoked;
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-lg">
        <Image src="/logo-full.svg" alt="MasterVLSI — Leader In Semiconductor Industry" width={240} height={60} unoptimized priority className="mx-auto h-14 w-auto" />
        <h1 className="mt-2 text-lg font-semibold text-navy">Document verification</h1>
        {valid ? (
          <>
            <BadgeCheck className="mx-auto mt-4 text-emerald-600" size={48} />
            <p className="mt-2 font-semibold text-emerald-700">Authentic document issued by MasterVLSI</p>
            <dl className="mt-4 space-y-1 text-left text-sm">
              <div className="flex justify-between"><dt className="text-muted">Serial no.</dt><dd className="font-mono">{r.serial_no}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Document</dt><dd>{templateMeta(r.template)?.title}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Issued to</dt><dd className="font-medium">{r.holder}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Issued on</dt><dd>{fmtDate(r.issued_at)}</dd></div>
            </dl>
          </>
        ) : (
          <>
            <ShieldX className="mx-auto mt-4 text-brand" size={48} />
            <p className="mt-2 font-semibold text-brand">{r?.revoked ? "This document has been revoked" : "No document found with this serial number"}</p>
            <p className="mt-1 font-mono text-xs text-muted">{serial}</p>
          </>
        )}
      </div>
    </main>
  );
}
