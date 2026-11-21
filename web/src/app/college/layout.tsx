import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { requireCollege } from "@/lib/session";
import { signOut } from "../auth-actions";

export default async function CollegeLayout({ children }: { children: React.ReactNode }) {
  const s = await requireCollege();
  return (
    <>
      <Sidebar role={s.role} name={s.name} demo={s.demo} signOut={signOut} />
      <Topbar name={s.name} staff={false} />
      <main className="min-h-screen p-4 sm:p-6 lg:ml-64 lg:px-6 lg:py-5">{children}</main>
    </>
  );
}
