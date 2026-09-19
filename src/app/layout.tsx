import type { Metadata, Viewport } from "next";
import { jetBrainsMono, ALL_SITE_FONT_VARIABLES } from "@/lib/fonts";
import { AppBootstrap } from "@/components/app/app-bootstrap";
import { Toaster } from "@/components/app/toaster";
import "./globals.css";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#112055" },
    { media: "(prefers-color-scheme: dark)", color: "#020818" },
  ],
};

// Sets `data-theme` on <html> before the page paints, so a dashboard user
// who has chosen "light" or "dark" (stored by `ThemeToggle`) never sees a
// flash of the wrong theme while React hydrates. Left unset entirely for
// "system" (the default) — the `prefers-color-scheme` media query in
// globals.css handles that case on its own, with no JS involved.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("jktl-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script above intentionally sets
    // `data-theme` on this element from localStorage before React
    // hydrates, so the server-rendered markup (which has no attribute —
    // the server can't read the browser's localStorage) and the first
    // client paint legitimately differ on this one attribute. This tells
    // React that's expected here, rather than treating it as a bug.
    <html lang="en" className={`${jetBrainsMono.variable} ${ALL_SITE_FONT_VARIABLES}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-body antialiased">
        <AppBootstrap />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
