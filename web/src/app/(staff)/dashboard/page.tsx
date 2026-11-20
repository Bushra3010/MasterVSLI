import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Database,
  Fingerprint,
  IndianRupee,
  MonitorPlay,
  ShieldBan,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { Badge, Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { fmtDate, inr } from "@/lib/format";
import { getRepo } from "@/lib/server";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const repo = await getRepo();
  const [stats, students, drives, responses, ledger, events] = await Promise.all([
    repo.dashboard(),
    repo.students(),
    repo.drives(),
    repo.responses(),
    repo.ledger(),
    repo.accessEvents(),
  ]);

  const pipeline = [
    { label: "30 days", test: (d: number) => d > 15 && d <= 30 },
    { label: "15 days", test: (d: number) => d > 7 && d <= 15 },
    { label: "7 days", test: (d: number) => d > 1 && d <= 7 },
    { label: "1 day", test: (d: number) => d >= 0 && d <= 1 },
  ].map((p) => ({ ...p, count: students.filter((s) => s.status !== "expired" && s.days_left !== null && p.test(s.days_left)).length }));

  const vendorTotals = ledger.vendors
    .filter((v) => !v.parent_id)
    .map((v) => {
      const allocIds = new Set(ledger.allocations.filter((a) => a.vendor_id === v.id).map((a) => a.id));
      const inst = ledger.installments.filter((i) => allocIds.has(i.allocation_id));
      const total = inst.reduce((a, i) => a + Number(i.amount), 0);
      const paid = inst.reduce((a, i) => a + Number(i.paid_amount), 0);
      return { v, total, paid };
    });

  const sources = [
    { key: "zoom" as const, label: "Zoom", sub: "Live online class", icon: Video },
    { key: "teamviewer" as const, label: "TeamViewer", sub: "Recorded class access", icon: MonitorPlay },
    { key: "biometric" as const, label: "Biometric", sub: "Offline classroom", icon: Fingerprint },
  ];

  return (
    <>
      <PageHeader
        title="Institute Overview"
        subtitle="Students, attendance, fees, validity, placements and access — all in one place."
        actions={
          <>
            <Link href="/students/new" className="btn-primary">+ New admission</Link>
            <Link href="/placements" className="btn-ghost">Create drive</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total students" value={stats.total} icon={<Users size={16} />} />
        <Stat label="Active" value={stats.active} tone="green" />
        <Stat label="On hold" value={stats.on_hold} tone="amber" />
        <Stat label="Expiring ≤ 30 days" value={stats.expiring_month} tone="red" icon={<CalendarClock size={16} />} />
        <Stat label="Fees collected" value={inr(stats.collected)} tone="green" icon={<IndianRupee size={16} />} />
        <Stat label="Pending fees" value={inr(stats.pending_fees)} tone="red" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <Card title="Three-way attendance" icon={<Database size={15} />} actions={<Link href="/attendance" className="text-xs text-white/80 hover:text-white">Open →</Link>}>
          <div className="grid grid-cols-3 gap-2">
            {sources.map(({ key, label, sub, icon: Icon }) => (
              <div key={key} className="rounded-lg border border-line p-3 text-center">
                <Icon className="mx-auto text-navy" size={22} />
                <div className="mt-1 text-sm font-semibold">{label}</div>
                <div className="text-[11px] text-muted">{sub}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-navy">{stats.attendance_by_source[key]}</div>
                <div className="text-[10px] text-muted">sessions / 30d</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-navy-soft p-2 text-xs font-medium text-navy">
            <Database size={14} /> Central attendance database — automatic sync
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge tone="blue">{stats.today_present} present on last class day</Badge>
            <Badge tone="red"><AlertTriangle size={12} /> {stats.irregular} irregular (&lt; 75%)</Badge>
          </div>
        </Card>

        <Card title="Fees, vendor & sub-vendor" icon={<IndianRupee size={15} />} actions={<Link href="/fees" className="text-xs text-white/80 hover:text-white">Open →</Link>}>
          <div className="space-y-3">
            {vendorTotals.map(({ v, total, paid }) => (
              <div key={v.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{v.name}</span>
                  <span className="tabular-nums text-muted">{inr(paid)} / {inr(total)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-500" style={{ width: `${total ? (100 * paid) / total : 0}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  Sub-vendors: {ledger.vendors.filter((s) => s.parent_id === v.id).map((s) => s.name).join(", ") || "—"}
                </div>
              </div>
            ))}
            <div className="text-xs text-muted">
              Overdue installments:{" "}
              <span className="font-semibold text-brand">{ledger.installments.filter((i) => i.status === "overdue").length}</span>
            </div>
          </div>
        </Card>

        <Card title="Training validity & expiry" icon={<CalendarClock size={15} />} actions={<Link href="/validity" className="text-xs text-white/80 hover:text-white">Open →</Link>}>
          <ol className="space-y-2">
            {pipeline.map((p) => (
              <li key={p.label} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
                <span>{p.label} before expiry</span>
                <Badge tone={p.count ? "amber" : "slate"}>{p.count} students</Badge>
              </li>
            ))}
            <li className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
              <span>Expired — access auto-disabled</span>
              <Badge tone="red">{stats.expired}</Badge>
            </li>
          </ol>
        </Card>

        <Card title="Placement drives" icon={<Briefcase size={15} />} className="xl:col-span-2" actions={<Link href="/placements" className="text-xs text-white/80 hover:text-white">Open →</Link>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {drives.map((d) => {
              const r = responses.filter((x) => x.drive_id === d.id);
              const yes = r.filter((x) => x.response === "yes");
              return (
                <Link key={d.id} href={`/placements?drive=${d.id}`} className="rounded-lg border border-line p-3 hover:border-navy">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{d.company}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="text-xs text-muted">{d.job_role}</div>
                  <div className="mt-2 text-xs text-muted">{[d.location, d.drive_date && fmtDate(d.drive_date)].filter(Boolean).join(" · ") || "Date TBA"}</div>
                  <div className="mt-2 flex gap-1.5 text-xs">
                    <Badge tone="green">{yes.length} interested</Badge>
                    <Badge tone="blue">{yes.filter((x) => x.synced_to_sheet).length} in sheet</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card title="Centralized access control" icon={<ShieldBan size={15} />} actions={<Link href="/access" className="text-xs text-white/80 hover:text-white">Open →</Link>}>
          <p className="mb-2 text-xs text-muted">One switch blocks Zoom, TeamViewer, Biometric, placement applications and the training portal.</p>
          <ul className="space-y-1.5">
            {students
              .filter((s) => s.status === "on_hold" || s.status === "expired")
              .slice(0, 6)
              .map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <Link href={`/students/${s.id}`} className="hover:text-brand">{s.full_name}</Link>
                  <StatusBadge status={s.status} />
                </li>
              ))}
          </ul>
          <div className="mt-3 border-t border-line pt-2 text-[11px] text-muted">
            Last change: {events[0] ? `${events[0].action} · ${fmtDate(events[0].created_at)}` : "—"}
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Link href="/documents" className="flex items-center justify-between rounded-xl border border-line bg-white p-4 shadow-sm hover:border-navy">
          <div>
            <div className="font-semibold text-navy">Certificates & letters</div>
            <div className="text-sm text-muted">Auto-generate with institute branding, QR code and unique serial number.</div>
          </div>
          <ArrowRight className="text-brand" />
        </Link>
      </div>
    </>
  );
}
