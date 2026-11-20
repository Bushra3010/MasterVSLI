import { Bell, CalendarRange, Maximize2, MessageSquare, Search, Settings } from "lucide-react";
import Link from "next/link";

/** Top header bar (desktop): search, date & time, academic year, shortcuts and the signed-in user. */
export function Topbar({ name, staff }: { name: string; staff: boolean }) {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const fyStart = ist.getUTCMonth() >= 3 ? y : y - 1; // Indian academic/financial year starts in April
  const date = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const icon = "grid size-8 place-items-center rounded-[5px] text-muted hover:bg-slate-100 hover:text-brand";

  return (
    <header className="no-print sticky top-0 z-10 hidden h-[60px] items-center gap-4 border-b border-line bg-white px-6 lg:ml-64 lg:flex">
      {staff && (
        <form action="/students" className="relative w-64">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input name="q" placeholder="Search students" aria-label="Search students" className="input py-1.5 pl-8" />
        </form>
      )}
      <div className="leading-tight">
        <div className="text-[10px] text-muted">Date &amp; time</div>
        <div className="text-xs text-navy">{date} - {time}</div>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="mr-2 inline-flex items-center gap-1.5 rounded-[5px] border border-line px-2.5 py-1.5 text-xs text-[#515b73]">
          <CalendarRange size={13} /> Academic Year : {fyStart} / {fyStart + 1}
        </span>
        {staff && (
          <>
            <Link href="/communication" className={icon} title="Notifications"><Bell size={16} /></Link>
            <Link href="/communication" className={icon} title="Messages"><MessageSquare size={16} /></Link>
            <Link href="/reports" className={icon} title="Reports"><Maximize2 size={15} /></Link>
            <Link href="/settings" className={icon} title="Settings"><Settings size={16} /></Link>
          </>
        )}
        <span className="ml-1 grid size-8 place-items-center rounded-[5px] bg-brand text-xs font-medium text-white" title={name}>{initials}</span>
      </div>
    </header>
  );
}
