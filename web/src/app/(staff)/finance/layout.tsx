import { requireFinance } from "@/lib/session";

/** Finance & fund flow is for super admins and admins only. */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireFinance();
  return <>{children}</>;
}
