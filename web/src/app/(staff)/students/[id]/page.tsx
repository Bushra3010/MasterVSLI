import { notFound } from "next/navigation";
import { StudentProfileView } from "@/components/student-profile";
import { Badge, StatusBadge } from "@/components/ui";
import { daysBetween, fmtDate, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { UploadForm } from "@/components/documents-card";
import { PortalLoginButton } from "./portal-login";
import { deleteDocumentAction, uploadDocumentAction, verifyDocumentAction, recordPaymentAction, renewAction, setStatusAction, toggleChannelAction } from "../../actions";

export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  const p = await (await getRepo()).profile(id);
  if (!p) notFound();
  const s = p.student;
  const left = s.validity_end ? daysBetween(todayISO(), s.validity_end) : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-full bg-navy text-lg font-semibold text-white">
            {s.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-navy">{s.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-mono">{s.enrollment_no}</span>
              <StatusBadge status={s.status} />
              {left !== null && (
                <Badge tone={left < 0 ? "red" : left <= 30 ? "amber" : "slate"}>
                  {left < 0 ? `Expired ${fmtDate(s.validity_end)}` : `Valid till ${fmtDate(s.validity_end)} (${left}d)`}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.status === "active" ? (
            <form action={setStatusAction.bind(null, s.id, "on_hold", "Put on hold by admin")}>
              <button className="btn border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">Put on hold</button>
            </form>
          ) : (
            <form action={setStatusAction.bind(null, s.id, "active", "Re-activated by admin")}>
              <button className="btn border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">Activate</button>
            </form>
          )}
          <form action={renewAction.bind(null, s.id, 6)}>
            <button className="btn-ghost">Renew +6 months</button>
          </form>
          <a href={`/students/${s.id}/edit`} className="btn-ghost">Edit profile</a>
          <PortalLoginButton studentId={s.id} hasLogin={Boolean(s.user_id)} />
          <a href={`/documents?subject=student:${s.id}`} className="btn-navy">Issue letter</a>
        </div>
      </div>

      <StudentProfileView
        p={p}
        channelControl={(channel, enabled) => (
          <form action={toggleChannelAction.bind(null, s.id, channel, !enabled)}>
            <button className="text-xs text-muted underline hover:text-brand">{enabled ? "Block" : "Allow"}</button>
          </form>
        )}
        uploadSlot={<UploadForm action={uploadDocumentAction.bind(null, s.id)} />}
        documentControl={(d) => (
          <>
            <form action={verifyDocumentAction.bind(null, d.id, !d.verified)}>
              <button className="text-[11px] text-muted underline hover:text-brand">{d.verified ? "Unverify" : "Verify"}</button>
            </form>
            <form action={deleteDocumentAction.bind(null, d.id)}>
              <button className="text-[11px] text-muted underline hover:text-brand" title="Delete this file">Delete</button>
            </form>
          </>
        )}
        paymentControl={(installmentId, balance) => (
          <form action={recordPaymentAction} className="inline">
            <input type="hidden" name="installment_id" value={installmentId} />
            <input type="hidden" name="amount" value={balance} />
            <input type="hidden" name="mode" value="UPI" />
            <button className="text-[11px] font-medium text-navy underline hover:text-brand" title={`Record full payment of ₹${balance}`}>
              Mark paid
            </button>
          </form>
        )}
      />
    </>
  );
}
