import Link from "next/link";
import { Badge, Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { getSession, isSuperAdmin } from "@/lib/session";
import { feeDues } from "@/lib/reminders";
import { ReminderForm } from "./reminder-form";
import { recordPaymentAction } from "../actions";
import { cancelPaymentRequestAction, confirmPaymentRequestAction } from "../module-actions";

export const metadata = { title: "Fees management" };

export default async function FeesPage({ searchParams }: PageProps<"/fees">) {
  const sp = await searchParams;
  const filter = typeof sp.show === "string" ? sp.show : "due";
  const superAdmin = isSuperAdmin(await getSession());
  const account = sp.account === "kacha" && superAdmin ? "kacha" : "paka";
  const repo = await getRepo();
  const [{ vendors, allocations, installments, payments, students }, requests, dues] = await Promise.all([repo.ledger(account), repo.paymentRequests(), feeDues(repo, "all")]);
  const openRequests = requests.filter((r) => r.status === "created");
  const student = new Map(students.map((s) => [s.id, s]));
  const vendor = new Map(vendors.map((v) => [v.id, v]));
  const allocVendor = new Map(allocations.map((a) => [a.id, a.vendor_id]));
  const today = todayISO();

  const total = installments.reduce((a, i) => a + Number(i.amount), 0);
  const paid = installments.reduce((a, i) => a + Number(i.paid_amount), 0);
  const overdue = installments.filter((i) => i.status !== "paid" && i.due_date < today);

  const tree = vendors
    .filter((v) => !v.parent_id)
    .map((v) => {
      const inst = installments.filter((i) => allocVendor.get(i.allocation_id) === v.id);
      const subs = vendors
        .filter((s) => s.parent_id === v.id)
        .map((s) => {
          const si = inst.filter((i) => i.sub_vendor_id === s.id);
          return { s, total: si.reduce((a, i) => a + Number(i.amount), 0), paid: si.reduce((a, i) => a + Number(i.paid_amount), 0), count: si.length };
        });
      return {
        v,
        allocated: allocations.filter((a) => a.vendor_id === v.id).reduce((a, x) => a + Number(x.amount), 0),
        paid: inst.reduce((a, i) => a + Number(i.paid_amount), 0),
        students: new Set(inst.map((i) => i.student_id)).size,
        subs,
      };
    });

  const shown = installments
    .filter((i) => (filter === "due" ? i.status !== "paid" : filter === "overdue" ? i.status !== "paid" && i.due_date < today : true))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 80);

  return (
    <>
      <PageHeader title="Fees Management" subtitle="Each student fee is split across vendors; vendor shares are collected in installments via sub-vendors." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/fees?account=paka" className={`btn border ${account === "paka" ? "border-emerald-600 bg-emerald-600 text-white" : "border-line bg-white"}`}>🏛 Paka (Institute account)</Link>
        {superAdmin && <Link href="/fees?account=kacha" className={`btn border ${account === "kacha" ? "border-orange-500 bg-orange-500 text-white" : "border-orange-200 bg-orange-50 text-orange-800"}`}>🔒 Kacha (Other accounts)</Link>}
        <span className="text-xs text-muted">{account === "kacha" ? "Vendor / sub-vendor / partner accounts: visible only to super admins." : superAdmin ? "Official MasterVLSI account (GST invoice / official receipt)." : "Official MasterVLSI account."}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total billed" value={inr(total)} />
        <Stat label="Collected" value={inr(paid)} tone="green" />
        <Stat label="Outstanding" value={inr(total - paid)} tone="amber" />
        <Stat label="Overdue installments" value={overdue.length} tone="red" hint={inr(overdue.reduce((a, i) => a + Number(i.amount) - Number(i.paid_amount), 0))} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {tree.map(({ v, allocated, paid, students: n, subs }) => (
          <Card key={v.id} title={v.name} actions={<span className="text-xs text-muted">{n} students</span>}>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-muted">Allocated</div>
                <div className="text-xl font-semibold tabular-nums text-navy">{inr(allocated)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">Received</div>
                <div className="text-xl font-semibold tabular-nums text-emerald-600">{inr(paid)}</div>
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-emerald-500" style={{ width: `${allocated ? (100 * paid) / allocated : 0}%` }} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {subs.map(({ s, total, paid, count }) => (
                <div key={s.id} className="rounded-lg border border-line p-3">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted">{[s.contact_person, s.phone].filter(Boolean).join(" · ") || "No contact details"}</div>
                  <div className="mt-1 text-sm tabular-nums">{inr(paid)} <span className="text-muted">/ {inr(total)}</span></div>
                  <div className="text-[11px] text-muted">{count} installments</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card
        title="Installments"
        className="mt-5"
        bodyClass="p-0 overflow-x-auto"
        actions={
          <div className="flex gap-1 text-xs">
            {["due", "overdue", "all"].map((f) => (
              <Link key={f} href={`/fees?show=${f}&account=${account}`} className={`rounded px-2 py-0.5 capitalize ${filter === f ? "bg-brand text-white" : "text-muted hover:text-brand"}`}>{f}</Link>
            ))}
          </div>
        }
      >
        <table className="table">
          <thead><tr><th>Student</th><th>Vendor → sub-vendor</th><th>#</th><th>Due</th><th>Amount</th><th>Paid</th><th>Status</th><th>Record payment</th></tr></thead>
          <tbody>
            {shown.map((i) => {
              const s = student.get(i.student_id);
              const status = i.status !== "paid" && i.due_date < today ? "overdue" : i.status;
              return (
                <tr key={i.id}>
                  <td><Link href={`/students/${i.student_id}`} className="font-medium hover:text-brand">{s?.full_name}</Link></td>
                  <td className="text-xs">{vendor.get(allocVendor.get(i.allocation_id) ?? "")?.name} → {vendor.get(i.sub_vendor_id ?? "")?.name ?? "Direct"}</td>
                  <td>{i.seq}</td>
                  <td>{fmtDate(i.due_date)}</td>
                  <td className="tabular-nums">{inr(i.amount)}</td>
                  <td className="tabular-nums">{inr(i.paid_amount)}</td>
                  <td><StatusBadge status={status} /></td>
                  <td>
                    {i.status !== "paid" && (
                      <form action={recordPaymentAction} className="flex items-center gap-1">
                        <input type="hidden" name="installment_id" value={i.id} />
                        <input name="amount" type="number" defaultValue={Number(i.amount) - Number(i.paid_amount)} className="input w-24 py-1" />
                        <select name="mode" className="input w-auto py-1">
                          <option>UPI</option><option>Bank Transfer</option><option>Card</option><option>Cash</option>
                        </select>
                        <input name="reference" placeholder="Txn ref" aria-label="Transaction reference" className="input w-28 py-1" />
                        <button className="btn-primary py-1">Save</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={<>Fee reminders <Badge tone="red">{dues.filter((d) => d.overdue).length} overdue</Badge> <Badge tone="amber">{dues.filter((d) => !d.overdue).length} due soon</Badge></>} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>Amount</th><th>Due</th><th>Status</th><th>Remind</th></tr></thead>
            <tbody>
              {dues.slice(0, 15).map((d) => (
                <tr key={d.student.id}>
                  <td><Link href={`/students/${d.student.id}`} className="font-medium hover:text-brand">{d.student.full_name}</Link><div className="text-[11px] text-muted">{d.student.phone}</div></td>
                  <td className="tabular-nums">{inr(d.amount)}</td>
                  <td>{fmtDate(d.due)}</td>
                  <td><Badge tone={d.overdue ? "red" : "amber"}>{d.overdue ? "overdue" : "due soon"}</Badge></td>
                  <td><ReminderForm studentId={d.student.id} compact /></td>
                </tr>
              ))}
              {!dues.length && <tr><td colSpan={5} className="text-center text-muted">No overdue or upcoming installments.</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title="Bulk reminder">
          <ReminderForm />
          <p className="mt-2 text-[11px] text-muted">Reminders also go out automatically every morning (due in 3 days and overdue) when WhatsApp, SMS or email is set up in Settings.</p>
        </Card>
      </div>

      <Card title={<>Online payment requests <Badge tone="amber">{openRequests.length} awaiting</Badge></>} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <p className="border-b border-line px-4 py-2 text-xs text-muted">
          Students pay from their portal. Razorpay payments are confirmed automatically; UPI payments need the UTR from your bank statement.
        </p>
        <table className="table">
          <thead><tr><th>Started</th><th>Student</th><th>Amount</th><th>Method</th><th>Status</th><th>Confirm</th></tr></thead>
          <tbody>
            {requests.slice(0, 20).map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td>{student.get(r.student_id)?.full_name}</td>
                <td className="tabular-nums">{inr(r.amount)}</td>
                <td className="uppercase">{r.provider}</td>
                <td><Badge tone={r.status === "paid" ? "green" : r.status === "cancelled" ? "slate" : "amber"}>{r.status === "created" ? "awaiting" : r.status}</Badge>{r.paid_reference && <div className="font-mono text-[10px] text-muted">{r.paid_reference}</div>}</td>
                <td>
                  {r.status === "created" && r.provider === "upi" && (
                    <div className="flex items-center gap-1">
                      <form action={confirmPaymentRequestAction.bind(null, r.id)} className="flex items-center gap-1">
                        <input name="reference" required minLength={4} placeholder="UTR / txn no." aria-label="UPI transaction reference" className="input w-32 py-1" />
                        <button className="btn-primary py-1">Confirm</button>
                      </form>
                      <form action={cancelPaymentRequestAction.bind(null, r.id)}><button className="text-xs text-muted hover:text-brand">Cancel</button></form>
                    </div>
                  )}
                  {r.status === "created" && r.provider === "razorpay" && <span className="text-xs text-muted">Waiting for Razorpay</span>}
                </td>
              </tr>
            ))}
            {!requests.length && <tr><td colSpan={6} className="text-center text-muted">No online payments yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Recent payments" className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Student</th><th>Amount</th><th>Mode</th><th>Reference</th><th /></tr></thead>
          <tbody>
            {payments.slice(0, 15).map((p) => (
              <tr key={p.id}>
                <td>{fmtDate(p.paid_at)}</td>
                <td>{student.get(p.student_id)?.full_name}</td>
                <td className="tabular-nums">{inr(p.amount)}</td>
                <td>{p.mode}</td>
                <td className="font-mono text-xs text-muted">{p.reference ?? "—"}</td>
                <td><Link href={`/fees/receipt/${p.id}`} className="text-xs font-medium text-brand hover:underline">Receipt</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
