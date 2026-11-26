import {
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Fingerprint,
  GraduationCap,
  Heart,
  History,
  Home,
  IndianRupee,
  Layers,
  MapPin,
  MonitorPlay,
  NotebookPen,
  Phone,
  Settings2,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProfilePhoto } from "@/components/profile-photo";
import { Badge, Progress, StatusBadge } from "@/components/ui";
import { daysBetween, fmtDate, inr, titleCase, todayISO } from "@/lib/format";
import { APPLICATION_STATUSES, DOC_KINDS, docFileName, EDU_ALIASES, EDU_ROWS, type Channel, type StudentApplication, type StudentDocument, type StudentProfile, type TpoContact } from "@/lib/types";

const channelMeta: Record<Channel, { label: string; icon: ReactNode }> = {
  zoom: { label: "Zoom (live class)", icon: <Video size={15} /> },
  teamviewer: { label: "TeamViewer (recorded)", icon: <MonitorPlay size={15} /> },
  biometric: { label: "Biometric (offline)", icon: <Fingerprint size={15} /> },
  placement: { label: "Placement applications", icon: <Briefcase size={15} /> },
  portal: { label: "Training portal & materials", icon: <GraduationCap size={15} /> },
};

/** Left-hand section menu, in page order. */
const NAV: [string, string, typeof User][] = [
  ["overview", "Profile Overview", Home],
  ["personal", "Personal Details", User],
  ["education", "Education Details", GraduationCap],
  ["family", "Family & Emergency", Users],
  ["college", "College Details", Building2],
  ["course", "Course & Admission", Layers],
  ["professional", "Professional Info", Briefcase],
  ["placement", "Placement & Interviews", ClipboardList],
  ["attendance", "Attendance & Access", ShieldCheck],
  ["fees", "Fee & Payments", IndianRupee],
  ["documents", "Documents", FileText],
  ["history", "Status & History", History],
  ["notes", "Notes & Remarks", NotebookPen],
];

const TAG = { improved: ["Improved", "bg-red-500"], new: ["New", "bg-red-500"], split: ["Split – Before & After MasterVLSI", "bg-red-500"] } as const;

