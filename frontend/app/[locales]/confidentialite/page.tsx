import { LegalPage } from "@/components/storefront/legal-page";
import type { Locale } from "@/lib/catalog";

export default async function Page({ params }: { params: Promise<{ locales: string }> }) {
  const { locales } = await params;
  const locale: Locale = locales === "en" ? "en" : "fr";
  return <LegalPage locale={locale} document="confidentialite" />;
}
