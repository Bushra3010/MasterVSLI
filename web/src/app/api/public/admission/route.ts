import { NextResponse } from "next/server";
import { z } from "zod";
import { safeEqual } from "@/lib/integrations/crypto";
import { getServiceRepo } from "@/lib/server";

/**
 * Website → ERP admission enquiries.
 * POST JSON (or a normal HTML form post) from the institute website:
 *   { "full_name": "…", "email": "…", "phone": "…", "course_code": "DV", "city": "…", "message": "…" }
 * If WEBSITE_API_KEY is set, send it as header x-api-key (server-to-server).
 * Browser form posts from the website are allowed from WEBSITE_ORIGIN (CORS).
 */
const Body = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional(),
  course_code: z.string().trim().max(12).optional(),
  city: z.string().trim().max(80).optional(),
  message: z.string().trim().max(1000).optional(),
  website: z.string().optional(), // honeypot: real users leave it empty
});

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = (process.env.WEBSITE_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin)
    ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, x-api-key" }
    : {};
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function POST(req: Request) {
  const headers = cors(req);
  const key = process.env.WEBSITE_API_KEY;
  const sameSite = req.headers.get("origin") === new URL(req.url).origin;
  const fromAllowedSite = "access-control-allow-origin" in headers;
  if (key && !sameSite && !fromAllowedSite && !safeEqual(req.headers.get("x-api-key") ?? "", key))
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });

  const isForm = (req.headers.get("content-type") ?? "").includes("form");
  const input = isForm ? Object.fromEntries(await req.formData()) : await req.json().catch(() => ({}));
  const parsed = Body.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Please enter your name and a valid email or phone." }, { status: 400, headers });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true }, { headers }); // bot
  if (!d.email && !d.phone) return NextResponse.json({ error: "Email or phone is required." }, { status: 400, headers });

  await getServiceRepo().addEnquiry({
    full_name: d.full_name,
    email: d.email || null,
    phone: d.phone || null,
    course_code: d.course_code?.toUpperCase() || null,
    city: d.city || null,
    message: d.message || null,
    source: sameSite ? "apply page" : "website",
  });
  if (isForm && sameSite) return NextResponse.redirect(new URL("/apply?sent=1", req.url), 303);
  return NextResponse.json({ ok: true }, { headers });
}
