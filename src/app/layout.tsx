import type { Metadata } from "next";
import { DM_Serif_Display, Manrope } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale } from "@/lib/i18n/server";

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-manrope",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-dm-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Zlata Jewelry", template: "%s | Zlata Jewelry" },
  description: "Jewelry inventory and sales workspace.",
  robots: { index: false, follow: false },
  icons: { icon: "/logoZlataBrown.png", apple: "/logoZlataBrown.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return <html lang={locale === "ua" ? "uk" : "en"} data-theme="light" suppressHydrationWarning className={`${manrope.variable} ${dmSerif.variable}`}>
    <head>
      <script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('zlata-theme')==='dark'?'dark':'light'}catch{}" }} />
    </head>
    <body className="min-h-screen font-sans antialiased"><I18nProvider locale={locale}>{children}</I18nProvider></body>
  </html>;
}
