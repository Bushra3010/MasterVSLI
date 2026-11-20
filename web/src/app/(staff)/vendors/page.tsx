import { Building2, Network } from "lucide-react";
import Link from "next/link";
import { I, Row, Save } from "@/components/form-bits";
import { Card, PageHeader, Stat } from "@/components/ui";
import { inr } from "@/lib/format";
import { getRepo } from "@/lib/server";
import { saveVendorAction } from "../actions";

export const metadata = { title: "Vendors & sub-vendors" };

export default async function VendorsPage() {
  const repo = await getRepo();
  const [{ vendors, allocations, installments, payments }, entries] = await Promise.all([repo.ledger(), repo.financeEntries()]);
  const parents = vendors.filter((v) => !v.parent_id);
  const allocVendor = new Map(allocations.map((a) => [a.id, a.vendor_id]));
  const instById = new Map(installments.map((i) => [i.id, i]));

  const rows = parents.map((v) => {
    const inst = installments.filter((i) => allocVendor.get(i.allocation_id) === v.id);
    const allocated = allocations.filter((a) => a.vendor_id === v.id).reduce((a, x) => a + Number(x.amount), 0);
    const received = inst.reduce((a, i) => a + Number(i.paid_amount), 0);
    const settled = entries.filter((e) => e.kind === "settlement" && e.vendor_id === v.id).reduce((a, e) => a + Number(e.amount), 0);
    const subs = vendors
      .filter((s) => s.parent_id === v.id)
      .map((s) => {
        const si = inst.filter((i) => i.sub_vendor_id === s.id);
        const ids = new Set(si.map((i) => i.id));
        return {
          s,
          due: si.reduce((a, i) => a + Number(i.amount), 0),
          paid: si.reduce((a, i) => a + Number(i.paid_amount), 0),
          students: new Set(si.map((i) => i.student_id)).size,
          payments: payments.filter((p) => ids.has(p.installment_id)).length,
        };
      });
    return { v, allocated, received, settled, students: new Set(inst.map((i) => i.student_id)).size, subs };
  });
  const tot = (k: "allocated" | "received" | "settled") => rows.reduce((a, r) => a + r[k], 0);
  const lastPaid = (vendorId: string) =>
    payments.find((p) => allocVendor.get(instById.get(p.installment_id)?.allocation_id ?? "") === vendorId)?.paid_at;

  return (
    <>
      <PageHeader
        title="Vendors & sub-vendors"
        subtitle="Create vendors and the sub-vendors under them, and see what each has been allocated, collected and settled."
        actions={<Link href="/accounts" className="btn-ghost">Record a settlement →</Link>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vendors / sub-vendors" value={`${parents.length} / ${vendors.length - parents.length}`} />
        <Stat label="Allocated to vendors" value={inr(tot("allocated"))} tone="blue" />
        <Stat label="Collected via vendors" value={inr(tot("received"))} tone="green" />
        <Stat label="Settled with vendors" value={inr(tot("settled"))} tone="amber" hint={`${inr(tot("received") - tot("settled"))} collected but not settled`} />
      </div>

      <Card title="Vendor payments summary" icon={<Network size={15} />} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Vendor → sub-vendor</th><th>Students</th><th>Allocated / due</th><th>Collected</th><th>Pending</th><th>Settled</th><th>Payments</th></tr></thead>
          <tbody>
            {rows.map(({ v, allocated, received, settled, students, subs }) => [
              <tr key={v.id} className="bg-slate-50 font-medium">
                <td>{v.name}</td>
                <td>{students}</td>
                <td className="tabular-nums">{inr(allocated)}</td>
                <td className="tabular-nums text-emerald-700">{inr(received)}</td>
                <td className="tabular-nums text-amber-700">{inr(allocated - received)}</td>
                <td className="tabular-nums">{inr(settled)}</td>
                <td className="text-xs text-muted">{lastPaid(v.id) ? `last ${new Date(lastPaid(v.id)!).toLocaleDateString("en-IN")}` : "—"}</td>
              </tr>,
              ...subs.map(({ s, due, paid, students: n, payments: p }) => (
                <tr key={s.id}>
                  <td className="pl-8 text-sm">↳ {s.name}</td>
                  <td>{n}</td>
                  <td className="tabular-nums">{inr(due)}</td>
                  <td className="tabular-nums">{inr(paid)}</td>
                  <td className="tabular-nums">{inr(due - paid)}</td>
                  <td className="text-muted">—</td>
                  <td>{p}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </Card>

      <Card title="Create vendor → sub-vendor" icon={<Building2 size={15} />} className="mt-5">
        {parents.map((v) => (
          <div key={v.id} className="mb-3 rounded-lg border border-line p-2">
            <Row action={saveVendorAction}>
              <input type="hidden" name="id" value={v.id} />
              <I name="name" value={v.name} w="min-w-36 flex-1 font-medium" required placeholder="Vendor name" />
              <I name="contact_person" value={v.contact_person} w="w-36" placeholder="Contact person" />
              <I name="phone" value={v.phone} w="w-32" placeholder="Phone" />
              <I name="email" type="email" value={v.email} w="w-44" placeholder="Email" />
              <Save />
            </Row>
            <div className="ml-4 border-l-2 border-line pl-3">
              {vendors.filter((s) => s.parent_id === v.id).map((s) => (
                <Row key={s.id} action={saveVendorAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="parent_id" value={v.id} />
                  <I name="name" value={s.name} w="min-w-32 flex-1" required placeholder="Sub-vendor name" />
                  <I name="contact_person" value={s.contact_person} w="w-36" placeholder="Contact person" />
                  <I name="phone" value={s.phone} w="w-32" placeholder="Phone" />
                  <Save />
                </Row>
              ))}
              <Row action={saveVendorAction}>
                <input type="hidden" name="parent_id" value={v.id} />
                <I name="name" w="min-w-32 flex-1" required placeholder={`New sub-vendor under ${v.name}`} />
                <I name="contact_person" w="w-36" placeholder="Contact person" />
                <I name="phone" w="w-32" placeholder="Phone" />
                <Save label="+ Add" />
              </Row>
            </div>
          </div>
        ))}
        <Row action={saveVendorAction}>
          <I name="name" w="min-w-36 flex-1" required placeholder="New vendor name" />
          <I name="contact_person" w="w-36" placeholder="Contact person" />
          <I name="phone" w="w-32" placeholder="Phone" />
          <Save label="+ Add vendor" />
        </Row>
      </Card>
    </>
  );
}
