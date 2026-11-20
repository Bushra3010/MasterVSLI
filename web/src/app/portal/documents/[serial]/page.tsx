import { notFound } from "next/navigation";
import { LetterView, loadLetter } from "@/components/letter";
import { PrintButton } from "@/components/print-button";
import { getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";

export default async function PortalLetter({ params }: PageProps<"/portal/documents/[serial]">) {
  const s = await requireStudent();
  const { serial } = await params;
  const data = await loadLetter(await getStudentReadRepo(), serial);
  if (!data || data.letter.student_id !== s.studentId) notFound();
  return (
    <>
      <div className="no-print mb-5 flex justify-end"><PrintButton label="Download PDF" /></div>
      <LetterView {...data} />
    </>
  );
}
