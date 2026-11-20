import { BookOpen, Building2, Plug, UserRound } from "lucide-react";
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
  { name: "Daily cron", use: "Validity reminders & auto-expiry", env: ["CRON_SECRET"], hook: "/api/cron/expiry" },
  { name: "Supabase service role", use: "Student portal logins, webhooks", env: ["SUPABASE_SERVICE_ROLE_KEY"] },
];

export default function SettingsPage() {
  const has = (k: string) => Boolean(process.env[k]);
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
