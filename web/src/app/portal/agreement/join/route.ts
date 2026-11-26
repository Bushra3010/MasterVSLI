import { NextResponse } from "next/server";
import { placementGroupUrl } from "@/lib/placement-group";
import { getServiceRepo } from "@/lib/server";
import { getSession } from "@/lib/session";

/**
 * "Join Placement Group": for a signed-in student who has accepted the placement terms, records the join
 * (so the placement team sees it) and sends them to the official WhatsApp group. Everyone else goes back.
 */
export async function GET(req: Request) {
  const back = (q: string) => NextResponse.redirect(new URL(`/portal/agreement${q}`, req.url), 303);
  const s = await getSession();
  if (!s) return NextResponse.redirect(new URL("/login", req.url), 303);
  if (s.role !== "student" || !s.studentId) return back("");
  const repo = getServiceRepo();
  const { required } = await repo.consentFor(s.studentId, "placement");
  if (required) return back("?error=terms");
  const p = await repo.profile(s.studentId);
  if (p?.student.placement_group !== "added") await repo.updateStudent(s.studentId, { placement_group: "requested" });
  const url = placementGroupUrl();
  if (!url) return back("?error=group");
  return NextResponse.redirect(url, 303);
}
