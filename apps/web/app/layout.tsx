import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppShell } from "../components/app-shell";
import { LocaleProvider } from "../lib/i18n/locale-provider";
import { localeCookieName, normalizeLocale } from "../lib/i18n/locale";
import { readLocalePreference } from "../lib/server/locale-preference";
import { translate } from "../lib/i18n/translate";
import { productName, productTagline } from "../lib/brand";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = readLocalePreference()?.locale ?? normalizeLocale((await cookies()).get(localeCookieName)?.value);
  return {
    title: `${productName} — ${productTagline}`,
    description: translate(locale, "meta.description")
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = readLocalePreference()?.locale ?? normalizeLocale((await cookies()).get(localeCookieName)?.value);
  return (
    <html lang={locale}>
      <body>
        <a className="skip-link" href="#main-content">{translate(locale, "app.skipToMain")}</a>
        <LocaleProvider initialLocale={locale}>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
