import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DemoStore } from "./store/demo";
import { SupabaseStore } from "./store/supabase";
import type { Store } from "./store/types";
import { isSupabaseConfigured, supabaseAdmin, supabaseServer } from "./supabase/clients";
import type { Role } from "./types";

export const DEMO_COOKIE = "mvl_demo";

export interface Session {
  role: Role;
  name: string;
  email?: string;
  userId?: string;
  studentId?: string;
  demo: boolean;
}

export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) {
    const v = (await cookies()).get(DEMO_COOKIE)?.value;
    if (!v) return null;
    if (v === "admin") return { role: "super_admin", name: "Demo Admin", demo: true };
    if (v.startsWith("student:")) {
      const studentId = v.slice(8);
      const [s] = await new DemoStore().select<{ full_name: string }>("students", { eq: { id: studentId } });
      return s ? { role: "student", name: s.full_name, studentId, demo: true } : null;
    }
    return null;
  }
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  const [{ data: profile }, { data: student }] = await Promise.all([
    db.from("profiles").select("role, full_name").eq("id", data.user.id).maybeSingle(),
    db.from("students").select("id, full_name").eq("user_id", data.user.id).maybeSingle(),
  ]);
  const role: Role = ["super_admin", "admin", "staff"].includes(profile?.role) ? (profile!.role as Role) : "student";
  return {
    role,
    name: profile?.full_name || student?.full_name || data.user.email || "User",
    email: data.user.email,
    userId: data.user.id,
    studentId: student?.id,
    demo: false,
  };
});

export async function requireStaff() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role === "student") redirect("/portal");
  return s;
}

export async function requireStudent() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "student") redirect("/dashboard");
  // Signed in, but no student record linked to this login (and not staff): avoid a portal↔dashboard loop.
  if (!s.studentId) redirect("/no-access");
  return s as Session & { studentId: string };
}

/** Store acting with the current user's rights. */
export async function getStore(): Promise<Store> {
  return isSupabaseConfigured() ? new SupabaseStore(await supabaseServer()) : new DemoStore();
}

/** Privileged store for webhooks/cron (service role). */
export function getServiceStore(): Store {
  return isSupabaseConfigured() ? new SupabaseStore(supabaseAdmin()) : new DemoStore();
}

/** Super admins see Kacha (other-account) fees; everyone else only Paka. */
export const isSuperAdmin = (s: Session | null) => s?.role === "super_admin";
export const isAdmin = (s: Session | null) => s?.role === "super_admin" || s?.role === "admin";
