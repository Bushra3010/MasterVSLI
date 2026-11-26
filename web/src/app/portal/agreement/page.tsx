import { CheckCircle2, FileCheck2, Lock, MessageCircle, ShieldCheck, UserCheck, XCircle } from "lucide-react";
import { TermsForm } from "@/components/terms-form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getServiceRepo, getStudentReadRepo } from "@/lib/server";
import { requireStudent } from "@/lib/session";
import { acceptTermsAction } from "../actions";

export const metadata = { title: "Placement agreement" };

export default async function AgreementPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const s = await requireStudent();
  const [{ terms, consent }, p] = await Promise.all([getServiceRepo().consentFor(s.studentId, "placement"), (await getStudentReadRepo()).profile(s.studentId)]);
  const active = Boolean(consent) || !terms;
  const group = p?.student.placement_group ?? "none";
  const steps = [
    { n: 1, label: "Review Placement Terms & Conditions", icon: FileCheck2, done: active },
    { n: 2, label: "Accept All Declarations (Mandatory)", icon: CheckCircle2, done: active },
    { n: 3, label: "Placement Profile Activated", icon: UserCheck, done: active },
    { n: 4, label: "Join Placement Group (One-Click)", icon: MessageCircle, done: active && group !== "none" },
  ];

  return (
    <>
      <PageHeader title="Placement Agreement & Group Access" subtitle="Accept all placement terms & conditions to activate your Placement Profile and join the WhatsApp Placement Group." />
      <ol className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((st) => {
          const inner = (
            <>
              <span className="grid size-7 place-items-center rounded-full bg-amber-100 text-sm font-medium text-amber-800">{st.n}</span>
              <st.icon size={22} className={st.done ? "text-emerald-600" : "text-brand"} />
              <span className="text-[13px] font-medium text-navy">{st.label}</span>
            </>
          );
          const box = `flex items-center gap-3 rounded-[5px] border p-3 ${st.done ? "border-emerald-300 bg-emerald-50" : "border-line bg-white"}`;
          // Step 4 is the one-click join itself once the profile is active.
          return (
            <li key={st.n}>
              {st.n === 4 && active ? (
                <a href="/portal/agreement/join" target="_blank" rel="noopener" className={`${box} ring-emerald-400 hover:ring-2`} title="Open the MasterVLSI Placement Group on WhatsApp">
                  {inner}
                </a>
              ) : (
                <div className={box}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {terms && !consent ? (
          <Card title="Placement Registration & Consent">
            <p className="mb-3 text-xs text-muted">{terms.title} · version {terms.version}. Tap a term to read it in full.</p>
            <TermsForm items={terms.items} action={acceptTermsAction.bind(null, "placement")} cta="Agree & Activate Placement Profile" />
          </Card>
        ) : (
          <Card title="Success – Profile Activated">
            <div className="py-6 text-center">
              <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
              <h2 className="mt-2 text-xl font-medium text-navy">Congratulations!</h2>
              <p className="text-sm text-muted">You have accepted the Placement Terms &amp; Conditions. Your Placement Profile is now <b>Activated</b>.</p>
              {consent && <p className="mt-3 text-xs text-muted">Consent ID <span className="font-mono">{consent.consent_no}</span> · {new Date(consent.accepted_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}
            </div>
          </Card>
        )}

        <div className="space-y-5">
          <Card title={active ? "After Agreement (Activated)" : "Before Agreement"}>
            <div className="mb-3 text-center">
              <div className="text-sm font-medium text-navy">Placement Profile</div>
              <Badge tone={active ? "green" : "red"}>{active ? "Active" : "Not Active"}</Badge>
            </div>
            <ul className="space-y-2 text-[13px]">
              {(active
                ? ["Can apply for company drives", "Can receive placement updates", "Placement support enabled", group === "added" ? "Added to MasterVLSI Placement Group" : "Placement Group: request below"]
                : ["Cannot access placement group", "Cannot apply for company drives", "Cannot receive placement updates"]
              ).map((t) => (
                <li key={t} className="flex items-center gap-2">{active ? <CheckCircle2 size={15} className="text-emerald-600" /> : <XCircle size={15} className="text-red-500" />}{t}</li>
              ))}
            </ul>
          </Card>

          <Card title="Join Placement Group">
            {!active ? (
              <p className="flex items-center gap-2 text-sm text-muted"><Lock size={15} /> Accept the placement terms to unlock.</p>
            ) : (
              <div className="space-y-2 text-center">
                <p className="text-sm text-muted">
                  {group === "added"
                    ? "You are in the official MasterVLSI Placement Group."
                    : group === "requested"
                      ? "You have joined / requested the official MasterVLSI Placement Group. Open it again any time:"
                      : "Click below to join the official MasterVLSI Placement Group on WhatsApp."}
                </p>
                <a href="/portal/agreement/join" target="_blank" rel="noopener" className="btn w-full bg-emerald-600 py-2.5 text-white hover:bg-emerald-700"><MessageCircle size={16} /> {group === "none" ? "Join WhatsApp Placement Group" : "Open WhatsApp Placement Group"}</a>
              </div>
            )}
            {error === "group" && <p role="alert" className="mt-2 rounded-[5px] bg-red-50 p-2 text-xs text-red-700">The group link hasn&apos;t been set up yet. Please contact the placement team.</p>}
            {error === "terms" && <p role="alert" className="mt-2 rounded-[5px] bg-red-50 p-2 text-xs text-red-700">Accept the placement terms first.</p>}
            <p className="mt-3 flex items-start gap-2 rounded-[5px] bg-amber-50 p-2 text-[11px] text-amber-900"><ShieldCheck size={14} className="shrink-0" /> The group link opens in WhatsApp and is only for MasterVLSI students with an activated Placement Profile. Please don&apos;t share it with anyone.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
