import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-medium text-navy">{title}</h1>
        <nav className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted" aria-label="Breadcrumb">
          <span>Dashboard</span><span>/</span><span className="text-navy">{title}</span>
        </nav>
        {subtitle && <p className="mt-1.5 max-w-3xl text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, icon, actions, children, className, bodyClass }: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={clsx("overflow-hidden rounded-[5px] border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 text-navy">
          <h2 className="flex items-center gap-2 text-[15px] font-medium [&_svg]:text-brand">
            {icon}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className={clsx("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

const tones = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent", tones[tone])}>
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  active: "green",
  on_hold: "amber",
  expired: "red",
  completed: "blue",
  dropped: "slate",
  paid: "green",
  partial: "amber",
  pending: "slate",
  overdue: "red",
  open: "green",
  upcoming: "blue",
  closed: "slate",
  yes: "green",
  no: "red",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? "slate"}>{status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export function Stat({ label, value, hint, tone = "navy", icon }: { label: string; value: ReactNode; hint?: string; tone?: "navy" | "green" | "amber" | "red" | "blue"; icon?: ReactNode }) {
  const color = { navy: "text-brand", green: "text-emerald-600", amber: "text-amber-600", red: "text-red-600", blue: "text-sky-600" }[tone];
  return (
    <div className="rounded-[5px] border border-line bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start gap-3">
        {icon && <span className={clsx("grid size-10 shrink-0 place-items-center rounded-[5px] bg-navy-soft", color)}>{icon}</span>}
        <div className="min-w-0">
          <div className={clsx("text-xl font-medium tabular-nums", tone === "navy" ? "text-navy" : color)}>{value}</div>
          <div className="text-[13px] text-muted">{label}</div>
        </div>
      </div>
      {hint && <div className="mt-3 border-t border-line pt-2 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(110px,40%)_1fr] gap-2 py-1 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium break-words">{value || <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function Progress({ value, tone }: { value: number; tone?: "green" | "amber" | "red" }) {
  const t = tone ?? (value >= 75 ? "green" : value >= 60 ? "amber" : "red");
  const bg = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }[t];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={clsx("h-full rounded-full", bg)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
