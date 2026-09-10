import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Zlata Jewelry", template: "%s | Zlata Jewelry" },
  description: "Jewelry inventory and sales workspace.",
  robots: { index: false, follow: false },
  icons: { icon: "/zlata-logo.png", apple: "/zlata-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="min-h-screen font-sans antialiased">{children}</body></html>;
}
