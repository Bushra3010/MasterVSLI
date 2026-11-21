import { BookOpen, Building2, GitBranch, Plug, ScrollText, UserRound } from "lucide-react";
import { I, Row, Save } from "@/components/form-bits";
import { fmtDate } from "@/lib/format";
import { getRepo } from "@/lib/server";
import type { Branch, Consent, TermsDoc } from "@/lib/types";
import { DEFAULT_GENERAL_TERMS, DEFAULT_PLACEMENT_TERMS } from "@/lib/store/seed-crm";
import { deleteRowAction, saveRowAction, saveTermsAction } from "../crm-actions";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

const INTEGRATIONS: { name: string; use: string; env: string[]; hook?: string }[] = [
  { name: "Zoom", use: "Live-class attendance", env: ["ZOOM_WEBHOOK_SECRET"], hook: "/api/webhooks/zoom" },
  { name: "TeamViewer", use: "Recorded-class access & duration", env: ["TEAMVIEWER_API_KEY"], hook: "/api/webhooks/teamviewer" },
  { name: "Biometric device", use: "Offline classroom attendance", env: ["BIOMETRIC_API_KEY"], hook: "/api/webhooks/biometric" },
  { name: "Google Sheets", use: "Placement applicants, one sheet per drive", env: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_SHEET_ID"] },
  { name: "Email (Resend)", use: "Expiry reminders and email broadcasts", env: ["RESEND_API_KEY", "NOTIFY_FROM"] },
  { name: "WhatsApp Cloud API", use: "WhatsApp broadcasts", env: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"] },
  { name: "Razorpay", use: "Online fee payments (UPI, GPay, PhonePe, card)", env: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"], hook: "/api/webhooks/razorpay" },
  { name: "UPI (direct)", use: "UPI QR for fee payments, confirmed by staff", env: ["UPI_VPA"] },
  { name: "Website", use: "Admission enquiries from your website", env: ["WEBSITE_ORIGIN"], hook: "/api/public/admission · /apply" },
  { name: "SMS (Twilio or Fast2SMS)", use: "Fee reminders & alerts by SMS", env: ["TWILIO_SID", "TWILIO_TOKEN", "TWILIO_FROM"] },
  { name: "Daily cron", use: "Validity reminders & auto-expiry", env: ["CRON_SECRET"], hook: "/api/cron/expiry" },
  { name: "Supabase service role", use: "Student portal logins, webhooks", env: ["SUPABASE_SERVICE_ROLE_KEY"] },
];

export default async function SettingsPage() {
  const has = (k: string) => Boolean(process.env[k]);
  const repo = await getRepo();
  const [branches, terms, consents, students] = await Promise.all([
    repo.list<Branch>("branches", { order: { column: "name" } }),
    repo.list<TermsDoc>("terms", { order: { column: "version", ascending: false } }),
    repo.list<Consent>("consents", { order: { column: "accepted_at", ascending: false }, limit: 30 }),
    repo.students(),
  ]);
  const sname = new Map(students.map((x) => [x.id, `${x.full_name} (${x.enrollment_no})`]));
  const active = (k: "general" | "placement") => terms.find((t) => t.kind === k && t.active);
  return (
    <>
      <PageHeader title="Settings" subtitle="Integration status. Courses, vendors and staff now live in their own modules." />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/courses", label: "Courses & batches", icon: BookOpen },
          { href: "/vendors", label: "Vendors & sub-vendors", icon: Building2 },
          { href: "/hr", label: "Staff & HR", icon: UserRound },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-2 rounded-xl border border-line bg-white p-4 text-sm font-medium shadow-sm hover:border-navy">
            <Icon size={18} className="text-brand" /> {label} →
          </Link>
        ))}
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card title="Branches / domains" icon={<GitBranch size={15} />}>
          {branches.map((b) => (
            <Row key={b.id} action={saveRowAction.bind(null, "branches")}>
              <input type="hidden" name="id" value={b.id} />
              <I name="name" value={b.name} required w="min-w-40 flex-1" placeholder="Branch name" />
              <I name="city" value={b.city} w="w-28" placeholder="City" />
              <I name="domain" value={b.domain} w="w-40" placeholder="Domain / specialisation" />
              <select name="company" defaultValue={b.company} aria-label="Company" className="input w-auto py-1.5"><option value="mastervlsi">MasterVLSI</option><option value="enrich">Enrich Silicon</option></select>
              <Save />
              <button formAction={deleteRowAction.bind(null, "branches", b.id)} className="text-xs text-muted hover:text-brand">Delete</button>
            </Row>
          ))}
          <Row action={saveRowAction.bind(null, "branches")}>
            <I name="name" required w="min-w-40 flex-1" placeholder="New branch, e.g. Pune" />
            <I name="city" w="w-28" placeholder="City" />
            <I name="domain" w="w-40" placeholder="Domain" />
            <select name="company" aria-label="Company" className="input w-auto py-1.5"><option value="mastervlsi">MasterVLSI</option><option value="enrich">Enrich Silicon</option></select>
            <Save label="+ Add" />
          </Row>
        </Card>
        <Card title="Consent records (latest)" icon={<ScrollText size={15} />} bodyClass="p-0 overflow-x-auto max-h-80">
          <table className="table">
            <thead><tr><th>Consent ID</th><th>Student</th><th>Terms</th><th>Accepted</th></tr></thead>
            <tbody>
              {consents.map((c) => <tr key={c.id}><td className="font-mono text-[11px]">{c.consent_no}</td><td>{sname.get(c.student_id)}</td><td className="capitalize">{c.kind} v{c.version}</td><td className="whitespace-nowrap text-xs">{new Date(c.accepted_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td></tr>)}
              {!consents.length && <tr><td colSpan={4} className="text-center text-muted">No acceptances yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        {(["general", "placement"] as const).map((k) => {
          const t = active(k);
          return (
            <Card key={k} title={k === "general" ? "MasterVLSI Terms & Conditions" : "Placement Terms & Conditions (agreement)"} icon={<ScrollText size={15} />}>
              <form action={saveTermsAction.bind(null, k)} className="space-y-2">
                <input name="title" defaultValue={t?.title ?? (k === "general" ? "MasterVLSI Terms & Conditions" : "MasterVLSI Placement Terms & Conditions")} aria-label="Title" placeholder="Title" className="input" />
                <textarea name="items" rows={12} aria-label="Terms" className="input font-mono text-xs" defaultValue={(t?.items ?? (k === "general" ? DEFAULT_GENERAL_TERMS : DEFAULT_PLACEMENT_TERMS)).map((i, n) => `${n + 1}. ${i.title}\n${i.body}`).join("\n\n")} />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted">One term per block: first line = heading, next line(s) = text, blank line between terms. Saving publishes version {(t?.version ?? 0) + 1}; students must accept again.</p>
                  <Save label="Publish" />
                </div>
              </form>
              {t ? <p className="mt-2 text-[11px] text-muted">Live: version {t.version} · {t.items.length} terms · published {fmtDate(t.created_at)}</p> : <p className="mt-2 text-[11px] text-amber-700">Not published yet — the default wording is pre-filled. Review it and press Publish to switch this on for students.</p>}
            </Card>
          );
        })}
      </div>

      <Card title="Integrations" icon={<Plug size={15} />} bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Integration</th><th>Used for</th><th>Server secrets</th><th>Endpoint</th><th>Status</th></tr></thead>
          <tbody>
            {INTEGRATIONS.map((i) => {
              const ok = i.env.every(has);
              return (
                <tr key={i.name}>
                  <td className="font-medium">{i.name}</td>
                  <td className="text-sm text-muted">{i.use}</td>
                  <td className="font-mono text-[11px]">{i.env.map((e) => <div key={e} className={has(e) ? "text-emerald-700" : "text-muted"}>{e}</div>)}</td>
                  <td className="font-mono text-[11px]">{i.hook ?? "—"}</td>
                  <td>{ok ? <Badge tone="green">Configured</Badge> : <Badge tone="amber">Not set</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">
          Secrets are added on the Cloudflare Worker (<code>wrangler secret put NAME</code>) and are never shown here.
        </p>
      </Card>
    </>
  );
}
