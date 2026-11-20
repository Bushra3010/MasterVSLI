import Image from "next/image";
import { createRepo } from "@/lib/repo";
import { getStore } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/clients";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const demo = !isSupabaseConfigured();
  const students = demo ? (await createRepo(await getStore()).students({ status: "all" })).slice(0, 8) : [];
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-navy to-[#1c3d66] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="MasterVLSI" width={84} height={84} priority />
          <h1 className="mt-2 text-xl font-semibold text-navy">
            Master<span className="text-brand">VLSI</span> ERP
          </h1>
          <p className="text-xs text-muted">Leader in Semiconductor Industry Training</p>
        </div>
        <LoginForm demo={demo} students={students.map((s) => ({ id: s.id, label: `${s.full_name} (${s.status.replace("_", " ")})` }))} />
      </div>
    </main>
  );
}
