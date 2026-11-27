import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { ActionStrip } from "@/components/student360";
import { HideOn } from "@/components/hide-on";
import { requireStudent } from "@/lib/session";
import { getStudent360, isAlumni } from "@/lib/student360";
import { signOut } from "../auth-actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStudent();
  // Reminders must never take the portal down.
  const d = await getStudent360(s.studentId).catch(() => null);
  return (
    <>
      <Sidebar role={s.role} name={s.name} demo={s.demo} signOut={signOut} alumni={d ? isAlumni(d.p.student) : false} />
      <Topbar name={s.name} staff={false} />
      <main className="min-h-screen p-4 sm:p-6 lg:ml-64 lg:px-6 lg:py-5">
        {d && <HideOn path="/portal"><ActionStrip items={d.actions} /></HideOn>}
        {children}
      </main>
    </>
  );
}
