import Link from "next/link";
import { Flash, Kpi } from "@/components/student360";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { fmtDate, inr, todayISO } from "@/lib/format";
import { requireStudent } from "@/lib/session";
import { getStudent360 } from "@/lib/student360";
import { PAYMENT_MODES } from "@/lib/types";
import { PayNow } from "../pay-now";
import { submitPaymentAction } from "../actions-360";

export const metadata = { title: "Fees & payments" };

const SUB_TONE = { pending: "amber", approved: "green", rejected: "red" } as const;

export default async function PortalFees({ searchParams }: PageProps<"/portal/fees">) {
  const sp = await searchParams;
  const s = await requireStudent();
  const d = await getStudent360(s.studentId);
  if (!d) return <p>Profile not found.</p>;
  const { p, submissions } = d;
  const open = p.installments.filter((i) => i.status !== "paid");
  const waiting = new Set(submissions.filter((x) => x.status === "pending").map((x) => x.installment_id));
  const today = todayISO();

  return (
    <>
      <PageHeader title="Fees & Payments" subtitle="Fee agreement, installments, payment submission, office verification and receipts." />
      <Flash sp={sp} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total fee (agreement)" value={inr(p.fee.total)} />
        <Kpi label="Paid" value={inr(p.fee.paid)} tone="green" />
        <Kpi label="Outstanding" value={inr(Math.max(0, p.fee.balance))} tone={p.fee.balance > 0 ? "amber" : "green"} />
        <Kpi label="Next due" value={p.fee.next_due ? fmtDate(p.fee.next_due) : "—"} tone={p.fee.next_due && p.fee.next_due < today ? "red" : undefined} />
      </div>

      <Card title="Installments" className="mb-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>#</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Status</th><th>Pay</th></tr></thead>
          <tbody>
            {p.installments.map((i) => (
              <tr key={i.id}>
                <td>{i.seq}</td>
                <td className="whitespace-nowrap">{fmtDate(i.due_date)}</td>
                <td className="tabular-nums">{inr(Number(i.amount))}</td>
                <td className="tabular-nums">{inr(Number(i.paid_amount))}</td>
                <td>{waiting.has(i.id) ? <Badge tone="blue">Awaiting office verification</Badge> : <StatusBadge status={i.status !== "paid" && i.due_date < today ? "overdue" : i.status} />}</td>
                <td>{i.status !== "paid" && <PayNow installmentId={i.id} />}</td>
              </tr>
            ))}
            {!p.installments.length && <tr><td colSpan={6} className="text-center text-muted">No installments yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Submit a payment you made" bodyClass="p-4">
          {open.length ? (
            <form action={submitPaymentAction} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="installment_id">Installment</label>
                <select id="installment_id" name="installment_id" required className="input">
                  {open.map((i) => <option key={i.id} value={i.id}>#{i.seq} · due {fmtDate(i.due_date)} · balance {inr(Number(i.amount) - Number(i.paid_amount))}</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor="amount">Amount paid (₹)</label><input id="amount" name="amount" type="number" min={1} step="1" required className="input" /></div>
              <div><label className="label" htmlFor="mode">Payment mode</label><select id="mode" name="mode" className="input">{PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
              <div><label className="label" htmlFor="reference">Transaction / UTR no.</label><input id="reference" name="reference" className="input" placeholder="Not needed for cash" /></div>
              <div><label className="label" htmlFor="paid_on">Paid on</label><input id="paid_on" name="paid_on" type="date" defaultValue={today} max={today} className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="proof">Payment screenshot (optional)</label><input id="proof" name="proof" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="note">Note (optional)</label><input id="note" name="note" className="input" /></div>
              <div className="sm:col-span-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">The receipt is issued only after the office verifies the payment.</span>
                <button className="btn-primary">Submit payment</button>
              </div>
            </form>
          ) : <p className="text-sm text-muted">All installments are paid. Thank you!</p>}
        </Card>

        <Card title={`My submissions (${submissions.length})`} bodyClass="p-0 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Paid on</th><th>Amount</th><th>Mode · ref</th><th>Office verification</th></tr></thead>
            <tbody>
              {submissions.map((x) => (
                <tr key={x.id}>
                  <td className="whitespace-nowrap">{fmtDate(x.paid_on)}</td>
                  <td className="tabular-nums">{inr(Number(x.amount))}</td>
                  <td className="text-xs">{x.mode}{x.reference ? ` · ${x.reference}` : ""}</td>
                  <td><Badge tone={SUB_TONE[x.status]}>{x.status === "pending" ? "Pending verification" : x.status === "approved" ? "Approved" : "Rejected"}</Badge>{x.office_note && <div className="text-[11px] text-muted">{x.office_note}</div>}</td>
                </tr>
              ))}
              {!submissions.length && <tr><td colSpan={4} className="text-center text-muted">Nothing submitted yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title={`Receipts (${p.payments.length})`} className="mt-5" bodyClass="p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Receipt</th></tr></thead>
          <tbody>
            {p.payments.map((x) => (
              <tr key={x.id}>
                <td className="whitespace-nowrap">{fmtDate(x.paid_at)}</td>
                <td className="tabular-nums">{inr(Number(x.amount))}</td>
                <td>{x.mode}</td>
                <td className="text-xs">{x.reference ?? "—"}</td>
                <td><Link href={`/portal/receipt/${x.id}`} className="font-medium text-brand hover:underline">Receipt</Link></td>
              </tr>
            ))}
            {!p.payments.length && <tr><td colSpan={5} className="text-center text-muted">No approved payments yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
