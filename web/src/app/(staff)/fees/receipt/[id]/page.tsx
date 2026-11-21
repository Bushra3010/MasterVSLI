import { notFound } from "next/navigation";
import { Receipt, loadReceipt } from "@/components/receipt";
import { getRepo } from "@/lib/server";

export const metadata = { title: "Fee receipt" };

export default async function StaffReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadReceipt(await getRepo(), id);
  if (!data) notFound();
  return <Receipt data={data} />;
}
