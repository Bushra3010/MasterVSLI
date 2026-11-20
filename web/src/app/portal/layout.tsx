import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { requireStudent } from "@/lib/session";
import { signOut } from "../auth-actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStudent();
  return (
    <>
      <Sidebar role={s.role} name={s.name} demo={s.demo} signOut={signOut} />
      <Topbar name={s.name} staff={false} />
      <main className="min-h-screen p-4 sm:p-6 lg:ml-64 lg:px-6 lg:py-5">{children}</main>
    </>
  );
}
