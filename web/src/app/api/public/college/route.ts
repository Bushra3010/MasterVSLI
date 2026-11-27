import { NextResponse } from "next/server";
import { z } from "zod";
import { createCollegeRepo } from "@/lib/colleges";
import { getServiceStore } from "@/lib/session";

/** Public college registration: colleges (or anyone) share contact details; staff verify them under Incoming Leads. */
const Body = z.object({
  college_name: z.string().trim().min(3).max(160),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  contact_name: z.string().trim().min(2).max(120),
  designation: z.string().trim().max(80).optional(),
  department: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  website: z.string().optional(), // honeypot
});

export async function POST(req: Request) {
  const sameSite = req.headers.get("origin") === new URL(req.url).origin;
  const input = Object.fromEntries(await req.formData().catch(() => new FormData()));
  const parsed = Body.safeParse(input);
  const fail = (msg: string) => (sameSite ? NextResponse.redirect(new URL(`/college-register?error=${encodeURIComponent(msg)}`, req.url), 303) : NextResponse.json({ error: msg }, { status: 400 }));
  if (!parsed.success) return fail("Please enter the college name and your name.");
  const d = parsed.data;
  if (d.website) return sameSite ? NextResponse.redirect(new URL("/college-register?sent=1", req.url), 303) : NextResponse.json({ ok: true });
  if ((d.phone ?? "").replace(/\D/g, "").length < 10 && !d.email) return fail("Give a 10-digit mobile number or an email.");
  await createCollegeRepo(getServiceStore()).submit({
    college_name: d.college_name, city: d.city || null, state: d.state || null, contact_name: d.contact_name, designation: d.designation || null,
    department: d.department || null, phone: d.phone || null, email: d.email || null, source: "public_form", submitted_by: null,
  });
  return sameSite ? NextResponse.redirect(new URL("/college-register?sent=1", req.url), 303) : NextResponse.json({ ok: true });
}
