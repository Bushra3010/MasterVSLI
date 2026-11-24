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
import { APPLICATION_STATUSES, DOC_KINDS, docFileName, EDU_ALIASES, EDU_ROWS, type Channel, type StudentApplication, type StudentDocument, type StudentProfile, type TpoContact } from "@/lib/types";

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
  applications = [],
  applicationSlot,
  applicationControl,
  collegeContacts,
  attendanceHref,
}: {
  receiptBase?: string;
  applications?: StudentApplication[];
  applicationSlot?: ReactNode;
  applicationControl?: (a: StudentApplication) => ReactNode;
  collegeContacts?: TpoContact[];
  attendanceHref?: string;
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
  const x = s.extra ?? {};
  const ref = (c: Channel) => p.access.find((a) => a.channel === c)?.external_ref;
  const wa = (on?: boolean) => (on ? <span className="ml-1 rounded bg-emerald-50 px-1 text-[10px] font-medium text-emerald-700">WhatsApp</span> : null);
  const fmtAddr = (a?: { line?: string; city?: string; district?: string; state?: string; pincode?: string }) => [a?.line, a?.city, a?.district, a?.state, a?.pincode].filter(Boolean).join(", ");
  const months = Number(p.course?.validity_months ?? 0);
  const comp = Number(x.complementary_months ?? 0);
  const eduLabel = (level: string) => EDU_ROWS.find((r) => r.key === level || r.key === EDU_ALIASES[level])?.label ?? level;
  const statusLabel = (st: string) => APPLICATION_STATUSES.find(([k]) => k === st)?.[1] ?? st;

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

      <Card title="Contact & access information" icon={<Phone size={15} />}>
        <dl>
          <Field label="Primary mobile" value={s.phone ? <>{s.phone}{wa(x.phone_whatsapp ?? true)}</> : null} />
          <Field label="Alternate mobile" value={s.alt_phone ? <>{s.alt_phone}{wa(x.alt_whatsapp)}</> : null} />
          <Field label="Email" value={s.email} />
          <Field label="Alternate email" value={s.alt_email} />
          <Field label="LinkedIn" value={s.linkedin} />
          <Field label="Zoom email ID" value={ref("zoom")} />
          <Field label="Biometric ID no." value={ref("biometric")} />
          <Field label="TeamViewer ID" value={ref("teamviewer")} />
          <Field label="Attendance" value={attendanceHref ? <a href={attendanceHref} className="text-navy underline">{p.attendance.pct}% · View</a> : `${p.attendance.pct}% (30 days)`} />
          {x.admin_contact && <Field label="Admin contact no." value={x.admin_contact} />}
          <Field label="Resume" value={resume ? <a href={`/api/documents/${resume.id}`} target="_blank" className="text-navy underline">View resume</a> : s.resume_url ? <a href={s.resume_url} target="_blank" className="text-navy underline">View resume</a> : null} />
        </dl>
      </Card>

      <Card title="Address information" icon={<Home size={15} />}>
        <dl>
          <Field label="Permanent address" value={fmtAddr(s.address) || null} />
          <Field label="Current address" value={x.current_same !== false ? <span className="text-emerald-700">✓ Same as permanent</span> : fmtAddr(x.current_address) || null} />
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
          <Field label="Category" value={s.category === "college" ? "College student (via TPO)" : s.category === "corporate" ? "Corporate student" : "Normal student (retail)"} />
          <Field label="Course" value={p.course?.name} />
          <Field label="Batch" value={p.batch?.name} />
          <Field label="Training mode" value={titleCase(s.training_mode)} />
          <Field label="Admission date" value={fmtDate(s.admission_date)} />
          <Field label="Course duration" value={p.course ? `${p.course.duration_months} months` : null} />
          <Field label="Complementary duration" value={comp ? `${comp} months` : "—"} />
          <Field label="Total validity" value={months ? `${months + comp} months (${x.validity_type === "extendable" ? "extendable" : "fixed"})` : null} />
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
            <tr><th>Level</th><th>Board / university</th><th>Stream / course</th><th>College / school</th><th>Duration</th><th>Year of passing</th><th>% / CGPA</th><th>State</th></tr>
          </thead>
          <tbody>
            {[...p.education].sort((a, b) => EDU_ROWS.findIndex((r) => r.key === (EDU_ALIASES[a.level] ?? a.level)) - EDU_ROWS.findIndex((r) => r.key === (EDU_ALIASES[b.level] ?? b.level))).map((e) => (
              <tr key={e.id}>
                <td className="font-medium">{eduLabel(e.level)}</td><td>{e.board}</td><td>{e.stream}</td><td>{e.institution}</td>
                <td className="whitespace-nowrap">{e.start_year || e.end_year ? `${e.start_year ?? "?"} – ${e.end_year ?? "?"}` : "—"}</td>
                <td>{e.year_of_passing}</td><td>{e.score}</td><td>{e.state ?? e.location}</td>
              </tr>
            ))}
            {!p.education.length && <tr><td colSpan={8} className="text-center text-muted">No records</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Professional information" icon={<Briefcase size={15} />}>
        <div className="mb-1 text-[11px] font-semibold text-muted uppercase">(A) Before joining MasterVLSI</div>
        <dl>
          <Field label="Working status" value={pr.working_status} />
          <Field label="Company" value={pr.company} />
          <Field label="Designation" value={x.before?.designation} />
          <Field label="Designation (sponsoring company)" value={x.company_designation} />
          <Field label="Experience" value={[pr.total_exp, pr.relevant_exp && `${pr.relevant_exp} relevant`].filter(Boolean).join(" · ") || null} />
          <Field label="From – to" value={x.before?.from || x.before?.to ? `${x.before?.from ?? "?"} – ${x.before?.to ?? "?"}` : null} />
          <Field label="Job location" value={x.before?.location} />
          <Field label="Current CTC" value={pr.current_ctc} />
          <Field label="Expected CTC" value={pr.expected_ctc} />
          <Field label="Notice period" value={pr.notice_period} />
          <Field label="Preferred location" value={pr.preferred_location} />
          <Field label="Willing to relocate" value={yesNo(pr.relocate)} />
          <Field label="Interview mode" value={pr.interview_mode} />
          <Field label="Placement consent" value={yesNo(s.placement_consent)} />
          <Field label="Placement eligible" value={s.placement_eligible ? <Badge tone="green">Eligible</Badge> : <Badge>Not yet</Badge>} />
        </dl>
        <div className="mt-3 mb-1 border-t border-line pt-2 text-[11px] font-semibold text-muted uppercase">(B) After joining MasterVLSI — placement</div>
        <dl>
          <Field label="Status" value={x.placement?.status} />
          <Field label="Company" value={x.placement?.company} />
          <Field label="Designation" value={x.placement?.designation} />
          <Field label="Package (CTC)" value={x.placement?.package} />
          <Field label="Date of joining" value={x.placement?.doj ? fmtDate(x.placement.doj) : null} />
          <Field label="HR POC" value={x.placement?.hr_name ? `${x.placement.hr_name}${x.placement.hr_email ? ` · ${x.placement.hr_email}` : ""}` : null} />
          <Field label="Job location" value={x.placement?.location} />
        </dl>
      </Card>

      {collegeContacts && (
        <Card title="College details — key contacts" icon={<Users size={15} />}>
          <table className="table text-[13px]">
            <thead><tr><th>Position</th><th>Name</th><th>Mobile</th><th>Email</th></tr></thead>
            <tbody>
              {collegeContacts.map((c) => <tr key={c.id}><td className="font-medium">{c.designation ?? "—"}</td><td>{c.name}</td><td>{c.phone ?? "—"}</td><td className="text-xs">{c.email ?? "—"}</td></tr>)}
              {!collegeContacts.length && <tr><td colSpan={4} className="text-center text-muted">No contacts yet — add TPO / HOD / Principal in Edit profile</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

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

      <Card title="Company applications & interview tracking" icon={<Briefcase size={15} />} className="xl:col-span-3" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>#</th><th>Company</th><th>Applied on</th><th>Rounds</th><th>Status</th><th>Package</th><th>DOJ</th><th>HR POC</th><th>Job location</th>{applicationControl && <th />}</tr></thead>
          <tbody>
            {applications.map((a, i) => (
              <tr key={a.id}>
                <td>{i + 1}</td>
                <td className="font-medium">{a.company}{a.role && <div className="text-[11px] font-normal text-muted">{a.role}</div>}</td>
                <td className="whitespace-nowrap">{fmtDate(a.applied_on)}</td>
                <td>{a.rounds}</td>
                <td><Badge tone={a.status === "rejected" ? "red" : a.status === "placed" || a.status === "selected" ? "green" : a.status === "shortlisted" ? "blue" : "amber"}>{statusLabel(a.status)}</Badge></td>
                <td>{a.package ?? "—"}</td>
                <td className="whitespace-nowrap">{a.doj ? fmtDate(a.doj) : "—"}</td>
                <td className="text-xs">{a.hr_name ? <>{a.hr_name}{a.hr_email && <div className="text-muted">{a.hr_email}</div>}</> : "—"}</td>
                <td>{a.job_location ?? "—"}</td>
                {applicationControl && <td>{applicationControl(a)}</td>}
              </tr>
            ))}
            {p.responses.map((r) => (
              <tr key={`drive-${r.drive_id}`} className="text-muted">
                <td>·</td>
                <td className="font-medium text-ink">{r.drive.company}<div className="text-[11px] font-normal">{r.drive.job_role} · placement drive</div></td>
                <td className="whitespace-nowrap">{r.updated_at ? fmtDate(r.updated_at) : "—"}</td>
                <td>—</td>
                <td><StatusBadge status={r.response} /> {r.stage && <span className="text-xs">{r.stage}</span>}</td>
                <td colSpan={applicationControl ? 5 : 4}>{r.drive.ctc ?? ""}</td>
              </tr>
            ))}
            {!applications.length && !p.responses.length && <tr><td colSpan={10} className="text-center text-muted">No applications yet</td></tr>}
          </tbody>
        </table>
        {applicationSlot}
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
