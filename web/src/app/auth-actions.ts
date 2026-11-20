"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE } from "@/lib/session";
import { isSupabaseConfigured, supabaseServer } from "@/lib/supabase/clients";

export async function signIn(_: unknown, form: FormData) {
  if (!isSupabaseConfigured()) {
    const persona = String(form.get("persona") || "admin");
    (await cookies()).set(DEMO_COOKIE, persona, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect(persona === "admin" ? "/dashboard" : "/portal");
  }
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get("email") || ""),
    password: String(form.get("password") || ""),
  });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signOut() {
  if (!isSupabaseConfigured()) (await cookies()).delete(DEMO_COOKIE);
  else await (await supabaseServer()).auth.signOut();
  redirect("/login");
}
