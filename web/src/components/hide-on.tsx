"use client";

import { usePathname } from "next/navigation";

/** Renders children everywhere except the given path (the dashboard shows its own copy in place). */
export function HideOn({ path, children }: { path: string; children: React.ReactNode }) {
  return usePathname() === path ? null : <>{children}</>;
}
