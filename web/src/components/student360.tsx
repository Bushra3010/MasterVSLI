import Link from "next/link";
import { BellRing, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import type { ActionItem } from "@/lib/types";
import { ackReminderAction } from "@/app/portal/actions-360";

const TONE: Record<ActionItem["tone"], string> = {
  red: "border-l-red-600 bg-red-50/70",
  amber: "border-l-amber-500 bg-amber-50/70",
  blue: "border-l-sky-600 bg-sky-50/70",
};

function Row({ a, back, showAck }: { a: ActionItem; back: string; showAck: boolean }) {
  return (
    <li className={clsx("flex items-start justify-between gap-3 rounded-r-[5px] border-l-4 px-3 py-2", TONE[a.tone])}>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-navy">{a.title}</div>
        <div className="text-[11px] text-muted">{a.detail}</div>
        {showAck && a.ackable && (
          <form action={ackReminderAction.bind(null, a.key)} className="mt-1.5">
            <input type="hidden" name="back" value={back} />
            <button className="rounded-[5px] border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-navy hover:bg-slate-50">Acknowledge</button>
          </form>
        )}
      </div>
      <Link href={a.href} className="shrink-0 rounded-[5px] border border-line bg-white px-2.5 py-1 text-xs font-medium text-navy hover:bg-slate-50">View</Link>
    </li>
  );
}

/** Pending activities with "View" and, for informational ones, "Acknowledge". */
export function ActionList({ items, back, showAck = true, limit }: { items: ActionItem[]; back: string; showAck?: boolean; limit?: number }) {
  if (!items.length)
    return (
      <p className="flex items-center gap-2 rounded-[5px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 size={16} /> All caught up — nothing pending.
      </p>
    );
  return <ul className="space-y-2">{items.slice(0, limit).map((a) => <Row key={a.key} a={a} back={back} showAck={showAck} />)}</ul>;
}

/** The reminder center shown at the top of every student page until each activity is resolved. */
export function ActionStrip({ items, back = "/portal" }: { items: ActionItem[]; back?: string }) {
  if (!items.length) return null;
  return (
    <details open className="no-print group mb-5 rounded-[5px] border border-line bg-white shadow-sm" data-testid="action-strip">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-navy">
          <BellRing size={15} className="text-brand" /> My Action &amp; Reminder Center ({items.length})
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-[5px] border border-line px-2 py-0.5 text-xs text-navy group-open:hidden">Expand</span>
          <span className="hidden rounded-[5px] border border-line px-2 py-0.5 text-xs text-navy group-open:inline">Collapse</span>
          <Link href="/portal#actions" className="rounded-[5px] border border-line px-2 py-0.5 text-xs text-navy hover:bg-slate-50">View all</Link>
        </span>
      </summary>
      <div className="border-t border-line p-3">
        <ActionList items={items} back={back} showAck={false} limit={4} />
        {items.length > 4 && <div className="mt-2 text-right text-xs"><Link href="/portal#actions" className="text-brand underline">+{items.length - 4} more</Link></div>}
      </div>
    </details>
  );
}

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = typeof sp.saved === "string" ? sp.saved : null;
  const err = typeof sp.error === "string" ? sp.error : null;
  if (!ok && !err) return null;
  return err ? (
    <div role="alert" className="mb-4 rounded-[5px] border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
  ) : (
    <div role="status" className="mb-4 rounded-[5px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</div>
  );
}

export function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "red" | "amber" | "green" }) {
  return (
    <div className="rounded-[5px] border border-line bg-white px-3 py-2.5 shadow-sm">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={clsx("mt-0.5 text-xl font-semibold tabular-nums", tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "green" ? "text-emerald-600" : "text-navy")}>{value}</div>
    </div>
  );
}
