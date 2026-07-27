import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { PLANNING_RAIL_BOOT_SCRIPT } from "@/lib/calendar/planning-prefs";
import { LIBRARY_RAIL_BOOT_SCRIPT } from "@/lib/files/library-prefs";
import "./globals.css";

const appearanceScript = `
(() => {
  const key = "planevo.app.preferences.v1";
  const fallback = { version: 1, theme: "system", minimal: false };
  let preferences = fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    const validTheme = parsed && ["light", "dark", "system"].includes(parsed.theme);
    if (parsed && parsed.version === 1 && validTheme && typeof parsed.minimal === "boolean") {
      preferences = parsed;
    }
  } catch {}
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme =
    preferences.theme === "system" ? (systemDark ? "dark" : "light") : preferences.theme;
  document.documentElement.toggleAttribute("data-minimal", preferences.minimal);
})();`;

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const generalSans = localFont({
  src: [
    { path: "../fonts/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-general-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Planevo",
  description: "The workspace that's ready before you are.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${generalSans.variable} ${inter.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Blocking head scripts (same pattern as appearance) — next/script
            beforeInteractive is root-only and still warns when nested. */}
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
        <script
          dangerouslySetInnerHTML={{ __html: PLANNING_RAIL_BOOT_SCRIPT }}
        />
        <script
          dangerouslySetInnerHTML={{ __html: LIBRARY_RAIL_BOOT_SCRIPT }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