function Sec({ id, title, icon, tag, actions, className = "", bodyClass = "p-3", children }: { id?: string; title: ReactNode; icon: ReactNode; tag?: keyof typeof TAG; actions?: ReactNode; className?: string; bodyClass?: string; children: ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-20 overflow-hidden rounded-[6px] border border-[#c7d6ef] bg-white shadow-sm ${className}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-[#d5e1f4] bg-gradient-to-r from-[#e8f0fc] via-[#f3f7fd] to-white px-3 py-2">
        <span className="text-orange-500 [&_svg]:size-[18px]">{icon}</span>
        <h2 className="text-[15px] font-semibold text-[#1d3c8f]">{title}</h2>
        {tag && <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${TAG[tag][1]}`}>{TAG[tag][0]}</span>}
        {actions && <span className="ml-auto">{actions}</span>}
      </header>
      <div className={`@container ${bodyClass}`}>{children}</div>
    </section>
  );
}

/** "Label : value" rows, as in the profile mock-up. */
function KV({ rows, className = "" }: { rows: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={`grid grid-cols-[minmax(0,auto)_auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-[13px] ${className}`}>
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="font-medium whitespace-nowrap text-[#1f2a44]">{k}</dt>
          <span className="text-muted">:</span>
          <dd className="min-w-0 [overflow-wrap:anywhere] text-[#334155]">{v === null || v === undefined || v === "" ? <span className="text-slate-400">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

const SubHead = ({ children }: { children: ReactNode }) => <div className="mb-1.5 rounded bg-[#dbe7fa] px-2 py-1 text-[12px] font-semibold text-[#1d3c8f]">{children}</div>;

const WA = () => (
  <span className="mr-1 inline-grid size-4 place-items-center rounded-full bg-emerald-500 align-[-3px] text-white" title="On WhatsApp">
    <Phone size={9} />
    <span className="sr-only">WhatsApp</span>
  </span>
);

/**
 * Full student profile, laid out like the "Student Profile (Enhanced)" mock-up.
 * Staff pass action slots (buttons, inline forms); the student portal renders it read-only.
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
  photoUrl,
  headerActions,
  masterSlot,
  notesSlot,
  collegeAction,
  branchName,
  validityMonths,
  improvements,
}: {
  p: StudentProfile;
  receiptBase?: string;
  applications?: StudentApplication[];
  applicationSlot?: ReactNode;
  applicationControl?: (a: StudentApplication) => ReactNode;
  collegeContacts?: TpoContact[];
  attendanceHref?: string;
  photoUrl?: string | null;
  headerActions?: ReactNode;
  /** Staff: inline master-data editor (branch, course, batch, mode, validity). */
  masterSlot?: ReactNode;
  notesSlot?: ReactNode;
  collegeAction?: ReactNode;
  branchName?: string | null;
  validityMonths?: number | null;
  /** Right-hand "Key Improvements / Additions" panel (staff view). */
  improvements?: ReactNode;
  channelControl?: (channel: Channel, enabled: boolean) => ReactNode;
  paymentControl?: (installmentId: string, balance: number) => ReactNode;
  documentControl?: (doc: StudentDocument) => ReactNode;
  uploadSlot?: ReactNode;
}) {
  const s = p.student;
  const pr = s.professional ?? {};
  const x = s.extra ?? {};
  const ref = (c: Channel) => p.access.find((a) => a.channel === c)?.external_ref;
  const addrLines = (a?: { line?: string; city?: string; district?: string; state?: string; pincode?: string }) => {
    const l = [a?.line, [a?.city, a?.district].filter(Boolean).join(", ") + (a?.pincode ? ` – ${a.pincode}` : ""), a?.state].filter((v) => v && v.trim());
    return l.length ? l : null;
  };
  const age = s.dob ? Math.floor(daysBetween(s.dob, todayISO()) / 365.25) : null;
  const courseMonths = Number(p.course?.duration_months ?? 0);
  const comp = Number(x.complementary_months ?? 0);
  const validity = Number(validityMonths ?? p.course?.validity_months ?? 0);
  const edu = (key: string) => p.education.find((e) => e.level === key || EDU_ALIASES[e.level] === key);
  const statusLabel = (st: string) => APPLICATION_STATUSES.find(([k]) => k === st)?.[1] ?? st;
  const lastPayment = p.payments[0];
  const permanent = addrLines(s.address);
  const current = x.current_same !== false ? null : addrLines(x.current_address);

  return (
    <div className={`grid gap-4 ${improvements ? "lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[12rem_minmax(0,1fr)_16.5rem]" : "lg:grid-cols-[13rem_minmax(0,1fr)]"}`}>
      {/* ---------- left: photo + section menu ---------- */}
      <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-[6px] border border-[#c7d6ef] bg-gradient-to-b from-[#eef4fd] to-white p-3 text-center shadow-sm">
          <ProfilePhoto src={photoUrl} name={s.full_name} className="mx-auto size-28 rounded-[6px] border border-line" />
          <div className="mt-2 text-[17px] font-semibold text-[#1d3c8f]">{s.full_name}</div>
          <div className="font-semibold text-navy">{s.enrollment_no}</div>
          {p.course && <div className="mt-1 inline-block rounded bg-[#dbe7fa] px-2 py-0.5 text-[11px] font-medium text-[#1d3c8f]">{p.course.name}</div>}
        </div>
        <nav aria-label="Profile sections" className="hidden rounded-[6px] border border-[#c7d6ef] bg-white p-1.5 shadow-sm lg:block">
          {NAV.map(([id, label, Icon], i) => (
            <a key={id} href={`#${id}`} className={`flex items-center gap-2.5 rounded-[5px] px-2.5 py-2 text-[13px] font-medium ${i === 0 ? "bg-orange-50 text-orange-600" : "text-[#1f2a44] hover:bg-slate-50 hover:text-brand"}`}>
              <Icon size={16} className={i === 0 ? "text-orange-500" : "text-[#1d3c8f]"} /> {label}
            </a>
          ))}
        </nav>
      </aside>

      {/* ---------- right: sections ---------- */}
      <div className="@container min-w-0 space-y-4">
        <div id="overview" className="scroll-mt-20 overflow-hidden rounded-[6px] bg-gradient-to-r from-[#14306f] to-[#1d4fb8] text-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <User size={22} />
            <h1 className="text-lg font-semibold">Student Profile</h1>
            <span className="ml-auto rounded bg-white px-2 py-1 text-xs font-semibold text-[#14306f]">Enrollment No: {s.enrollment_no}</span>
            <span className={`rounded px-2 py-1 text-xs font-semibold ${s.status === "active" ? "bg-emerald-500" : s.status === "expired" ? "bg-red-500" : "bg-amber-500"}`}>✓ {titleCase(s.status)}</span>
          </div>
          {headerActions && <div className="flex flex-wrap gap-2 border-t border-white/15 bg-white/5 px-4 py-2.5 [&_.btn-ghost]:bg-white [&_.btn-ghost]:text-navy">{headerActions}</div>}
        </div>

        <div className="grid gap-4 @xl:grid-cols-12">
          {/* row 1 */}
          <Sec id="personal" title="Personal Information" icon={<User />} className="@xl:col-span-6 @5xl:col-span-3">
            <KV rows={[
              ["Full Name", s.full_name],
              ["Date of Birth", s.dob ? <><span className="whitespace-nowrap">{fmtDate(s.dob)}</span>{age !== null && <span className="ml-3 whitespace-nowrap"><b className="font-medium text-[#1f2a44]">Age :</b> {age}</span>}</> : null],
              ["Gender", s.gender],
              ["Marital Status", s.marital_status],
              ["Blood Group", s.blood_group],
              ["Nationality", s.nationality],
              ["Languages", s.languages?.join(", ")],
              ["Native Place", s.native_place],
            ]} />
          </Sec>

          <Sec title="Contact & Access Information" icon={<Phone />} className="@xl:col-span-6 @5xl:col-span-6">
            <div className="grid gap-3 @md:grid-cols-2">
              <KV rows={[
                ["Primary Mobile", s.phone ? <span className="whitespace-nowrap">{(x.phone_whatsapp ?? true) && <WA />}{s.phone}</span> : null],
                ["Alternate Mobile", s.alt_phone ? <span className="whitespace-nowrap">{x.alt_whatsapp && <WA />}{s.alt_phone}</span> : null],
                ["Email (System)", s.email ? <span className="text-xs">{s.email}</span> : null],
                ...(s.alt_email ? [["Alternate Email", <span key="ae" className="text-xs">{s.alt_email}</span>] as [string, ReactNode]] : []),
                ["LinkedIn", s.linkedin ? <a href={s.linkedin.startsWith("http") ? s.linkedin : `https://${s.linkedin}`} target="_blank" rel="noreferrer" className="text-xs text-brand underline">{s.linkedin.replace(/^https?:\/\/(www\.)?/, "")}</a> : null],
                ["TeamViewer ID", ref("teamviewer")],
              ]} />
              <KV rows={[
                ["Zoom Email ID", ref("zoom") ? <span className="text-xs">{ref("zoom")}</span> : null],
                ["Biometric ID No", ref("biometric") ? <span className="whitespace-nowrap">{ref("biometric")}</span> : null],
                ["Attendance", attendanceHref ? <a href={attendanceHref} className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-brand underline"><CalendarDays size={14} /> View / Mark</a> : `${p.attendance.pct}%`],
                ["Admin Contact No", x.admin_contact],
              ]} />
            </div>
          </Sec>

          <Sec title="Address Information" icon={<MapPin />} className="@xl:col-span-12 @5xl:col-span-3">
            <div className="grid gap-x-4 @xl:grid-cols-2">
              <div>
            <SubHead>Permanent Address</SubHead>
            <div className="mb-3 text-[13px] text-[#334155]">{permanent ? permanent.map((l, i) => <div key={i}>{l}</div>) : <span className="text-slate-400">—</span>}</div>
              </div>
              <div>
            <SubHead>Current Address</SubHead>
            {current ? (
              <div className="text-[13px] text-[#334155]">{current.map((l, i) => <div key={i}>{l}</div>)}</div>
            ) : (
              <div className="flex items-center gap-2 rounded bg-emerald-50 px-2 py-1.5 text-[13px] font-semibold text-emerald-800">✓ Same as Permanent</div>
            )}
              </div>
            </div>
          </Sec>

          {/* row 2: master data */}
          <Sec id="master" title={<>Master Data <span className="text-[12px] font-normal text-[#1d3c8f]">(Admin – Add / Remove from Dropdown)</span></>} icon={<Settings2 />} className="@xl:col-span-12">
            {masterSlot ?? (
              <div className="grid gap-3 text-[13px] sm:grid-cols-3 lg:grid-cols-5">
                {[["Branch / Domain", branchName], ["Course", p.course?.name], ["Batch", p.batch?.name], ["Training Mode", titleCase(s.training_mode)], ["Validity (Months)", validity ? `${validity} Months` : null]].map(([l, v]) => (
                  <div key={l as string}><div className="mb-1 font-semibold text-[#1d3c8f]">{l}</div><div className="rounded border border-line bg-slate-50 px-2 py-1.5">{v ?? "—"}</div></div>
                ))}
              </div>
            )}
          </Sec>

          {/* row 3 */}
          <Sec id="family" title="Family & Emergency Information" icon={<Users />} tag="improved" className="@xl:col-span-12 @5xl:col-span-6">
            <div className="grid gap-3 @md:grid-cols-2">
              <div>
                <SubHead>Parents Details</SubHead>
                <KV rows={[
                  ["Father's Name", s.family?.father_name],
                  ["Occupation", s.family?.father_occupation],
                  ["Mobile", s.family?.father_phone],
                  ["Mother's Name", s.family?.mother_name],
                  ["Occupation", s.family?.mother_occupation],
                  ["Mobile", s.family?.mother_phone],
                ]} />
              </div>
              <div>
                <SubHead>Emergency Contact</SubHead>
                <KV rows={[
                  ["Contact Person", s.emergency?.name],
                  ["Mobile Number", s.emergency?.phone],
                  ["Relation", s.emergency?.relation ?? (s.emergency?.name ? null : <span className="text-red-500">(Blank – Student to Fill)</span>)],
                ]} />
              </div>
            </div>
          </Sec>

          <Sec title="Marital & Spouse Details" icon={<Heart />} className="@xl:col-span-6 @5xl:col-span-3">
            <KV rows={[
              ["Marital Status", s.marital_status],
              ...(s.marital_status === "Married"
                ? ([["Spouse Name", s.spouse?.name], ["Occupation", s.spouse?.occupation], ["Spouse Mobile", s.spouse?.phone]] as [string, ReactNode][])
                : ([["Spouse", <span key="na" className="text-muted">Not applicable</span>]] as [string, ReactNode][])),
            ]} />
          </Sec>

          <Sec title="Basic Course Status" icon={<BadgeCheck />} className="@xl:col-span-6 @5xl:col-span-3">
            <KV rows={[
              ["Student Status", <StatusBadge key="st" status={s.status} />],
              ["Profile Verified By", s.profile_verified_by ? <span className="font-medium text-emerald-700">{s.profile_verified_by}</span> : <span className="text-amber-700">Not verified</span>],
              ["Last Updated", fmtDate(s.updated_at ?? s.created_at)],
              ["Valid Till", fmtDate(s.validity_end)],
            ]} />
          </Sec>

          {/* row 4 */}
          <Sec id="education" title="Educational Details" icon={<GraduationCap />} tag="improved" className="@xl:col-span-12 @5xl:col-span-7" bodyClass="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-[12px] [&_td]:px-1.5 [&_th]:px-1.5">
              <thead>
                <tr className="bg-[#eef3fb] text-left text-[#1d3c8f]">
                  {["Level", "Board / University", "Stream / Course", "College / School", "Duration", "Year of Passing", "% / CGPA"].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {EDU_ROWS.map((r) => {
                  const e = edu(r.key);
                  return (
                    <tr key={r.key} className="border-t border-line">
                      <td className="px-2 py-1.5 font-semibold text-[#1f2a44]">{r.label}</td>
                      <td className="px-2 py-1.5">{e?.board ?? <span className="text-slate-400">({r.list === "university" ? "Select University" : "Select Board"})</span>}</td>
                      <td className="px-2 py-1.5">{e?.stream ?? (e ? "—" : <span className="text-slate-400">(Select Stream)</span>)}</td>
                      <td className="px-2 py-1.5">{e?.institution ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{e && (e.start_year || e.end_year) ? `${e.start_year ?? "?"} – ${e.end_year ?? "?"}` : "—"}</td>
                      <td className="px-2 py-1.5">{e?.year_of_passing ?? "—"}</td>
                      <td className="px-2 py-1.5">{e?.score ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Sec>

          <Sec id="college" title={<>College Details <span className="text-[12px] font-normal">(Add 2–3 Key Contacts)</span></>} icon={<Building2 />} tag="new" className="@xl:col-span-12 @5xl:col-span-5" bodyClass="overflow-x-auto">
            {s.category === "college" ? (
              <>
                <table className="w-full min-w-[26rem] text-[12.5px]">
                  <thead><tr className="bg-[#eef3fb] text-left text-[#1d3c8f]">{["Position", "Name", "Mobile", "Email"].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
                  <tbody>
                    {(collegeContacts ?? []).map((c) => (
                      <tr key={c.id} className="border-t border-line">
                        <td className="px-2 py-1.5 font-semibold">{c.designation ?? "—"}</td><td className="px-2 py-1.5">{c.name}</td><td className="px-2 py-1.5">{c.phone ?? "—"}</td><td className="px-2 py-1.5 text-xs">{c.email ?? "—"}</td>
                      </tr>
                    ))}
                    {!collegeContacts?.length && <tr><td colSpan={4} className="px-2 py-3 text-center text-muted">No contacts yet — add TPO / HOD / Principal.</td></tr>}
                  </tbody>
                </table>
                {collegeAction && <div className="p-2 text-center">{collegeAction}</div>}
              </>
            ) : (
              <p className="p-3 text-[13px] text-muted">Only for college students. This student is a {s.category === "corporate" ? "corporate" : "normal (retail)"} student.</p>
            )}
          </Sec>

          {/* row 5 */}
          <Sec id="course" title="Course & Admission Information" icon={<Layers />} tag="improved" className="@xl:col-span-5 @5xl:col-span-4">
            <KV rows={[
              ["Course Enrolled For", p.course?.name],
              ["Course Duration", courseMonths ? `${courseMonths} Months` : null],
              ["Complementary Duration", comp ? `${comp} Months` : "None"],
              ["Total Validity", validity ? `${validity + comp} Months` : null],
              ["Batch Name", p.batch?.name],
              ["Joining Date", fmtDate(s.admission_date)],
              ["Validity Type", x.validity_type === "extendable" ? "Extendable" : "Fixed (Months)"],
              ["Category", s.category === "college" ? "College student (via TPO)" : s.category === "corporate" ? "Corporate student" : "Normal student (retail)"],
              ["Referred By / Source", [s.referred_by, s.lead_source].filter(Boolean).join(" · ") || null],
            ]} />
          </Sec>

          <Sec id="professional" title="Professional Information" icon={<Briefcase />} tag="split" className="@xl:col-span-7 @5xl:col-span-8">
            <div className="grid gap-4 @lg:grid-cols-2">
              <div>
                <SubHead>(A) Before Joining MasterVLSI (After Graduation)</SubHead>
                <KV rows={[
                  ["Working Status", pr.working_status],
                  ["Company", pr.company],
                  ["Designation", x.before?.designation ?? x.company_designation],
                  ["Experience", [pr.total_exp, pr.relevant_exp && `${pr.relevant_exp} relevant`].filter(Boolean).join(" · ") || null],
                  ["From – To", x.before?.from || x.before?.to ? `${x.before?.from ?? "?"} – ${x.before?.to ?? "?"}` : null],
                  ["Job Location", x.before?.location],
                  ["Current / Expected CTC", [pr.current_ctc, pr.expected_ctc].filter(Boolean).join(" → ") || null],
                ]} />
              </div>
              <div>
                <SubHead>(B) After Joining MasterVLSI (Placement / Current)</SubHead>
                <KV rows={[
                  ["Working Status", x.placement?.status],
                  ["Company", x.placement?.company],
                  ["Designation", x.placement?.designation],
                  ["Package (CTC)", x.placement?.package],
                  ["Date of Joining", x.placement?.doj ? fmtDate(x.placement.doj) : null],
                  ["HR POC Name", x.placement?.hr_name],
                  ["HR POC Email", x.placement?.hr_email ? <span className="text-xs">{x.placement.hr_email}</span> : null],
                  ["Job Location", x.placement?.location],
                ]} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2 text-[11px]">
              <Badge tone={s.placement_consent ? "green" : "slate"}>Placement consent: {s.placement_consent ? "Yes" : "No"}</Badge>
              <Badge tone={s.placement_eligible ? "green" : "slate"}>{s.placement_eligible ? "Placement Eligible" : "Not yet eligible"}</Badge>
              {pr.relocate && <Badge tone="blue">Willing to relocate</Badge>}
              {pr.notice_period && <Badge>Notice: {pr.notice_period}</Badge>}
              {pr.preferred_location && <Badge>Prefers {pr.preferred_location}</Badge>}
            </div>
          </Sec>

          {/* row 6 */}
          <Sec title="Fee & Payment Summary" icon={<IndianRupee />} className="@xl:col-span-12 @5xl:col-span-3">
            <KV rows={[
              ["Total Course Fee", <b key="t" className="font-semibold text-[#1f2a44]">{inr(p.fee.total)}</b>],
              ["Amount Paid", <span key="p" className="text-emerald-700">{inr(p.fee.paid)}</span>],
              ["Balance Amount", <b key="b" className="font-semibold text-red-600">{inr(p.fee.balance)}</b>],
              ["Next Due Date", fmtDate(p.fee.next_due)],
              ["Payment Mode", lastPayment?.mode ?? null],
            ]} />
            <a href="#fees" className="mt-3 flex items-center justify-center gap-1.5 rounded border border-[#c7d6ef] bg-[#eef3fb] px-2 py-1.5 text-[13px] font-semibold text-[#1d3c8f] hover:bg-[#dbe7fa]"><FileText size={14} /> View Payment History</a>
          </Sec>

          <Sec id="placement" title={<>Company Applications &amp; Interview Tracking <span className="text-[12px] font-normal text-red-500">(Application to Placement – Single Section)</span></>} icon={<Award />} tag="improved" className="@xl:col-span-12 @5xl:col-span-9" bodyClass="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-[12.5px]">
              <thead>
                <tr className="bg-[#eef3fb] text-left text-[#1d3c8f]">
                  {["Sl. No.", "Company", "Applied On", "Rounds", "Status", "Package (CTC)", "DOJ", "HR POC Name", "HR POC Email", "Job Location"].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}
                  {applicationControl && <th className="px-2 py-1.5" />}
                </tr>
              </thead>
              <tbody>
                {applications.map((a, i) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="px-2 py-1.5">{i + 1}</td>
                    <td className="px-2 py-1.5 font-semibold">{a.company}{a.role && <div className="text-[11px] font-normal text-muted">{a.role}</div>}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(a.applied_on)}</td>
                    <td className="px-2 py-1.5">{a.rounds}</td>
                    <td className="px-2 py-1.5"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${a.status === "rejected" ? "bg-red-100 text-red-700" : a.status === "placed" || a.status === "selected" ? "bg-emerald-100 text-emerald-800" : a.status === "shortlisted" ? "bg-lime-100 text-lime-800" : "bg-amber-100 text-amber-800"}`}>{a.status === "placed" ? "Selected / Placed" : statusLabel(a.status)}</span></td>
                    <td className="px-2 py-1.5">{a.package ?? "—"}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{a.doj ? fmtDate(a.doj) : "—"}</td>
                    <td className="px-2 py-1.5">{a.hr_name ?? "—"}</td>
                    <td className="px-2 py-1.5 text-xs">{a.hr_email ?? "—"}</td>
                    <td className="px-2 py-1.5">{a.job_location ?? "—"}</td>
                    {applicationControl && <td className="px-2 py-1.5">{applicationControl(a)}</td>}
                  </tr>
                ))}
                {p.responses.map((r) => (
                  <tr key={`drive-${r.drive_id}`} className="border-t border-line text-muted">
                    <td className="px-2 py-1.5">·</td>
                    <td className="px-2 py-1.5 font-semibold text-ink">{r.drive.company}<div className="text-[11px] font-normal">{r.drive.job_role} · placement drive</div></td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.updated_at ? fmtDate(r.updated_at) : "—"}</td>
                    <td className="px-2 py-1.5">—</td>
                    <td className="px-2 py-1.5"><StatusBadge status={r.response} /> {r.stage && <span className="text-xs">{r.stage}</span>}</td>
                    <td className="px-2 py-1.5" colSpan={applicationControl ? 6 : 5}>{r.drive.ctc ?? ""}</td>
                  </tr>
                ))}
                {!applications.length && !p.responses.length && <tr><td colSpan={11} className="px-2 py-3 text-center text-muted">No applications yet</td></tr>}
              </tbody>
            </table>
            {applicationSlot}
          </Sec>

          {/* below the mock-up: access, fee detail, documents, history, notes */}
          <Sec id="attendance" title="Attendance & Access" icon={<UserCheck />} className="@xl:col-span-6 @5xl:col-span-4">
            <ul className="space-y-2">
              {[...p.access]
                .sort((a, b) => Object.keys(channelMeta).indexOf(a.channel) - Object.keys(channelMeta).indexOf(b.channel))
                .map((a) => (
                  <li key={a.channel} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-2 text-[#1f2a44]">{channelMeta[a.channel].icon}{channelMeta[a.channel].label}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={a.enabled ? "green" : "red"}>{a.enabled ? "Active" : "Blocked"}</Badge>
                      {channelControl?.(a.channel, a.enabled)}
                    </span>
                  </li>
                ))}
            </ul>
            <div className="mt-3 border-t border-line pt-3">
              <div className="flex justify-between text-[13px]"><span>Attendance (30 days)</span><span className="font-semibold tabular-nums">{p.attendance.pct}%</span></div>
              <div className="mt-1"><Progress value={p.attendance.pct} /></div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Badge tone="blue">Zoom {p.attendance.bySource.zoom}</Badge>
                <Badge tone="violet">TeamViewer {p.attendance.bySource.teamviewer}</Badge>
                <Badge tone="slate">Biometric {p.attendance.bySource.biometric}</Badge>
              </div>
            </div>
          </Sec>

          <Sec id="fees" title="Fee & Payments" icon={<IndianRupee />} className="@xl:col-span-6 @5xl:col-span-4">
            <div className="space-y-3">
              {p.allocations.map((a) => (
                <div key={a.id} className="rounded border border-line p-2">
                  <div className="flex justify-between text-[13px] font-semibold"><span>{a.vendor?.name}</span><span className="tabular-nums">{inr(a.amount)}</span></div>
                  <ul className="mt-1 space-y-1">
                    {p.installments.filter((i) => i.allocation_id === a.id).map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                        <span>#{i.seq} · {fmtDate(i.due_date)} · {i.sub_vendor?.name ?? "Direct"}</span>
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
              {!p.allocations.length && <p className="text-[13px] text-muted">No fee plan</p>}
            </div>
            {p.payments.length > 0 && (
              <div className="mt-3 border-t border-line pt-2">
                <div className="mb-1 text-xs font-semibold text-[#1d3c8f]">Payments &amp; receipts</div>
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
          </Sec>

          <Sec id="documents" title={<>Documents <span className="text-[12px] font-normal">(Photo, Resume, ID Proof)</span></>} icon={<FileText />} className="@xl:col-span-12 @5xl:col-span-4">
            <ul className="space-y-2 text-[13px]">
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
          </Sec>

          <Sec id="history" title="Status & History" icon={<History />} className={notesSlot ? "@xl:col-span-12 @5xl:col-span-5" : "@xl:col-span-12"}>
            <ul className="space-y-1.5 text-[13px]">
              {p.events.slice(0, 8).map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span><span className="font-medium capitalize">{e.action}</span>{e.reason ? ` — ${e.reason}` : ""}</span>
                  <span className="text-xs whitespace-nowrap text-muted">{fmtDate(e.created_at)}</span>
                </li>
              ))}
              {!p.events.length && <li className="text-muted">No status changes</li>}
            </ul>
            {p.letters.length > 0 && (
              <div className="mt-3 border-t border-line pt-2">
                <div className="mb-1 text-xs font-semibold text-[#1d3c8f]">Letters &amp; certificates</div>
                <ul className="space-y-1 text-[13px]">
                  {p.letters.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <Link href={`/documents/${l.serial_no}`} className="text-navy hover:text-brand">{titleCase(l.template)}</Link>
                      <span className="font-mono text-xs text-muted">{l.serial_no}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Sec>

          {notesSlot && (
            <Sec id="notes" title="Notes & Remarks" icon={<NotebookPen />} className="@xl:col-span-12 @5xl:col-span-7">
              {notesSlot}
            </Sec>
          )}
        </div>
      </div>

      {improvements && <div className="lg:col-start-2 xl:sticky xl:top-20 xl:col-start-3 xl:row-start-1 xl:self-start">{improvements}</div>}
    </div>
  );
}
