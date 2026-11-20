"use client";

import clsx from "clsx";
import {
  BadgeCheck,
  BarChart3,
  Briefcase,
  CalendarClock,
  CalendarDays,
  FileText,
  GraduationCap,
  IndianRupee,
  KeyRound,
  Landmark,
  Layers,
  ListTodo,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Monitor,
  Network,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; icon: LucideIcon };
type Section = { title: string; items: Item[] };

/** Staff navigation: one entry per core module. */
const staffNav: Section[] = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports & Dashboard", icon: BarChart3 },
      { href: "/me", label: "My Workspace", icon: ListTodo },
    ],
  },
  {
    title: "Students & Training",
    items: [
      { href: "/students", label: "Student Management", icon: Users },
      { href: "/courses", label: "Course & Batch Management", icon: Layers },
      { href: "/attendance", label: "Attendance Management", icon: CalendarDays },
      { href: "/validity", label: "Training Validity & Expiry", icon: CalendarClock },
      { href: "/documents", label: "Certificates & Letters", icon: FileText },
      { href: "/lab", label: "System / Lab Management", icon: Monitor },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/fees", label: "Fees Management", icon: IndianRupee },
      { href: "/vendors", label: "Vendor & Subvendor Management", icon: Network },
      { href: "/accounts", label: "Accounts & Finance", icon: Landmark },
    ],
  },
  {
    title: "Placements & People",
    items: [
      { href: "/placements", label: "Placement Management", icon: Briefcase },
      { href: "/hr", label: "Staff & HR Management", icon: UserCog },
      { href: "/communication", label: "Communication", icon: MessageCircle },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/access", label: "Security & Access Control", icon: ShieldCheck },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const studentNav: Section[] = [
  {
    title: "My Training",
    items: [
      { href: "/portal", label: "My Dashboard", icon: GraduationCap },
      { href: "/portal/drives", label: "Placement Drives", icon: Briefcase },
      { href: "/portal/documents", label: "My Documents", icon: BadgeCheck },
      { href: "/portal/account", label: "Account", icon: KeyRound },
    ],
  },
];

export function Sidebar({ role, name, demo, signOut }: { role: string; name: string; demo: boolean; signOut: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = role === "student" ? studentNav : staffNav;

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-line px-4">
        <Image src="/logo.png" alt="" width={34} height={34} className="rounded" />
        <div className="leading-tight">
          <div className="text-[15px] font-bold text-navy">
            Master<span className="text-brand">VLSI</span>
          </div>
          <div className="text-[10px] text-muted">Training & Placement ERP</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {nav.map((sec) => (
          <div key={sec.title} className="mb-3">
            <div className="px-2 pb-1.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">{sec.title}</div>
            <div className="space-y-0.5">
              {sec.items.map(({ href, label, icon: Icon }) => {
                const active = path === href || (href !== "/portal" && path.startsWith(href + "/"));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex items-center gap-2.5 rounded-[5px] px-2.5 py-2 text-[13px]",
                      active ? "bg-brand-soft font-medium text-brand" : "text-[#515b73] hover:bg-slate-50 hover:text-brand",
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="leading-tight">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-line p-3">
        {demo && <div className="mb-2 rounded-[5px] bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Demo mode: data resets on restart</div>}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-medium text-white">
              {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-navy">{name}</div>
              <div className="text-[11px] text-muted capitalize">{role}</div>
            </div>
          </div>
          <form action={signOut}>
            <button className="rounded-[5px] p-2 text-muted hover:bg-slate-100 hover:text-brand" title="Sign out">
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
        <span className="font-bold text-navy">
          Master<span className="text-brand">VLSI</span> ERP
        </span>
        <button onClick={() => setOpen(true)} className="p-2" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-white lg:block">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button className="absolute top-4 right-3 p-1" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
