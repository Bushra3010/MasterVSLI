import "server-only";
import Image from "next/image";
import { headers } from "next/headers";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import { fmtDate, inr } from "@/lib/format";
import { templateMeta } from "@/lib/letters";
import type { Repo } from "@/lib/repo";
import type { Course, Letter, Staff, Student } from "@/lib/types";

const INSTITUTE = {
  name: "MasterVLSI",
  tagline: "Leader in Semiconductor Industry Training",
  address: "Bengaluru, Karnataka, India",
  email: "info@mastervlsi.com",
  web: "www.mastervlsi.com",
};

export async function loadLetter(repo: Repo, serial: string) {
  const letter = await repo.letter(serial);
  if (!letter) return null;
  const [profile, staff] = await Promise.all([
    letter.student_id ? repo.profile(letter.student_id) : null,
    letter.staff_id ? repo.staff().then((s) => s.find((x) => x.id === letter.staff_id) ?? null) : null,
  ]);
  const h = await headers();
  // APP_URL (runtime, optional) pins a custom domain; otherwise use the host the request came in on.
  const proto = h.get("x-forwarded-proto") ?? (h.get("host")?.startsWith("localhost") ? "http" : "https");
  const base = process.env.APP_URL || `${proto}://${h.get("host")}`;
  const verifyUrl = `${base}/verify/${letter.serial_no}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 220, color: { dark: "#0f2a4a" } });
  return { letter, student: profile?.student ?? null, course: profile?.course ?? null, staff, verifyUrl, qr };
}

function Body({ l, s, c, st }: { l: Letter; s: Student | null; c: Course | null; st: Staff | null }) {
  const d = l.data;
  const name = s?.full_name ?? st?.full_name ?? "—";
  const p = (children: ReactNode) => <p className="mb-3 leading-relaxed">{children}</p>;
  switch (l.template) {
    case "admission_confirmation":
      return <>{p(<>Dear {name},</>)}{p(<>We are pleased to confirm your admission to <b>{c?.name}</b> at {INSTITUTE.name}, enrollment number <b>{s?.enrollment_no}</b>, effective {fmtDate(s?.admission_date)}.</>)}{p(<>Your course runs for {c?.duration_months} months in <b>{s?.training_mode}</b> mode, and your training access is valid until <b>{fmtDate(s?.validity_end)}</b>. The total course fee is {inr(s?.total_fee ?? 0)}.</>)}{p(<>Welcome to the MasterVLSI family.</>)}</>;
    case "internship_offer":
      return <>{p(<>Dear {name},</>)}{p(<>We are pleased to offer you an internship as <b>{d.role || "Intern"}</b> in the {d.department || "Technology"} department from <b>{fmtDate(d.start)}</b>{d.end ? <> to <b>{fmtDate(d.end)}</b></> : null}.</>)}{p(<>We look forward to working with you.</>)}</>;
    case "internship_completion":
      return <>{p(<>This is to certify that <b>{name}</b> has successfully completed an internship as <b>{d.role || "Intern"}</b> with {INSTITUTE.name} from {fmtDate(d.start)} to {fmtDate(d.end)}.</>)}{p(<>During the internship we found them sincere, hard-working and technically sound. We wish them the best in their future endeavours.</>)}</>;
    case "placement_confirmation":
      return <>{p(<>Dear {name},</>)}{p(<>Congratulations! We are delighted to confirm your placement with <b>{d.company}</b> as <b>{d.role}</b>{d.ctc ? <> at a CTC of <b>{d.ctc}</b></> : null}{d.joining ? <>, joining on {fmtDate(d.joining)}</> : null}.</>)}{p(<>This achievement reflects your hard work during the {c?.name} programme.</>)}</>;
    case "staff_offer":
      return <>{p(<>Dear {name},</>)}{p(<>We are pleased to offer you the position of <b>{d.position || st?.designation}</b> at {INSTITUTE.name}, with an annual CTC of <b>{d.ctc}</b>, effective <b>{fmtDate(d.joining || st?.joining_date)}</b>.</>)}{p(<>Please sign and return a copy of this letter as your acceptance.</>)}</>;
    case "service_agreement":
      return <>{p(<>This Service Agreement is made between <b>{INSTITUTE.name}</b> (“the Organization”) and <b>{name}</b> (“the Employee”), {st?.designation}, for a term of <b>{d.term || "24 months"}</b> from {fmtDate(st?.joining_date)}.</>)}{p(<>The Employee agrees to the duties, compensation, confidentiality and other terms described in the Organization’s policies for the duration of employment.</>)}</>;
    case "experience_letter":
      return <>{p(<>This is to certify that <b>{name}</b> was employed with {INSTITUTE.name} as <b>{st?.designation}</b> in the {st?.department} department from {fmtDate(st?.joining_date)} to {fmtDate(d.relieving)}.</>)}{p(<>During this tenure, they were dedicated, sincere and competent. We wish them success in all future endeavours.</>)}</>;
    default:
      return null;
  }
}

type LetterProps = NonNullable<Awaited<ReturnType<typeof loadLetter>>>;

/** Letters keep the institute's own red/navy branding, independent of the app theme. */
export function LetterView(props: LetterProps) {
  return (
    <div className="brand-classic">
      <LetterBody {...props} />
    </div>
  );
}

function LetterBody({ letter: l, student: s, course: c, staff: st, qr, verifyUrl }: LetterProps) {
  const title = templateMeta(l.template)?.title ?? l.template;
  const name = s?.full_name ?? st?.full_name ?? "—";
  const Footer = (
    <div className="mt-8 flex items-end justify-between">
      <div>
        <div className="h-10 w-40 border-b border-slate-400" />
        <div className="mt-1 text-xs text-muted">Authorized Signatory</div>
      </div>
      <div className="text-right">
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR */}
        <img src={qr} alt="Verification QR code" className="ml-auto size-20" />
        <div className="mt-1 font-mono text-[10px] text-muted">{l.serial_no}</div>
      </div>
    </div>
  );
  const Header = (
    <div className="flex items-center justify-between border-b-4 border-brand pb-3">
      <Image src="/logo-official.png" alt="MasterVLSI — Leader In Semiconductor Industry" width={240} height={57} unoptimized priority className="h-14 w-auto" />
      <div className="text-right text-[11px] text-muted">{INSTITUTE.address}<br />{INSTITUTE.email} · {INSTITUTE.web}</div>
    </div>
  );

  if (l.template === "training_certificate")
    return (
      <div className="mx-auto aspect-[1.414] w-full max-w-4xl border-[10px] border-double border-amber-500 bg-gradient-to-br from-white to-amber-50 p-10 text-center">
        <Image src="/logo-official.png" alt="MasterVLSI — Leader In Semiconductor Industry" width={320} height={76} unoptimized priority className="mx-auto h-20 w-auto" />
        <div className="mt-2 text-4xl font-serif tracking-wide text-navy">Certificate of Completion</div>
        <div className="mt-6 text-sm text-muted">This is to certify that</div>
        <div className="mt-2 text-3xl font-semibold text-brand">{name}</div>
        <div className="mt-4 text-sm">has successfully completed the training programme</div>
        <div className="mt-1 text-xl font-semibold text-navy">{c?.name}</div>
        {(l.data.start || l.data.end) && (
          <div className="mt-1 text-sm">
            {l.data.start && l.data.end ? <>from <b>{fmtDate(l.data.start)}</b> to <b>{fmtDate(l.data.end)}</b></> : l.data.start ? <>from <b>{fmtDate(l.data.start)}</b></> : <>completed on <b>{fmtDate(l.data.end)}</b></>}
          </div>
        )}
        <div className="mt-2 text-sm text-muted">Enrollment {s?.enrollment_no}{l.data.grade ? ` · Grade ${l.data.grade}` : ""} · Issued {fmtDate(l.issued_at)}</div>
        <div className="mx-auto mt-6 max-w-2xl text-left">{Footer}</div>
        <div className="mt-2 text-[10px] text-muted">Verify at {verifyUrl}</div>
      </div>
    );

  if (l.template === "student_id_card" || l.template === "visiting_card")
    return (
      <div className="mx-auto w-[340px] overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
        <div className="flex items-center gap-2 border-b-4 border-navy bg-white p-3">
          <Image src="/logo-official.png" alt="MasterVLSI — Leader In Semiconductor Industry" width={170} height={40} unoptimized className="h-9 w-auto" />
          <div className="ml-auto rounded bg-navy px-2 py-0.5 text-[10px] text-white uppercase">{l.template === "student_id_card" ? "Student ID" : "Visiting card"}</div>
        </div>
        <div className="flex gap-3 p-4">
          <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-navy-soft text-2xl font-semibold text-navy">
            {name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-navy">{name}</div>
            <div className="text-xs text-muted">{l.data.designation || c?.name}</div>
            <div className="mt-2 text-xs">{s?.enrollment_no}</div>
            <div className="text-xs">{s?.phone}</div>
            <div className="truncate text-xs">{s?.email}</div>
            {l.template === "student_id_card" && <div className="text-xs">Valid till {fmtDate(s?.validity_end)}</div>}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          <span className="font-mono text-[10px] text-muted">{l.serial_no}</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR */}
          <img src={qr} alt="QR" className="size-12" />
        </div>
      </div>
    );

  if (l.template === "payslip") {
    const n = (k: string) => Number(l.data[k] || 0);
    const salary = st?.monthly_salary ?? 0;
    const basic = n("basic") || Math.round(salary * 0.5);
    const hra = n("hra") || Math.round(salary * 0.2);
    const other = n("allowances") || salary - basic - hra;
    const pf = n("pf") || Math.round(basic * 0.12);
    const tax = n("tax") || 200;
    const gross = basic + hra + other;
    return (
      <div className="mx-auto max-w-3xl bg-white p-8 shadow-sm">
        {Header}
        <h1 className="my-4 text-center text-lg font-semibold text-navy">Payslip — {l.data.month || new Date(l.issued_at).toLocaleString("en-IN", { month: "long", year: "numeric" })}</h1>
        <div className="grid grid-cols-2 gap-x-6 text-sm">
          <div>Employee: <b>{name}</b></div><div>Employee ID: <b>{st?.employee_code}</b></div>
          <div>Designation: {st?.designation}</div><div>Department: {st?.department}</div>
        </div>
        <table className="table mt-4">
          <thead><tr><th>Earnings</th><th className="text-right">Amount</th><th>Deductions</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            <tr><td>Basic</td><td className="text-right">{inr(basic)}</td><td>PF</td><td className="text-right">{inr(pf)}</td></tr>
            <tr><td>HRA</td><td className="text-right">{inr(hra)}</td><td>Professional tax</td><td className="text-right">{inr(tax)}</td></tr>
            <tr><td>Other allowances</td><td className="text-right">{inr(other)}</td><td /><td /></tr>
            <tr className="font-semibold"><td>Gross earnings</td><td className="text-right">{inr(gross)}</td><td>Total deductions</td><td className="text-right">{inr(pf + tax)}</td></tr>
          </tbody>
        </table>
        <div className="mt-3 rounded bg-navy-soft p-3 text-right font-semibold text-navy">Net payable: {inr(gross - pf - tax)}</div>
        {Footer}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 shadow-sm">
      {Header}
      <div className="mt-6 flex justify-between text-sm text-muted">
        <span>Ref: {l.serial_no}</span>
        <span>Date: {fmtDate(l.issued_at)}</span>
      </div>
      <h1 className="my-6 text-center text-lg font-semibold tracking-wide text-navy uppercase">{title}</h1>
      <div className="text-[15px]"><Body l={l} s={s} c={c} st={st} /></div>
      <p className="mt-6">Regards,<br /><b>{INSTITUTE.name}</b></p>
      {Footer}
    </div>
  );
}
