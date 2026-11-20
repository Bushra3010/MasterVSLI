import Link from "next/link";
import { notFound } from "next/navigation";
import { LetterView, loadLetter } from "@/components/letter";
import { PrintButton } from "@/components/print-button";
import { getRepo } from "@/lib/server";

export default async function LetterPage({ params }: PageProps<"/documents/[serial]">) {
  const { serial } = await params;
  const data = await loadLetter(await getRepo(), serial);
  if (!data) notFound();
  return (
    <>
      <div className="no-print mb-5 flex items-center justify-between">
        <Link href="/documents" className="text-sm text-muted hover:text-brand">← Back to documents</Link>
        <div className="flex gap-2">
          <a href={data.verifyUrl} target="_blank" className="btn-ghost">Open verification page</a>
          <PrintButton />
        </div>
      </div>
      <LetterView {...data} />
    </>
  );
}
