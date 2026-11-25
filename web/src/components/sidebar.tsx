"use client";

import clsx from "clsx";
import {
  History,
  ArrowDownUp,
  BellRing,
  Building2,
  Contact,
  Cpu,
  Crown,
  Filter,
  BadgeCheck,
  BookOpen,
  FileCheck2,
  Gift,
  ScrollText,
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
  ArrowLeftRight,
  ClipboardCheck,
  FileSpreadsheet,
  Home,
  PieChart,
  Receipt,
  Send,
  Wallet,
  type LucideIcon, CalendarRange } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; icon: LucideIcon };
type Section = { title: string; items: Item[]; adminOnly?: boolean };

/** Staff navigation: one entry per core module. */
const staffNav: Section[] = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports & Analytics", icon: BarChart3 },
      { href: "/alerts", label: "Alerts & Escalation", icon: BellRing },
      { href: "/me", label: "My Workspace", icon: ListTodo },
      { href: "/calendar", label: "Calendar & Reminders", icon: CalendarRange },
    ],
  },
  {
    title: "Admissions",
    items: [
      { href: "/leads", label: "Lead Management", icon: Filter },
      { href: "/students", label: "Student Management", icon: Users },
      { href: "/colleges", label: "College Management", icon: Building2 },
      { href: "/import", label: "Import & Export", icon: ArrowDownUp },
    ],
  },
  {
    title: "Training & Learning",
    items: [
      { href: "/courses", label: "Course & Batch Management", icon: Layers },
      { href: "/learning", label: "Learning & Assessments", icon: BookOpen },
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
    title: "Finance & Fund Flow",
    adminOnly: true,
    items: [
      { href: "/finance", label: "Finance Dashboard", icon: PieChart },
      { href: "/finance/income", label: "Income Management", icon: Wallet },
      { href: "/finance/tenants", label: "Rental Income (Tenants)", icon: Home },
      { href: "/finance/expenses", label: "Expense Management", icon: Receipt },
      { href: "/finance/pay", label: "Payments & Fund Transfer", icon: Send },
      { href: "/finance/receivables", label: "Receivables & Payables", icon: ArrowLeftRight },
      { href: "/finance/accounts", label: "Bank & Cash Accounts", icon: Landmark },
      { href: "/finance/budgets", label: "Budgets & Approvals", icon: ClipboardCheck },
      { href: "/finance/reports", label: "Reports & MIS", icon: FileSpreadsheet },
    ],
  },
  {
    title: "Placements & Growth",
    items: [
      { href: "/placements", label: "Placement Management", icon: Briefcase },
      { href: "/hr-contacts", label: "HR & Company Contacts", icon: Contact },
      { href: "/ambassadors", label: "Brand Ambassadors", icon: Crown },
      { href: "/communication", label: "Communication", icon: MessageCircle },
    ],
  },
  {
    title: "People & Enrich Silicon",
    items: [
      { href: "/hr", label: "Staff & HR (Payroll)", icon: UserCog },
      { href: "/enrich", label: "Enrich Silicon (ERP)", icon: Cpu },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/access", label: "Security & Access Control", icon: ShieldCheck },
      { href: "/audit", label: "Audit Log", icon: History },
      { href: "/settings", label: "Settings & Terms", icon: Settings },
    ],
  },
];

const collegeNav: Section[] = [
  {
    title: "College portal",
    items: [
      { href: "/college", label: "Overview", icon: LayoutDashboard },
      { href: "/college?tab=students", label: "Students & progress", icon: Users },
      { href: "/college?tab=drives", label: "Campus drives & placements", icon: Briefcase },
      { href: "/college?tab=mou", label: "MoU & agreements", icon: FileText },
    ],
  },
];

const studentNav: Section[] = [
  {
    title: "My Training",
    items: [
      { href: "/portal", label: "My Dashboard", icon: GraduationCap },
      { href: "/portal/profile", label: "My Profile", icon: UserCog },
      { href: "/portal/learning", label: "Learning & Assessments", icon: BookOpen },
      { href: "/portal/documents", label: "My Documents", icon: BadgeCheck },
    ],
  },
  {
    title: "Placement",
    items: [
      { href: "/portal/agreement", label: "Placement Agreement", icon: FileCheck2 },
      { href: "/portal/drives", label: "Company Drives", icon: Briefcase },
    ],
  },
  {
    title: "Earn & Account",
    items: [
      { href: "/portal/earn", label: "Earn & Rewards", icon: Gift },
      { href: "/portal/terms", label: "Terms & Conditions", icon: ScrollText },
      { href: "/portal/account", label: "Account", icon: KeyRound },
    ],
  },
];

export function Sidebar({ role, name, demo, signOut }: { role: string; name: string; demo: boolean; signOut: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (role === "student" ? studentNav : role === "college" ? collegeNav : staffNav).filter((sec) => !sec.adminOnly || role === "super_admin" || role === "admin");

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-line px-4">
        <Image src="/logo-official.png" alt="MasterVLSI — Leader In Semiconductor Industry" width={190} height={45} unoptimized priority className="h-10 w-auto" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {nav.map((sec) => (
          <div key={sec.title} className="mb-3">
            <div className="px-2 pb-1.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">{sec.title}</div>
            <div className="space-y-0.5">
              {sec.items.map(({ href, label, icon: Icon }) => {
                const active = path === href || (href !== "/portal" && href !== "/finance" && path.startsWith(href + "/"));
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
        <Image src="/logo-official.png" alt="MasterVLSI — Leader In Semiconductor Industry" width={150} height={36} unoptimized priority className="h-8 w-auto" />
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
