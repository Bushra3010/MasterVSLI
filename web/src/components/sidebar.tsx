"use client";

import clsx from "clsx";
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  FileText,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldBan,
  Users,
  Briefcase,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const staffNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/attendance", label: "Attendance", icon: CalendarDays },
  { href: "/fees", label: "Fees & Vendors", icon: IndianRupee },
  { href: "/validity", label: "Validity & Expiry", icon: CalendarClock },
  { href: "/access", label: "Access Control", icon: ShieldBan },
  { href: "/placements", label: "Placements", icon: Briefcase },
  { href: "/documents", label: "Letters & Certificates", icon: FileText },
];
const studentNav = [
  { href: "/portal", label: "My Dashboard", icon: GraduationCap },
  { href: "/portal/drives", label: "Placement Drives", icon: Briefcase },
  { href: "/portal/documents", label: "My Documents", icon: BadgeCheck },
];

export function Sidebar({ role, name, demo, signOut }: { role: string; name: string; demo: boolean; signOut: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = role === "student" ? studentNav : staffNav;

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Image src="/logo.png" alt="" width={40} height={40} className="rounded" />
        <div className="leading-tight">
          <div className="font-semibold text-navy">
            Master<span className="text-brand">VLSI</span>
          </div>
          <div className="text-[11px] text-muted">Institute ERP</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/portal" && path.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                active ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-slate-50 hover:text-ink",
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-3">
        {demo && <div className="mb-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Demo mode — data resets on restart</div>}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="text-xs text-muted capitalize">{role}</div>
          </div>
          <form action={signOut}>
            <button className="rounded p-2 text-muted hover:bg-slate-100 hover:text-brand" title="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-2 lg:hidden">
        <span className="font-semibold text-navy">
          Master<span className="text-brand">VLSI</span> ERP
        </span>
        <button onClick={() => setOpen(true)} className="p-2" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-white lg:block">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button className="absolute top-3 right-3 p-1" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
