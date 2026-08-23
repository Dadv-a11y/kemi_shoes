import { notFound } from "next/navigation";
import { I18nProviderClient } from "@/locales/client";

const locales = ["fr", "en"] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locales: locale }));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locales: string }> }) {
  const { locales: locale } = await params;

  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  return <I18nProviderClient locale={locale as (typeof locales)[number]}>{children}</I18nProviderClient>;
}
