"use client";

import { useEffect, useRef, useState } from "react";

/** Student photo; shows initials when there is no photo or the file can't be loaded. */
export function ProfilePhoto({ src, name, className = "" }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // The image may fail before the page becomes interactive, when onError has not been attached yet.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  if (!src || failed)
    return <div className={`grid place-items-center bg-[#1d3c8f] text-3xl font-semibold text-white ${className}`} title="Upload a photo under Documents">{initials}</div>;
  // eslint-disable-next-line @next/next/no-img-element -- served by the permission-checked documents route
  return <img ref={img} src={src} alt={`Photo of ${name}`} onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}
