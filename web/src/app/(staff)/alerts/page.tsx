import { AlertTriangle, ArrowUpRight, BellRing, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { ALERT_RULES } from "@/lib/repo-crm";
import { getRepo } from "@/lib/server";
import type { AlertRow } from "@/lib/types";
import { resolveAlertAction } from "../crm-actions";
import { RunAlerts } from "./run-alerts";

export const metadata = { title: "Alerts & escalation" };

const LINK: Record<string, (ref: string) => string> = {
  fee_overdue: (r) => `/students/${r}`,
  attendance: (r) => `/students/${r}`,
  training_expiry: (r) => `/students/${r}`,
  mou_renewal: () => `/colleges?tab=mou`,
  corporate_payment: () => `/enrich?tab=invoices`,
  lead_follow_up: (r) => `/leads?id=${r}`,
  project_delay: () => `/enrich?tab=projects`,
};
const levelTone = (l: number) => (l >= 3 ? "red" : l === 2 ? "amber" : "blue") as "red" | "amber" | "blue";

export default async function AlertsPage({ searchParams }: PageProps<"/alerts">) {
  const sp = await searchParams;
  const show = typeof sp.show === "string" ? sp.show : "open";
  const kind = typeof sp.kind === "string" ? sp.kind : "";
  const repo = await getRepo();
  const alerts = await repo.list<AlertRow>("alerts", { order: { column: "created_at", ascending: false } });
  const open = alerts.filter((a) => a.status === "open");
  const shown = alerts.filter((a) => (show === "all" || a.status === show) && (!kind || a.kind === kind));
  const now = new Date().getTime(); // server component: rendered once per request

  return (
    <>
      <PageHeader
        title="Automated Alerts and Escalation"
        subtitle="Key events automatically generate alerts to the responsible person, and escalate if unresolved within the SLA."
        actions={<RunAlerts />}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open alerts" value={open.length} tone="red" icon={<BellRing size={18} />} />
        <Stat label="Escalated (level 2+)" value={open.filter((a) => a.level >= 2).length} tone="amber" icon={<ArrowUpRight size={18} />} />
        <Stat label="Past SLA now" value={open.filter((a) => Date.parse(a.due_at) < now).length} tone="red" icon={<Clock size={18} />} />
        <Stat label="Resolved" value={alerts.filter((a) => a.status === "resolved").length} tone="green" icon={<CheckCircle2 size={18} />} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title="Alerts"
          bodyClass="p-0 overflow-x-auto"
          actions={<div className="flex gap-1 text-xs">{["open", "resolved", "all"].map((f) => <Link key={f} href={`/alerts?show=${f}${kind ? `&kind=${kind}` : ""}`} className={`rounded px-2 py-0.5 capitalize ${show === f ? "bg-brand text-white" : "text-muted hover:text-brand"}`}>{f}</Link>)}</div>}
        >
          <table className="table">
            <thead><tr><th>Raised</th><th>Alert</th><th>Responsible</th><th>Level</th><th>SLA due</th><th>Action</th></tr></thead>
            <tbody>
              {shown.map((a) => {
                const late = a.status === "open" && Date.parse(a.due_at) < now;
                return (
                  <tr key={a.id} className={late ? "bg-red-50" : ""}>
                    <td className="whitespace-nowrap">{fmtDate(a.created_at)}</td>
                    <td>
                      <Link href={LINK[a.kind]?.(a.ref_id) ?? "#"} className="font-medium text-navy hover:text-brand">{a.title}</Link>
                      <div className="text-[11px] text-muted">{ALERT_RULES[a.kind]?.label} · {a.details}</div>
                    </td>
                    <td>{a.owner_role}</td>
                    <td><Badge tone={levelTone(a.level)}>{a.level === 1 ? "Initial" : a.level === 2 ? "1st escalation" : "Final escalation"}</Badge></td>
                    <td className={`whitespace-nowrap text-xs ${late ? "font-medium text-red-700" : ""}`}>{new Date(a.due_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                    <td>
                      {a.status === "open" ? (
                        <form action={resolveAlertAction.bind(null, a.id)} className="flex items-center gap-1">
                          <input name="note" placeholder="What was done?" aria-label="Resolution note" className="input w-36 py-1" />
                          <button className="btn-primary py-1 text-xs">Resolve</button>
                        </form>
                      ) : (
                        <span className="text-xs text-emerald-700">Resolved {a.resolved_at ? fmtDate(a.resolved_at) : ""}{a.resolved_note ? ` · ${a.resolved_note}` : ""}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={6} className="text-center text-muted">No alerts. Press “Run alert engine” to scan now (it also runs daily).</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card title="Alert rules & escalation chain" icon={<AlertTriangle size={15} />}>
          <ul className="space-y-2 text-[13px]">
            {Object.entries(ALERT_RULES).map(([k, r]) => (
              <li key={k}>
                <Link href={`/alerts?show=${show}&kind=${kind === k ? "" : k}`} className={`block rounded-[5px] border p-2.5 ${kind === k ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                  <div className="flex justify-between"><b className="font-medium text-navy">{r.label}</b><span className="text-xs text-muted">{open.filter((a) => a.kind === k).length} open · SLA {r.sla} h</span></div>
                  <div className="mt-1 text-[11px] text-muted">{r.chain.join(" → ")}</div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">The engine runs with the daily cron and when you press the button. Unresolved alerts move one level up each time their SLA passes (max 3 levels).</p>
        </Card>
      </div>
    </>
  );
}
