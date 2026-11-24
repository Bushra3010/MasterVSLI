import { notFound } from "next/navigation";
import { StudentProfileView } from "@/components/student-profile";
import { Badge, StatusBadge } from "@/components/ui";
import { daysBetween, fmtDate, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { UploadForm } from "@/components/documents-card";
import { PortalLoginButton } from "./portal-login";
import { Card } from "@/components/ui";
import { createProfileRepo } from "@/lib/profile";
import { getStore } from "@/lib/session";
import { APPLICATION_STATUSES } from "@/lib/types";
import { addNoteAction, removeApplicationAction, saveApplicationAction, verifyProfileAction } from "../profile-actions";
import { deleteDocumentAction, uploadDocumentAction, verifyDocumentAction, recordPaymentAction, renewAction, setStatusAction, toggleChannelAction } from "../../actions";

export default async function StudentPage({ params, searchParams }: PageProps<"/students/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const p = await (await getRepo()).profile(id);
  if (!p) notFound();
  const s = p.student;
  const prof = createProfileRepo(await getStore());
  const [applications, notes, collegeContacts] = await Promise.all([
    prof.applications(id), prof.notes(id), s.category === "college" && s.college_id ? prof.collegeContacts(s.college_id) : Promise.resolve(undefined),
  ]);
  const photo = p.documents.find((d) => d.kind === "photo");
  const left = s.validity_end ? daysBetween(todayISO(), s.validity_end) : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by the permission-checked documents route
            <img src={`/api/documents/${photo.id}`} alt={`Photo of ${s.full_name}`} className="size-16 rounded-full border border-line object-cover" />
          ) : (
            <div className="grid size-16 place-items-center rounded-full bg-navy text-lg font-semibold text-white" title="Upload a photo under Documents">
              {s.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
          )}
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
              {s.profile_verified_by ? <Badge tone="green">Profile verified by {s.profile_verified_by}</Badge> : <Badge tone="amber">Profile not verified</Badge>}
            </div>
            <div className="mt-1 text-[11px] text-muted">Last updated {fmtDate(s.updated_at ?? s.created_at)}</div>
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
          {!s.profile_verified_by && (
            <form action={verifyProfileAction.bind(null, s.id)}><button className="btn border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">Mark profile verified</button></form>
          )}
          <a href={`/students/${s.id}/report`} className="btn-ghost">Download report</a>
          <a href={`/students/${s.id}/edit`} className="btn-ghost">Edit profile</a>
          <PortalLoginButton studentId={s.id} hasLogin={Boolean(s.user_id)} />
          <a href={`/documents?subject=student:${s.id}`} className="btn-navy">Issue letter</a>
        </div>
      </div>

      {sp.saved && <div role="status" className="mb-4 rounded-[5px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Profile saved.</div>}
      <StudentProfileView
        p={p}
        applications={applications}
        collegeContacts={collegeContacts}
        attendanceHref={`/students/${s.id}/report#attendance`}
        applicationControl={(a) => (
          <div className="flex items-center gap-1">
            <form action={saveApplicationAction.bind(null, s.id)} className="flex items-center gap-1">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="company" value={a.company} />
              <input type="hidden" name="applied_on" value={a.applied_on} />
              <select name="status" defaultValue={a.status} aria-label="Status" className="input w-auto py-1 text-xs">{APPLICATION_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input name="rounds" type="number" min={0} defaultValue={a.rounds} aria-label="Rounds" className="input w-14 py-1 text-xs" />
              <input type="hidden" name="role" value={a.role ?? ""} />
              <input type="hidden" name="package" value={a.package ?? ""} />
              <input type="hidden" name="doj" value={a.doj ?? ""} />
              <input type="hidden" name="hr_name" value={a.hr_name ?? ""} />
              <input type="hidden" name="hr_email" value={a.hr_email ?? ""} />
              <input type="hidden" name="job_location" value={a.job_location ?? ""} />
              <button className="text-[11px] font-medium text-navy underline">Update</button>
            </form>
            <form action={removeApplicationAction.bind(null, s.id, a.id)}><button className="text-[11px] text-muted underline hover:text-red-600">Remove</button></form>
          </div>
        )}
        applicationSlot={
          <form action={saveApplicationAction.bind(null, s.id)} className="grid gap-2 border-t border-line bg-slate-50 p-3 sm:grid-cols-3 lg:grid-cols-6">
            <input name="company" required placeholder="Company *" aria-label="Company" className="input py-1.5" />
            <input name="role" placeholder="Role" aria-label="Role" className="input py-1.5" />
            <input name="applied_on" type="date" aria-label="Applied on" className="input py-1.5" />
            <input name="rounds" type="number" min={0} placeholder="Rounds" aria-label="Rounds" className="input py-1.5" />
            <select name="status" aria-label="Status" className="input py-1.5">{APPLICATION_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input name="package" placeholder="Package (CTC)" aria-label="Package" className="input py-1.5" />
            <input name="doj" type="date" aria-label="Date of joining" className="input py-1.5" />
            <input name="hr_name" placeholder="HR POC name" aria-label="HR POC name" className="input py-1.5" />
            <input name="hr_email" type="email" placeholder="HR POC email" aria-label="HR POC email" className="input py-1.5" />
            <input name="job_location" placeholder="Job location" aria-label="Job location" className="input py-1.5" />
            <button className="btn-primary py-1.5 text-xs sm:col-span-2">+ Add application / interview</button>
          </form>
        }
        channelControl={(channel, enabled) => (
          <form action={toggleChannelAction.bind(null, s.id, channel, !enabled)}>
            <button className="text-xs text-muted underline hover:text-brand">{enabled ? "Block" : "Allow"}</button>
          </form>
        )}
        uploadSlot={<UploadForm action={uploadDocumentAction.bind(null, s.id)} kinds={["photo", "resume", "id_proof"]} />}
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
      <Card title="Notes & remarks" className="mt-5">
        <form action={addNoteAction.bind(null, s.id)} className="mb-3 flex gap-2">
          <input name="note" required minLength={2} placeholder="Add a note (counselling, follow-up, behaviour, placement remarks…)" aria-label="New note" className="input flex-1" />
          <button className="btn-navy">Add note</button>
        </form>
        <ul className="space-y-2 text-sm">
          {notes.map((n) => <li key={n.id} className="border-b border-line pb-2 last:border-0"><div>{n.note}</div><div className="text-[11px] text-muted">{n.by_name ?? "Staff"} · {fmtDate(n.created_at)}</div></li>)}
          {!notes.length && <li className="text-muted">No notes yet</li>}
        </ul>
      </Card>
    </>
  );
}
