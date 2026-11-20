import { Bell, CalendarClock, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { fmtDate, titleCase } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { renewAction } from "../actions";
import { RunExpiryButton } from "./run-expiry";

export const metadata = { title: "Validity & expiry" };

const RULES = [
  { when: "30 days before", what: "Notify student & admin", tone: "blue" as const },
  { when: "15 days before", what: "Reminder notification", tone: "blue" as const },
  { when: "7 days before", what: "Access warning", tone: "amber" as const },
  { when: "1 day before", what: "Final reminder", tone: "amber" as const },
  { when: "Expiry date", what: "Auto-disable all training access", tone: "red" as const },
  { when: "Renewal", what: "Restore access after approval", tone: "green" as const },
];

export default async function ValidityPage() {
  const repo = await getRepo();
  const [students, notifications] = await Promise.all([repo.students(), repo.notifications()]);
  const name = new Map(students.map((s) => [s.id, s.full_name]));
  const tracked = students
    .filter((s) => s.days_left !== null && s.days_left <= 45 && s.status !== "completed")
    .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0));

  return (
    <>
      <PageHeader
        title="Training validity & expiry"
        subtitle="A daily Cloudflare cron calls /api/cron/expiry, which sends reminders and disables access on the expiry date."
        actions={<RunExpiryButton />}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {RULES.map((r) => (
          <div key={r.when} className="rounded-xl border border-line bg-white p-3 shadow-sm">
            <Badge tone={r.tone}>{r.when}</Badge>
            <div className="mt-2 text-sm font-medium">{r.what}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card title="Expiring soon & expired" icon={<CalendarClock size={15} />} className="xl:col-span-2" bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>Course</th><th>Valid until</th><th>Days left</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {tracked.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.full_name}</Link></td>
                  <td className="max-w-48 truncate text-xs">{s.course_name}</td>
                  <td>{fmtDate(s.validity_end)}</td>
                  <td>
                    <Badge tone={s.days_left! < 0 ? "red" : s.days_left! <= 7 ? "red" : s.days_left! <= 15 ? "amber" : "blue"}>
                      {s.days_left! < 0 ? `${-s.days_left!}d ago` : `${s.days_left}d`}
                    </Badge>
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <div className="flex gap-1">
                      <form action={renewAction.bind(null, s.id, 3)}><button className="btn-ghost py-1 text-xs"><RefreshCcw size={12} /> +3m</button></form>
                      <form action={renewAction.bind(null, s.id, 6)}><button className="btn-ghost py-1 text-xs">+6m</button></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Notification log" icon={<Bell size={15} />}>
          <ul className="space-y-2 text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="flex justify-between gap-2">
                <span>{name.get(n.student_id)} <span className="text-muted">· {titleCase(n.kind)}</span></span>
                <span className="text-xs whitespace-nowrap text-muted">{fmtDate(n.created_at)}</span>
              </li>
            ))}
            {!notifications.length && <li className="text-muted">No notifications yet — run the expiry check.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
