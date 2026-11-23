import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { fmtDate, inr } from "@/lib/format";
import { getRepo } from "@/lib/server";
import type { Client, CompanyProfile, Invoice } from "@/lib/types";

export const metadata = { title: "Invoice" };

/** Tax invoice on the issuing company's own letterhead, GSTIN and bank account (legal separation). */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const inv = await repo.one<Invoice>("invoices", id);
  if (!inv) notFound();
  const [client, profiles] = await Promise.all([inv.client_id ? repo.one<Client>("clients", inv.client_id) : null, repo.list<CompanyProfile>("company_profiles")]);
  const co = profiles.find((p) => p.company === inv.company);
  const gst = (Number(inv.amount) * Number(inv.gst_pct)) / 100;
  const tds = (Number(inv.amount) * Number(inv.tds_pct ?? 0)) / 100;
  const sameState = (co?.gstin ?? "").slice(0, 2) && (co?.gstin ?? "").slice(0, 2) === (client?.gstin ?? "").slice(0, 2);
  return (
    <div className="brand-classic">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <div className="mx-auto max-w-3xl rounded-lg border border-line bg-white p-8 text-sm shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-brand pb-4">
          <div className="flex items-center gap-3">
            {inv.company === "mastervlsi" && <Image src="/logo-mark.svg" alt="MasterVLSI" width={44} height={44} unoptimized className="rounded border border-line" />}
            <div>
              <div className="text-lg font-bold text-navy">{co?.legal_name ?? (inv.company === "enrich" ? "Enrich Silicon" : "MasterVLSI")}</div>
              <div className="text-xs text-muted">{co?.address}</div>
              <div className="text-xs text-muted">GSTIN {co?.gstin ?? "—"} · PAN {co?.pan ?? "—"}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-navy">TAX INVOICE</div>
            <div className="font-mono text-xs">{inv.invoice_no}</div>
            <div className="text-xs text-muted">Date {fmtDate(inv.issue_date)}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div><div className="text-xs text-muted">Bill to</div><div className="font-medium">{client?.name}</div><div className="text-xs">{client?.contact_person}</div><div className="text-xs">GSTIN {client?.gstin ?? "—"}</div></div>
          <div className="text-right"><div className="text-xs text-muted">Status</div><div className="font-medium capitalize">{inv.status}{inv.paid_on ? ` · ${fmtDate(inv.paid_on)}` : ""}</div></div>
        </div>
        <table className="mt-5 w-full text-left">
          <thead className="border-y border-line bg-slate-50 text-xs"><tr><th className="p-2">Description</th><th className="p-2 text-right">Amount</th></tr></thead>
          <tbody>
            <tr className="border-b border-line"><td className="p-2">{inv.description}</td><td className="p-2 text-right tabular-nums">{inr(inv.amount)}</td></tr>
            {sameState ? (
              <>
                <tr><td className="p-2 text-right text-xs text-muted">CGST {Number(inv.gst_pct) / 2}%</td><td className="p-2 text-right tabular-nums">{inr(gst / 2)}</td></tr>
                <tr><td className="p-2 text-right text-xs text-muted">SGST {Number(inv.gst_pct) / 2}%</td><td className="p-2 text-right tabular-nums">{inr(gst / 2)}</td></tr>
              </>
            ) : (
              <tr><td className="p-2 text-right text-xs text-muted">IGST {inv.gst_pct}%</td><td className="p-2 text-right tabular-nums">{inr(gst)}</td></tr>
            )}
            <tr className="border-t border-line font-semibold"><td className="p-2 text-right">Invoice total</td><td className="p-2 text-right tabular-nums">{inr(Number(inv.amount) + gst)}</td></tr>
            {tds > 0 && (
              <>
                <tr><td className="p-2 text-right text-xs text-muted">Less TDS {inv.tds_pct}% (deducted by client)</td><td className="p-2 text-right tabular-nums">− {inr(tds)}</td></tr>
                <tr className="font-semibold"><td className="p-2 text-right">Net receivable</td><td className="p-2 text-right tabular-nums">{inr(Number(inv.amount) + gst - tds)}</td></tr>
              </>
            )}
          </tbody>
        </table>
        <div className="mt-6 rounded-md bg-navy-soft p-3 text-xs">
          <b>Bank details:</b> {co?.bank_name ?? "—"} · A/c {co?.bank_account ?? "—"} · IFSC {co?.bank_ifsc ?? "—"}
          <div className="text-muted">{co?.email} {co?.phone ? `· ${co.phone}` : ""}</div>
        </div>
        <p className="mt-6 text-[11px] text-muted">This is a computer-generated invoice.</p>
      </div>
    </div>
  );
}
