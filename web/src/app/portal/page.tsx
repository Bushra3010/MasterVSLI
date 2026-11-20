import { AlertTriangle } from "lucide-react";
import { StudentProfileView } from "@/components/student-profile";
import { Badge, StatusBadge } from "@/components/ui";
import { daysBetween, fmtDate, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "My dashboard" };

export default async function PortalHome() {
  const s = await requireStudent();
  const p = await (await getRepo()).profile(s.studentId);
  if (!p) return <p>Profile not found.</p>;
  const st = p.student;
  const left = st.validity_end ? daysBetween(todayISO(), st.validity_end) : null;
  return (
    <>
      <div className="mb-5 rounded-xl bg-gradient-to-r from-navy to-[#1c3d66] p-5 text-white shadow">
        <div className="text-sm opacity-80">Welcome back,</div>
        <h1 className="text-2xl font-semibold">{st.full_name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono opacity-90">{st.enrollment_no}</span>
          <StatusBadge status={st.status} />
          {left !== null && <Badge tone={left <= 30 ? "amber" : "slate"}>Access valid till {fmtDate(st.validity_end)}</Badge>}
        </div>
      </div>
      {st.status !== "active" && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="shrink-0" size={18} />
          Your account is <b>{st.status.replace("_", " ")}</b>. Zoom, recorded classes, biometric entry, placement applications and
          training materials are paused until the institute re-activates or renews your access.
        </div>
      )}
      {left !== null && left >= 0 && left <= 30 && st.status === "active" && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your training access expires in <b>{left} days</b>. Contact the office to renew.
        </div>
      )}
      <StudentProfileView p={p} />
    </>
  );
}
