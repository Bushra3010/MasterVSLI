import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/print-button";
import { addDays, fmtDate, inr, istTime, titleCase, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getStore } from "@/lib/session";
import { DOC_KINDS, docFileName, type AttendanceRecord } from "@/lib/types";

export const metadata = { title: "Student report" };

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mt-5 break-inside-avoid">
    <h2 className="mb-2 border-b-2 border-navy pb-1 text-sm font-semibold tracking-wide text-navy uppercase">{title}</h2>
    {children}
  </section>
);
const KV = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 print:grid-cols-2">
    {rows.map(([k, v]) => (
      <div key={k} className="flex gap-2 border-b border-line py-1 text-[13px]">
        <dt className="w-40 shrink-0 text-muted">{k}</dt>
        <dd className="font-medium">{v || "—"}</dd>
      </div>
    ))}
  </dl>
);

/** One student's complete report, laid out for printing / saving as PDF. */
export default async function StudentReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await (await getRepo()).profile(id);
  if (!p) notFound();
  const s = p.student;
  const since = addDays(todayISO(), -90);
  const att = (await (await getStore()).select<AttendanceRecord>("attendance_records", { eq: { student_id: id }, order: { column: "session_date", ascending: false } })).filter((a) => a.session_date >= since);
  const days = new Set(att.map((a) => a.session_date)).size;
  const minutes = att.reduce((a, r) => a + Number(r.duration_minutes || 0), 0);
  const pr = s.professional ?? {};
  const addr = [s.address?.line, s.address?.city, s.address?.district, s.address?.state, s.address?.pincode].filter(Boolean).join(", ");

  return (
    <div className="brand-classic">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/students/${id}`} className="text-sm text-muted hover:text-brand">← Back to profile</Link>
        <PrintButton label="Download PDF" />
      </div>
      <article className="mx-auto max-w-4xl rounded-[5px] border border-line bg-white p-8 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-brand pb-3">
          <Image src="/logo-full.svg" alt="MasterVLSI — Leader In Semiconductor Industry" width={240} height={60} unoptimized priority className="h-14 w-auto" />
          <div className="text-right">
            <div className="text-lg font-semibold text-navy">Student Report</div>
            <div className="text-xs text-muted">Generated {fmtDate(new Date().toISOString())} at {istTime(new Date().toISOString())} IST</div>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[5px] bg-slate-50 p-3">
          <div>
            <div className="text-xl font-semibold text-navy">{s.full_name}</div>
            <div className="text-sm text-muted">{s.enrollment_no} · {p.course?.name ?? "—"}{p.batch ? ` · ${p.batch.name}` : ""}</div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div><div className="text-[11px] text-muted">Status</div><div className="font-semibold">{titleCase(s.status)}</div></div>
            <div><div className="text-[11px] text-muted">Attendance (30 days)</div><div className="font-semibold">{p.attendance.pct}%</div></div>
            <div><div className="text-[11px] text-muted">Fee balance</div><div className={`font-semibold ${p.fee.balance > 0 ? "text-red-600" : "text-emerald-700"}`}>{inr(p.fee.balance)}</div></div>
          </div>
        </div>

        <Section title="Personal & contact">
          <KV rows={[
            ["Date of birth", fmtDate(s.dob)], ["Gender", s.gender], ["Blood group", s.blood_group], ["Marital status", s.marital_status],
            ["Mobile", s.phone], ["Alternate mobile", s.alt_phone], ["Email", s.email], ["LinkedIn", s.linkedin],
            ["Address", addr], ["Father", s.family?.father_name ? `${s.family.father_name}${s.family.father_phone ? ` · ${s.family.father_phone}` : ""}` : null],
            ["Mother", s.family?.mother_name], ["Emergency contact", s.emergency?.phone ? `${s.emergency.name ?? ""} (${s.emergency.relation ?? ""}) · ${s.emergency.phone}` : null],
          ]} />
        </Section>

        <Section title="Course & admission">
          <KV rows={[
            ["Course", p.course?.name], ["Batch", p.batch?.name], ["Training mode", titleCase(s.training_mode)], ["Admission date", fmtDate(s.admission_date)],
            ["Valid until", fmtDate(s.validity_end)], ["Course fee", inr(Number(s.total_fee))], ["Lead source", s.lead_source], ["Referred by", s.referred_by],
          ]} />
        </Section>

        {p.education.length > 0 && (
          <Section title="Education">
            <table className="table text-[13px]">
              <thead><tr><th>Qualification</th><th>Institution</th><th>Board / university</th><th>Stream</th><th>Year</th><th>Score</th></tr></thead>
              <tbody>{p.education.map((e) => <tr key={e.id}><td className="font-medium">{e.level}</td><td>{e.institution}</td><td>{e.board}</td><td>{e.stream}</td><td>{e.year_of_passing}</td><td>{e.score}</td></tr>)}</tbody>
            </table>
          </Section>
        )}

        <Section title="Professional & placement">
          <KV rows={[
            ["Working status", pr.working_status], ["Company", pr.company], ["Total experience", pr.total_exp], ["Expected CTC", pr.expected_ctc],
            ["Notice period", pr.notice_period], ["Preferred location", pr.preferred_location], ["Placement eligible", s.placement_eligible ? "Yes" : "No"], ["Placement consent", s.placement_consent ? "Yes" : "No"],
          ]} />
          {p.responses.length > 0 && (
            <table className="table mt-2 text-[13px]">
              <thead><tr><th>Company</th><th>Role</th><th>Response</th><th>Stage</th></tr></thead>
              <tbody>{p.responses.map((r) => <tr key={r.drive_id}><td className="font-medium">{r.drive.company}</td><td>{r.drive.job_role}</td><td className="capitalize">{r.response}</td><td>{r.stage ?? "—"}</td></tr>)}</tbody>
            </table>
          )}
        </Section>

        <Section title="Attendance (last 90 days)">
          <KV rows={[
            ["Attendance % (30 days)", `${p.attendance.pct}%`], ["Days present (90 days)", String(days)], ["Learning time (90 days)", `${Math.round(minutes / 60)} hours`],
            ["By source (30 days)", `Zoom ${p.attendance.bySource.zoom} · Recordings ${p.attendance.bySource.teamviewer} · Biometric ${p.attendance.bySource.biometric}`],
          ]} />
          {att.length > 0 ? (
            <table className="table mt-2 text-[12px]">
              <thead><tr><th>Date</th><th>Source</th><th>In (IST)</th><th>Out (IST)</th><th>Duration</th></tr></thead>
              <tbody>{att.map((a) => <tr key={a.id}><td>{fmtDate(a.session_date)}</td><td className="capitalize">{a.source === "teamviewer" ? "recording" : a.source}</td><td>{istTime(a.check_in)}</td><td>{istTime(a.check_out)}</td><td>{a.duration_minutes} min</td></tr>)}</tbody>
            </table>
          ) : <p className="mt-2 text-sm text-muted">No attendance in the last 90 days.</p>}
        </Section>

        <Section title="Fees">
          <KV rows={[["Total fee", inr(p.fee.total)], ["Paid", inr(p.fee.paid)], ["Balance", inr(p.fee.balance)], ["Next due", fmtDate(p.fee.next_due)]]} />
          <table className="table mt-2 text-[13px]">
            <thead><tr><th>#</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>{p.installments.map((i) => <tr key={i.id}><td>{i.seq}</td><td>{fmtDate(i.due_date)}</td><td>{inr(Number(i.amount))}</td><td>{inr(Number(i.paid_amount))}</td><td className="capitalize">{i.status}</td></tr>)}</tbody>
          </table>
          {p.payments.length > 0 && (
            <table className="table mt-2 text-[13px]">
              <thead><tr><th>Paid on</th><th>Amount</th><th>Mode</th><th>Reference</th></tr></thead>
              <tbody>{p.payments.map((x) => <tr key={x.id}><td>{fmtDate(x.paid_at)}</td><td>{inr(Number(x.amount))}</td><td>{x.mode}</td><td>{x.reference ?? "—"}</td></tr>)}</tbody>
            </table>
          )}
        </Section>

        {(p.letters.length > 0 || p.documents.length > 0) && (
          <Section title="Letters & documents">
            <ul className="space-y-1 text-[13px]">
              {p.letters.map((l) => <li key={l.id}>{titleCase(l.template)} — <span className="font-mono">{l.serial_no}</span> · issued {fmtDate(l.issued_at)}</li>)}
              {p.documents.map((d) => <li key={d.id}>{DOC_KINDS[d.kind] ?? d.kind}: {docFileName(d.storage_path)} · {d.verified ? "verified" : "pending verification"}</li>)}
            </ul>
          </Section>
        )}

        <Section title="Training access">
          <p className="text-[13px]">{p.access.map((a) => `${a.channel === "teamviewer" ? "Recordings" : titleCase(a.channel)}: ${a.enabled ? "active" : "blocked"}`).join(" · ")}</p>
        </Section>

        <footer className="mt-8 flex items-end justify-between border-t border-line pt-3 text-[11px] text-muted">
          <span>MasterVLSI · Confidential student record</span>
          <span>Authorised signatory: ____________________</span>
        </footer>
      </article>
    </div>
  );
}
