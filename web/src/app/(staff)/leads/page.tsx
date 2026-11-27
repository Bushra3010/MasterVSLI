import Link from "next/link";
import { Plus } from "lucide-react";
import { Flash } from "@/components/student360";
import { PageHeader } from "@/components/ui";
import { nowMs } from "@/lib/calendar";
import { todayISO } from "@/lib/format";
import { createLeadRepo } from "@/lib/leads";
import { getRepo } from "@/lib/server";
import { getStore, isAdmin, requireStaff } from "@/lib/session";
import type { Staff } from "@/lib/types";
import { AddLeadForm, LeadDrawer } from "./parts";
import { TAB_VIEWS, type Ctx } from "./tabs";

export const metadata = { title: "Lead management" };

const TABS: [string, string, boolean][] = [
  // key, label, admin only
  ["dashboard", "Dashboard", false],
  ["all", "All Leads", false],
  ["pipeline", "Pipeline", false],
  ["allocation", "Allocation", true],
  ["workspace", "My Workspace", false],
  ["followups", "Follow-ups", false],
  ["report", "Daily Report", false],
  ["calendar", "Calendar", false],
  ["upload", "Bulk Upload", true],
  ["duplicates", "Duplicates", true],
  ["counsellors", "Counsellors", true],
  ["admissions", "Admissions", false],
  ["analytics", "Analytics", true],
  ["history", "Allocation History", true],
  ["audit", "Audit", true],
  ["archive", "Archive", true],
];

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const sp = await searchParams;
  const session = await requireStaff();
  const admin = isAdmin(session);
  const repo = await getRepo();
  const lr = createLeadRepo(await getStore());
  const meStaff = await repo.staffForUser(session.userId, session.email);
  const counsellors = await lr.counsellors();
  // Counsellors land on their own workspace; admins may view any counsellor's workspace.
  const asName = admin && typeof sp.as === "string" && counsellors.some((c) => c.full_name === sp.as) ? sp.as : null;
  const me = asName ?? meStaff?.full_name ?? session.name;
  const allowed = TABS.filter(([, , a]) => admin || !a);
  const defaultTab = admin ? "dashboard" : "workspace";
  const tab = typeof sp.tab === "string" && allowed.some(([k]) => k === sp.tab) ? sp.tab : defaultTab;

  const [allLeads, archived, acts, tasks, allocs, staff, students, courses, settings] = await Promise.all([
    lr.leads(),
    admin ? lr.leads({ archived: true }) : Promise.resolve([]),
    lr.activities(),
    lr.tasks(),
    lr.allocations(),
    repo.staff() as Promise<Staff[]>,
    repo.students({ status: "all" }),
    repo.courses(),
    lr.settings(),
  ]);
  // Staff who aren't admins work only on the leads allocated to them.
  const leads = admin ? allLeads : allLeads.filter((l) => l.assigned_to === me);
  const now = nowMs();
  const today = todayISO();
  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && !["id", "saved", "error"].includes(k)) p.set(k, v);
    p.set("tab", tab);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/leads?${p}`;
  };
  const ctx: Ctx = {
    sp, admin, me, now, today, leads, allLeads, archived, acts, tasks, allocs, staff, counsellors, students, courses, settings, lr,
    linkTo: (id) => keep({ id }),
  };
  const selected = typeof sp.id === "string" ? [...allLeads, ...archived].find((l) => l.id === sp.id && (admin || l.assigned_to === me)) : undefined;
  const View = TAB_VIEWS[tab];

  return (
    <div className={selected ? "xl:mr-[460px]" : ""}>
      <PageHeader
        title="Lead Management 360°"
        subtitle="Capture, de-duplicate, allocate and follow up every lead — with counsellor workspaces, a daily report and admission conversion."
        actions={
          <div className="flex flex-wrap gap-2">
            <details className="relative">
              <summary className="btn-primary cursor-pointer list-none"><Plus size={15} /> Add Lead</summary>
              <div className="absolute right-0 z-20 mt-1 w-80 rounded-[5px] border border-line bg-white p-3 shadow-lg">
                <AddLeadForm courses={courses.map((c) => c.code)} counsellors={counsellors} admin={admin} />
              </div>
            </details>
            {admin && <Link href="/leads?tab=upload" className="btn-ghost">Bulk Upload</Link>}
            {admin && <Link href="/leads?tab=allocation" className="btn-ghost">Allocate Leads</Link>}
            <Link href="/leads?tab=report" className="btn-ghost">Daily Report</Link>
          </div>
        }
      />
      <Flash sp={sp} />
      <nav className="mb-4 flex flex-wrap gap-1 rounded-[5px] border border-line bg-white p-1.5" aria-label="Lead management sections">
        {allowed.map(([k, l]) => (
          <Link key={k} href={`/leads?tab=${k}`} className={`rounded-[5px] px-2.5 py-1.5 text-[13px] ${k === tab ? "bg-brand font-medium text-white" : "text-navy hover:bg-slate-50"}`}>{l}</Link>
        ))}
      </nav>
      {asName && <div className="mb-3 rounded-[5px] border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">Viewing the workspace of <b>{asName}</b>.</div>}
      {await View(ctx)}
      {selected && (
        <LeadDrawer
          l={selected}
          acts={acts.filter((a) => a.lead_id === selected.id)}
          tasks={tasks.filter((t) => t.lead_id === selected.id)}
          allocs={allocs.filter((a) => a.lead_id === selected.id)}
          closeHref={keep({})}
          courses={courses.map((c) => c.code)}
          counsellors={counsellors}
          admin={admin}
          back={keep({ id: selected.id })}
          now={now}
        />
      )}
    </div>
  );
}
