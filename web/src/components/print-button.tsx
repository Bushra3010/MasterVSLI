"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-navy">
      <Printer size={15} /> {label}
    </button>
  );
}
