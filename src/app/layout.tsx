import type { Metadata, Viewport } from "next";
import { Manrope, Public_Sans } from "next/font/google";
import { AppBootstrap } from "@/components/app/app-bootstrap";
import { Toaster } from "@/components/app/toaster";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JKTL Business",
  description: "Manage your customers, sales, bookings, inventory and invoices — all in one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "JKTL Business",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f6e5c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${publicSans.variable}`}>
      <body className="font-body antialiased">
        <AppBootstrap />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
