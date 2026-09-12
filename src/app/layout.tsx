import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: { default: "Zlata Jewelry", template: "%s | Zlata Jewelry" },
  description: "Jewelry inventory and sales workspace.",
  robots: { index: false, follow: false },
  icons: { icon: "/zlata-logo.png", apple: "/zlata-logo.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return <html lang={locale === "ua" ? "uk" : "en"}><body className="min-h-screen font-sans antialiased"><I18nProvider locale={locale}>{children}</I18nProvider></body></html>;
}
