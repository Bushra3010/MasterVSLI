import type { MetadataRoute } from "next";

/** Makes the ERP installable as a phone/desktop app ("Add to Home screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MasterVLSI ERP",
    short_name: "MasterVLSI",
    description: "Students, attendance, fees, placements and certificates for MasterVLSI.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#3d5ee1",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
