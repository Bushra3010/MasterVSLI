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
  collegeId?: string;
  demo: boolean;
}

export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) {
    const v = (await cookies()).get(DEMO_COOKIE)?.value;
    if (!v) return null;
    if (v === "admin") return { role: "super_admin", name: "Demo Admin", demo: true };
    if (v.startsWith("college:")) {
      const collegeId = v.slice(8);
      const [c] = await new DemoStore().select<{ name: string }>("colleges", { eq: { id: collegeId } });
      return c ? { role: "college", name: `${c.name} (TPO)`, collegeId, demo: true } : null;
    }
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
  const role: Role = ["super_admin", "admin", "staff", "college"].includes(profile?.role) ? (profile!.role as Role) : "student";
  let collegeId: string | undefined;
  if (role === "college") {
    const { data: link } = await supabaseAdmin().from("college_logins").select("college_id").eq("user_id", data.user.id).maybeSingle();
    collegeId = link?.college_id ?? undefined;
  }
  return {
    collegeId,
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
  if (s.role === "college") redirect("/college");
  return s;
}

/** Finance & fund flow: super admins and admins only. */
export async function requireFinance() {
  const s = await requireStaff();
  if (s.role !== "super_admin" && s.role !== "admin") redirect("/dashboard?denied=finance");
  return s;
}

/** College (TPO) portal: only their own college's students, drives and reports. */
export async function requireCollege() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "college") redirect(s.role === "student" ? "/portal" : "/dashboard");
  if (!s.collegeId) redirect("/no-access");
  return s as Session & { collegeId: string };
}

export async function requireStudent() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "student") redirect(s.role === "college" ? "/college" : "/dashboard");
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
