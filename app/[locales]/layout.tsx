import { notFound } from "next/navigation";
import { setStaticParamsLocale } from 'next-international/server';
import { I18nProviderClient } from "@/locales/client";
import { getStaticParams } from '@/locales/server'

const locales = ["fr", "en"] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locales: locale }));
  return getStaticParams();
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locales: string }> }) {
  const { locales: locale } = await params;
  setStaticParamsLocale(locale);

  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  return <I18nProviderClient locale={locale as (typeof locales)[number]}>{children}</I18nProviderClient>;
}
