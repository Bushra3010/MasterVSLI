import {
  Briefcase,
  FileText,
  Fingerprint,
  GraduationCap,
  Heart,
  History,
  Home,
  IndianRupee,
  MonitorPlay,
  Phone,
  ShieldCheck,
  User,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card, Field, Progress, StatusBadge } from "@/components/ui";
import { fmtDate, inr, titleCase } from "@/lib/format";
import { DOC_KINDS, docFileName, type Channel, type StudentDocument, type StudentProfile } from "@/lib/types";

const channelMeta: Record<Channel, { label: string; icon: ReactNode }> = {
  zoom: { label: "Zoom (live class)", icon: <Video size={15} /> },
  teamviewer: { label: "TeamViewer (recorded)", icon: <MonitorPlay size={15} /> },
  biometric: { label: "Biometric (offline)", icon: <Fingerprint size={15} /> },
  placement: { label: "Placement applications", icon: <Briefcase size={15} /> },
  portal: { label: "Training portal & materials", icon: <GraduationCap size={15} /> },
};

/**
 * Full student profile. `controls` lets the staff page inject admin actions per access channel;
 * the student portal renders it read-only.
 */
export function StudentProfileView({
  p,
  channelControl,
  paymentControl,
  documentControl,
  uploadSlot,
  receiptBase = "/fees/receipt/",
}: {
  receiptBase?: string;
  p: StudentProfile;
  channelControl?: (channel: Channel, enabled: boolean) => ReactNode;
  paymentControl?: (installmentId: string, balance: number) => ReactNode;
  documentControl?: (doc: StudentDocument) => ReactNode;
  uploadSlot?: ReactNode;
}) {
  const resume = p.documents.find((d) => d.kind === "resume");
  const s = p.student;
  const pr = s.professional ?? {};
  const yesNo = (v?: boolean) => (v ? "Yes" : "No");

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card title="Personal information" icon={<User size={15} />}>
        <dl>
          <Field label="Full name" value={s.full_name} />
          <Field label="Date of birth" value={fmtDate(s.dob)} />
          <Field label="Gender" value={s.gender} />
          <Field label="Marital status" value={s.marital_status} />
          <Field label="Blood group" value={s.blood_group} />
          <Field label="Nationality" value={s.nationality} />
          <Field label="Languages" value={s.languages?.join(", ")} />
          <Field label="Native place" value={s.native_place} />
        </dl>
      </Card>

      <Card title="Contact information" icon={<Phone size={15} />}>
        <dl>
          <Field label="Primary mobile" value={s.phone} />
          <Field label="Alternate mobile" value={s.alt_phone} />
          <Field label="Email" value={s.email} />
          <Field label="Alternate email" value={s.alt_email} />
          <Field label="LinkedIn" value={s.linkedin} />
          <Field label="Resume" value={resume ? <a href={`/api/documents/${resume.id}`} target="_blank" className="text-navy underline">View resume</a> : s.resume_url ? <a href={s.resume_url} target="_blank" className="text-navy underline">View resume</a> : null} />
        </dl>
      </Card>

      <Card title="Address" icon={<Home size={15} />}>
        <dl>
          <Field label="Address" value={s.address?.line} />
          <Field label="City" value={s.address?.city} />
          <Field label="District" value={s.address?.district} />
          <Field label="State" value={s.address?.state} />
          <Field label="PIN code" value={s.address?.pincode} />
        </dl>
      </Card>

      <Card title="Family & emergency" icon={<Users size={15} />}>
        <dl>
          <Field label="Father" value={s.family?.father_name} />
          <Field label="Occupation" value={s.family?.father_occupation} />
          <Field label="Father mobile" value={s.family?.father_phone} />
          <Field label="Mother" value={s.family?.mother_name} />
          <Field label="Occupation" value={s.family?.mother_occupation} />
          <Field label="Mother mobile" value={s.family?.mother_phone} />
          <Field label="Emergency contact" value={s.emergency?.phone ? `${s.emergency.name ?? ""} (${s.emergency.relation ?? ""}) · ${s.emergency.phone}` : null} />
        </dl>
      </Card>

      <Card title="Spouse details" icon={<Heart size={15} />}>
        {s.marital_status === "Married" ? (
          <dl>
            <Field label="Name" value={s.spouse?.name} />
            <Field label="Occupation" value={s.spouse?.occupation} />
            <Field label="Mobile" value={s.spouse?.phone} />
          </dl>
        ) : (
          <p className="text-sm text-muted">Not applicable ({s.marital_status ?? "—"})</p>
        )}
      </Card>

      <Card title="Course & admission" icon={<GraduationCap size={15} />}>
        <dl>
          <Field label="Course" value={p.course?.name} />
          <Field label="Batch" value={p.batch?.name} />
          <Field label="Training mode" value={titleCase(s.training_mode)} />
          <Field label="Admission date" value={fmtDate(s.admission_date)} />
          <Field label="Duration" value={p.course ? `${p.course.duration_months} months` : null} />
          <Field label="Course fee" value={inr(s.total_fee)} />
          <Field label="Payment plan" value={s.payment_plan} />
          <Field label="Valid until" value={fmtDate(s.validity_end)} />
          <Field label="Referred by" value={s.referred_by} />
          <Field label="Lead source" value={s.lead_source} />
        </dl>
      </Card>

      <Card title="Educational details" icon={<GraduationCap size={15} />} className="xl:col-span-3" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Qualification</th><th>Institution / college</th><th>Board / university</th><th>Stream</th><th>Year</th><th>Score</th><th>Location</th></tr>
          </thead>
          <tbody>
            {p.education.map((e) => (
              <tr key={e.id}>
                <td className="font-medium">{e.level}</td><td>{e.institution}</td><td>{e.board}</td><td>{e.stream}</td>
                <td>{e.year_of_passing}</td><td>{e.score}</td><td>{e.location}</td>
              </tr>
            ))}
            {!p.education.length && <tr><td colSpan={7} className="text-center text-muted">No records</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Professional & placement" icon={<Briefcase size={15} />}>
        <dl>
          <Field label="Working status" value={pr.working_status} />
          <Field label="Current company" value={pr.company} />
          <Field label="Total experience" value={pr.total_exp} />
          <Field label="Relevant experience" value={pr.relevant_exp} />
          <Field label="Current CTC" value={pr.current_ctc} />
          <Field label="Expected CTC" value={pr.expected_ctc} />
          <Field label="Notice period" value={pr.notice_period} />
          <Field label="Preferred location" value={pr.preferred_location} />
          <Field label="Willing to relocate" value={yesNo(pr.relocate)} />
          <Field label="Interview mode" value={pr.interview_mode} />
          <Field label="Placement consent" value={yesNo(s.placement_consent)} />
          <Field label="Placement eligible" value={s.placement_eligible ? <Badge tone="green">Eligible</Badge> : <Badge>Not yet</Badge>} />
        </dl>
      </Card>

      <Card title="Training access & attendance" icon={<ShieldCheck size={15} />}>
        <ul className="space-y-2">
          {p.access
            .sort((a, b) => Object.keys(channelMeta).indexOf(a.channel) - Object.keys(channelMeta).indexOf(b.channel))
            .map((a) => (
              <li key={a.channel} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  {channelMeta[a.channel].icon}
                  {channelMeta[a.channel].label}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={a.enabled ? "green" : "red"}>{a.enabled ? "Active" : "Blocked"}</Badge>
                  {channelControl?.(a.channel, a.enabled)}
                </span>
              </li>
            ))}
        </ul>
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex justify-between text-sm">
            <span>Attendance (30 days)</span>
            <span className="font-semibold tabular-nums">{p.attendance.pct}%</span>
          </div>
          <div className="mt-1"><Progress value={p.attendance.pct} /></div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <Badge tone="blue">Zoom {p.attendance.bySource.zoom}</Badge>
            <Badge tone="violet">TeamViewer {p.attendance.bySource.teamviewer}</Badge>
            <Badge tone="slate">Biometric {p.attendance.bySource.biometric}</Badge>
          </div>
        </div>
      </Card>

      <Card title="Fee & payment summary" icon={<IndianRupee size={15} />}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 p-2"><div className="text-[11px] text-muted">Total</div><div className="font-semibold tabular-nums">{inr(p.fee.total)}</div></div>
          <div className="rounded-lg bg-emerald-50 p-2"><div className="text-[11px] text-muted">Paid</div><div className="font-semibold tabular-nums text-emerald-700">{inr(p.fee.paid)}</div></div>
          <div className="rounded-lg bg-red-50 p-2"><div className="text-[11px] text-muted">Balance</div><div className="font-semibold tabular-nums text-brand">{inr(p.fee.balance)}</div></div>
        </div>
        <div className="mt-2 text-xs text-muted">Next due: {fmtDate(p.fee.next_due)}</div>
        <div className="mt-3 space-y-3">
          {p.allocations.map((a) => (
            <div key={a.id} className="rounded-lg border border-line p-2">
              <div className="flex justify-between text-sm font-medium">
                <span>{a.vendor?.name}</span>
                <span className="tabular-nums">{inr(a.amount)}</span>
              </div>
              <ul className="mt-1 space-y-1">
                {p.installments
                  .filter((i) => i.allocation_id === a.id)
                  .map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                      <span>
                        #{i.seq} · {fmtDate(i.due_date)} · {i.sub_vendor?.name ?? "Direct"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="tabular-nums">{inr(i.paid_amount)}/{inr(i.amount)}</span>
                        <StatusBadge status={i.status} />
                        {i.status !== "paid" && paymentControl?.(i.id, Number(i.amount) - Number(i.paid_amount))}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        {p.payments.length > 0 && (
          <div className="mt-3 border-t border-line pt-2">
            <div className="mb-1 text-xs font-medium text-navy">Payments &amp; receipts</div>
            <ul className="space-y-1">
              {p.payments.map((pay) => (
                <li key={pay.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{fmtDate(pay.paid_at)} · {pay.mode} · <b className="tabular-nums">{inr(pay.amount)}</b></span>
                  <Link href={`${receiptBase}${pay.id}`} className="font-medium text-brand hover:underline">Receipt</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="Company applications" icon={<Briefcase size={15} />} bodyClass="p-0">
        <table className="table">
          <thead><tr><th>Company</th><th>Role</th><th>Response</th><th>Stage</th></tr></thead>
          <tbody>
            {p.responses.map((r) => (
              <tr key={r.drive_id}>
                <td className="font-medium">{r.drive.company}</td>
                <td className="text-xs">{r.drive.job_role}</td>
                <td><StatusBadge status={r.response} /></td>
                <td className="text-xs">{r.stage ?? "—"}</td>
              </tr>
            ))}
            {!p.responses.length && <tr><td colSpan={4} className="text-center text-muted">No applications</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Letters & certificates" icon={<FileText size={15} />}>
        <ul className="space-y-1.5 text-sm">
          {p.letters.map((l) => (
            <li key={l.id} className="flex justify-between gap-2">
              <Link href={`/documents/${l.serial_no}`} className="text-navy hover:text-brand">{titleCase(l.template)}</Link>
              <span className="font-mono text-xs text-muted">{l.serial_no}</span>
            </li>
          ))}
          {!p.letters.length && <li className="text-muted">None issued yet</li>}
        </ul>
      </Card>

      <Card title="Documents" icon={<FileText size={15} />}>
        <ul className="space-y-2 text-sm">
          {p.documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <a href={`/api/documents/${d.id}`} target="_blank" className="font-medium text-navy hover:text-brand">{DOC_KINDS[d.kind] ?? d.kind}</a>
                <span className="block truncate text-xs text-muted">{docFileName(d.storage_path)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge tone={d.verified ? "green" : "amber"}>{d.verified ? "Verified" : "Pending"}</Badge>
                {documentControl?.(d)}
              </span>
            </li>
          ))}
          {!p.documents.length && <li className="text-muted">No documents uploaded</li>}
        </ul>
        {uploadSlot}
      </Card>

      <Card title="Access history" icon={<History size={15} />}>
        <ul className="space-y-1.5 text-sm">
          {p.events.slice(0, 8).map((e) => (
            <li key={e.id} className="flex justify-between gap-2">
              <span><span className="font-medium capitalize">{e.action}</span>{e.reason ? ` — ${e.reason}` : ""}</span>
              <span className="text-xs whitespace-nowrap text-muted">{fmtDate(e.created_at)}</span>
            </li>
          ))}
          {!p.events.length && <li className="text-muted">No changes</li>}
        </ul>
      </Card>
    </div>
  );
}
