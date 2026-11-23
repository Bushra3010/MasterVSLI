import type { Metadata, Viewport } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "MasterVLSI ERP", template: "%s · MasterVLSI ERP" },
  description: "Training institute ERP — students, attendance, fees, placements and certificates.",
  icons: { icon: [{ url: "/logo-mark.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192" }], apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "MasterVLSI", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#3d5ee1", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${roboto.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
