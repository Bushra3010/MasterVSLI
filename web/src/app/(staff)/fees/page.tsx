import Link from "next/link";
import { Card, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { recordPaymentAction } from "../actions";

export const metadata = { title: "Fees & vendors" };

export default async function FeesPage({ searchParams }: PageProps<"/fees">) {
  const sp = await searchParams;
  const filter = typeof sp.show === "string" ? sp.show : "due";
  const { vendors, allocations, installments, payments, students } = await (await getRepo()).ledger();
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
      <PageHeader title="Fees, vendors & sub-vendors" subtitle="Each student fee is split across vendors; vendor shares are collected in installments via sub-vendors." />
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
              <Link key={f} href={`/fees?show=${f}`} className={`rounded px-2 py-0.5 capitalize ${filter === f ? "bg-brand text-white" : "text-muted hover:text-brand"}`}>{f}</Link>
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

      <Card title="Recent payments" className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Student</th><th>Amount</th><th>Mode</th><th>Reference</th></tr></thead>
          <tbody>
            {payments.slice(0, 15).map((p) => (
              <tr key={p.id}>
                <td>{fmtDate(p.paid_at)}</td>
                <td>{student.get(p.student_id)?.full_name}</td>
                <td className="tabular-nums">{inr(p.amount)}</td>
                <td>{p.mode}</td>
                <td className="font-mono text-xs text-muted">{p.reference ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
