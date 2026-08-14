import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://support-ops-analytics.vercel.app"),
  title: "SignalDesk · Synthetic support operations analytics",
  description:
    "Explore 100,000 deterministic synthetic support tickets with documented KPIs, shareable filters, evidence rows, and CSV export.",
  applicationName: "SignalDesk",
  authors: [{ name: "Jordan Andrade", url: "https://jord-andrade.dev" }],
  keywords: ["support analytics", "synthetic data", "operations dashboard", "Next.js", "TypeScript"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "SignalDesk · Act on the signal",
    description: "A public, privacy-safe support operations analytics case study over 100,000 synthetic tickets.",
    url: "/",
    siteName: "SignalDesk",
  },
  twitter: {
    card: "summary_large_image",
    title: "SignalDesk · Support operations analytics",
    description: "100,000 synthetic tickets. Explicit targets. Verifiable decisions.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
