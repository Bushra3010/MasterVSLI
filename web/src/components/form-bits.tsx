import type { ReactNode } from "react";

/** Small inline-edit building blocks shared by the master-data pages. */
export const I = ({ name, value, placeholder, type = "text", w = "", required }: { name: string; value?: string | number | null; placeholder?: string; type?: string; w?: string; required?: boolean }) => (
  <input name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} required={required} aria-label={placeholder ?? name} className={`input py-1.5 ${w}`} />
);

export const Save = ({ label = "Save" }: { label?: string }) => <button className="btn-navy py-1.5 text-xs whitespace-nowrap">{label}</button>;

export const Row = ({ children, action }: { children: ReactNode; action: (f: FormData) => Promise<void> }) => (
  <form action={action} className="flex flex-wrap items-center gap-2 border-b border-line py-2 last:border-0">{children}</form>
);
