import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("https://nedb.vercel.app"),
  title: "NEDB — National Energy Data Bank",
  description:
    "Nigeria's authoritative repository of energy statistics. Official platform of the Energy Commission of Nigeria.",
  openGraph: {
    siteName: "NEDB — National Energy Data Bank",
    type: "website",
    images: ["/ecn-logo.png"],
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale: pinch zoom is an accessibility right (WCAG 1.4.4), and
  // capping it was flagged critical by the axe audit.
  viewportFit: "cover",
};

// Applied before first paint so a dark-mode user never sees a white flash.
// Reads the saved appearance; "system" (the default) follows the OS setting.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("nedb_theme");if(t==="dark"||t==="contrast"){document.documentElement.dataset.theme=t}else if(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.dataset.theme="dark"}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full" style={{ fontFamily: "var(--font-sans)", background: "var(--surface)", color: "var(--ink)" }}>
        {/* First tab stop on every page — WCAG 2.4.1 */}
        <a href="#main" className="skip-link">Skip to main content</a>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
