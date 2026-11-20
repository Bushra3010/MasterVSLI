import { notFound } from "next/navigation";
import { Receipt, loadReceipt } from "@/components/receipt";
import { getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "Fee receipt" };

export default async function PortalReceiptPage({ params }: PageProps<"/portal/receipt/[id]">) {
  const s = await requireStudent();
  const { id } = await params;
  const data = await loadReceipt(await getStudentReadRepo(), id);
  if (!data || data.payment.student_id !== s.studentId) notFound();
  return <Receipt data={data} />;
}
