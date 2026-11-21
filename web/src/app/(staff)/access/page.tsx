import { Check, X } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession } from "@/lib/session";
import { CHANNELS, type Channel } from "@/lib/types";
import { setStatusAction, toggleChannelAction } from "../actions";
import { setRoleAction } from "../module-actions";

export const metadata = { title: "Access control" };

const LABEL: Record<Channel, string> = { zoom: "Zoom", teamviewer: "TeamViewer", biometric: "Biometric", placement: "Placements", portal: "Portal" };

export default async function AccessPage({ searchParams }: PageProps<"/access">) {
  const sp = await searchParams;
  const show = typeof sp.show === "string" ? sp.show : "all";
  const repo = await getRepo();
  const [students, access, events, profiles, me] = await Promise.all([repo.students(), repo.accessOverview(), repo.accessEvents(), repo.profiles(), getSession()]);
  const linked = new Set(students.map((s) => s.user_id).filter(Boolean));
  const users = profiles.filter((p) => p.role !== "student" || !linked.has(p.id));
  const acc = new Map(access.map((a) => [`${a.student_id}:${a.channel}`, a.enabled]));
  const name = new Map(students.map((s) => [s.id, s.full_name]));
  const list = students.filter((s) => (show === "blocked" ? s.status !== "active" : true));

  return (
    <>
      <PageHeader title="Centralized access control" subtitle="Hold a student once — Zoom, TeamViewer, biometric, placement applications and the portal are all blocked together." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Full access" value={students.filter((s) => s.status === "active").length} tone="green" />
        <Stat label="On hold" value={students.filter((s) => s.status === "on_hold").length} tone="amber" />
        <Stat label="Expired" value={students.filter((s) => s.status === "expired").length} tone="red" />
        <Stat label="Partially blocked" value={students.filter((s) => s.status === "active" && CHANNELS.some((c) => acc.get(`${s.id}:${c}`) === false)).length} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-4">
        <Card
          title="Students × channels"
          className="xl:col-span-3"
          bodyClass="p-0 overflow-x-auto"
          actions={
            <div className="flex gap-1 text-xs">
              {["all", "blocked"].map((f) => (
                <Link key={f} href={`/access?show=${f}`} className={`rounded px-2 py-0.5 capitalize ${show === f ? "bg-brand text-white" : "text-muted hover:text-brand"}`}>{f}</Link>
              ))}
            </div>
          }
        >
          <table className="table">
            <thead>
              <tr>
                <th>Student</th><th>Status</th>
                {CHANNELS.map((c) => <th key={c} className="text-center">{LABEL[c]}</th>)}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`} className="font-medium hover:text-brand">{s.full_name}</Link></td>
                  <td><StatusBadge status={s.status} /></td>
                  {CHANNELS.map((c) => {
                    const on = acc.get(`${s.id}:${c}`) ?? false;
                    return (
                      <td key={c} className="text-center">
                        <form action={toggleChannelAction.bind(null, s.id, c, !on)}>
                          <button
                            title={on ? `Block ${LABEL[c]}` : `Allow ${LABEL[c]}`}
                            className={`inline-grid size-7 place-items-center rounded-full ${on ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-red-50 text-brand hover:bg-red-100"}`}
                          >
                            {on ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </form>
                      </td>
                    );
                  })}
                  <td>
                    {s.status === "active" ? (
                      <form action={setStatusAction.bind(null, s.id, "on_hold", "Put on hold from access center")}>
                        <button className="btn py-1 text-xs border border-amber-300 bg-amber-50 text-amber-800">Hold</button>
                      </form>
                    ) : (
                      <form action={setStatusAction.bind(null, s.id, "active", "Activated from access center")}>
                        <button className="btn py-1 text-xs border border-emerald-300 bg-emerald-50 text-emerald-800">Activate</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Audit trail">
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{name.get(e.student_id)}</span>
                  <span className="text-xs text-muted">{fmtDate(e.created_at)}</span>
                </div>
                <div className="text-xs text-muted capitalize">{e.action}{e.reason ? ` — ${e.reason}` : ""}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Users & roles (role-based access)" className="mt-5" bodyClass="p-0 overflow-x-auto">
        <p className="border-b border-line px-4 py-2 text-xs text-muted">
          <b>Admin</b>: everything, including changing roles. <b>Staff</b>: all ERP modules. <b>Student</b>: only their own portal. New logins start as Student.
          {me?.role !== "admin" && me?.role !== "super_admin" && " Only admins can change roles."} <b>Super admin</b>: also sees Kacha (other-account) fees.
        </p>
        <table className="table">
          <thead><tr><th>User</th><th>Since</th><th>Role</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.full_name || u.id.slice(0, 8)}{u.id === me?.userId && <span className="ml-1 text-xs text-muted">(you)</span>}</td>
                <td>{fmtDate(u.created_at)}</td>
                <td>
                  {(me?.role === "admin" || me?.role === "super_admin") && u.id !== me.userId ? (
                    <form action={setRoleAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="role" defaultValue={u.role} aria-label={`Role for ${u.full_name}`} className="input w-auto py-1">
                        {me?.role === "super_admin" && <option value="super_admin">Super admin</option>}<option value="admin">Admin</option><option value="staff">Staff</option><option value="student">Student</option>
                      </select>
                      <button className="btn-navy py-1 text-xs">Save</button>
                    </form>
                  ) : (
                    <span className="capitalize">{u.role}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
