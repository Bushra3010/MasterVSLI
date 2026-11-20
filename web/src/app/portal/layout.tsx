import { Sidebar } from "@/components/sidebar";
import { requireStudent } from "@/lib/session";
import { signOut } from "../auth-actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStudent();
  return (
    <>
      <Sidebar role={s.role} name={s.name} demo={s.demo} signOut={signOut} />
      <main className="min-h-screen p-4 sm:p-6 lg:ml-60 lg:p-8">{children}</main>
    </>
  );
}
