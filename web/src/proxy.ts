import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/no-access", "/manifest.webmanifest", "/verify", "/api/webhooks", "/api/cron", "/api/public", "/apply", "/auth", "/college-register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Demo mode: a cookie picks the persona.
  if (!url || !key) {
    if (!isPublic && !request.cookies.get("mvl_demo")) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  // Supabase mode: refresh the session cookie on every request.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Only gate on whether a login cookie exists (refreshing it when it has expired). Reading the cookie needs no
  // network call; every page still verifies the user with Supabase (getUser in lib/session) before showing data.
  const { data } = await supabase.auth.getSession();
  if (!data.session && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
