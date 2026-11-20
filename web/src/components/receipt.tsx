import Image from "next/image";
import { fmtDate, inr } from "@/lib/format";
import type { Repo } from "@/lib/repo";
import { PrintButton } from "./print-button";

export async function loadReceipt(repo: Repo, paymentId: string) {
  const payment = await repo.payment(paymentId);
  if (!payment) return null;
  const [p, ledger] = await Promise.all([repo.profile(payment.student_id), repo.ledger()]);
  if (!p) return null;
  const inst = ledger.installments.find((i) => i.id === payment.installment_id);
  const alloc = ledger.allocations.find((a) => a.id === inst?.allocation_id);
  const vendor = ledger.vendors.find((v) => v.id === alloc?.vendor_id);
  const sub = ledger.vendors.find((v) => v.id === inst?.sub_vendor_id);
  return { payment, p, inst, vendor, sub };
}

/** Fee receipt with institute branding; prints to PDF. Receipt no. is derived from the payment id. */
export function Receipt({ data }: { data: NonNullable<Awaited<ReturnType<typeof loadReceipt>>> }) {
  const { payment, p, inst, vendor, sub } = data;
  const no = `MV-RCT-${payment.paid_at.slice(0, 4)}-${payment.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const row = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[10rem_1fr] border-b border-line py-2 text-sm"><span className="text-muted">{k}</span><span className="font-medium">{v}</span></div>
  );
  return (
    <div className="brand-classic">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <div className="mx-auto max-w-2xl rounded-lg border border-line bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-center justify-between border-b-2 border-brand pb-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="" width={48} height={48} className="rounded" />
            <div>
              <div className="text-xl font-bold text-navy">Master<span className="text-brand">VLSI</span></div>
              <div className="text-xs text-muted">VLSI Training &amp; Placement Institute</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-navy">FEE RECEIPT</div>
            <div className="font-mono text-xs text-muted">{no}</div>
          </div>
        </div>
        <div className="mt-4">
          {row("Received from", `${p.student.full_name} (${p.student.enrollment_no})`)}
          {row("Course", p.course?.name ?? "—")}
          {row("Date", fmtDate(payment.paid_at))}
          {row("Towards", `Installment ${inst?.seq ?? "—"}${vendor ? ` · ${vendor.name}${sub ? ` → ${sub.name}` : ""}` : ""}`)}
          {row("Payment mode", payment.mode)}
          {row("Transaction ref.", payment.reference ?? "—")}
        </div>
        <div className="mt-5 flex items-center justify-between rounded-md bg-navy-soft px-4 py-3">
          <span className="text-sm text-navy">Amount received</span>
          <span className="text-2xl font-bold text-navy tabular-nums">{inr(payment.amount)}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
          <div className="rounded border border-line p-2"><div className="text-muted">Total fee</div><div className="font-semibold">{inr(p.fee.total)}</div></div>
          <div className="rounded border border-line p-2"><div className="text-muted">Paid to date</div><div className="font-semibold text-emerald-700">{inr(p.fee.paid)}</div></div>
          <div className="rounded border border-line p-2"><div className="text-muted">Balance</div><div className="font-semibold text-brand">{inr(p.fee.balance)}</div></div>
        </div>
        <p className="mt-8 text-[11px] text-muted">This is a computer-generated receipt and does not need a signature.</p>
      </div>
    </div>
  );
}
