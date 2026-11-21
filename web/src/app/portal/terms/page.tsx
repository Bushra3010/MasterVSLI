import { CheckCircle2 } from "lucide-react";
import { TermsForm } from "@/components/terms-form";
import { Card, PageHeader } from "@/components/ui";
import { getServiceRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import { acceptTermsAction } from "../actions";

export const metadata = { title: "Terms & conditions" };

export default async function PortalTermsPage() {
  const s = await requireStudent();
  const { terms, consent } = await getServiceRepo().consentFor(s.studentId, "general");
  return (
    <>
      <PageHeader title={terms?.title ?? "MasterVLSI Terms & Conditions"} subtitle="Please read and accept the institute's terms to continue using your student portal." />
      <Card>
        {!terms ? (
          <p className="text-sm text-muted">No terms have been published yet.</p>
        ) : consent ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> Accepted on {new Date(consent.accepted_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · Consent ID <span className="font-mono">{consent.consent_no}</span></p>
            <ol className="list-decimal space-y-2 pl-5 text-[13px]">{terms.items.map((t, i) => <li key={i}><b className="font-medium text-navy">{t.title}</b>: {t.body}</li>)}</ol>
          </div>
        ) : (
          <TermsForm items={terms.items} action={acceptTermsAction.bind(null, "general")} cta="I Agree" />
        )}
      </Card>
    </>
  );
}
