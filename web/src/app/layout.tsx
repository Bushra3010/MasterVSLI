import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "MasterVLSI ERP", template: "%s · MasterVLSI ERP" },
  description: "Training institute ERP — students, attendance, fees, placements and certificates.",
  icons: { icon: "/logo.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "MasterVLSI", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0f2a4a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
