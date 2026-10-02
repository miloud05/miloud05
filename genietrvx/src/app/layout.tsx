import type { Metadata, Viewport } from "next";
import { Cairo, Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { AppProvider } from "@/components/providers/AppProvider";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/server/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "GenieTRVX — Gestion de chantiers BTP", template: "%s · GenieTRVX" },
  description:
    "GenieTRVX : ERP bilingue français/arabe pour les entreprises du BTP en Algérie — chantiers, marchés, situations, paie IRG/CNAS, pointage, stock et engins.",
  applicationName: "GenieTRVX",
};

export const viewport: Viewport = {
  themeColor: "#0f2340",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem('gtx_theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const lang = normalizeLang(jar.get(LANG_COOKIE)?.value);
  const user = await getCurrentUser();

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={`${inter.variable} ${cairo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <AppProvider lang={lang} user={user}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
