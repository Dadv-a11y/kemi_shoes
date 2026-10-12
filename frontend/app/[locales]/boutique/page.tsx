import { redirect } from "next/navigation";
import { ShopListing } from "@/components/catalog/shop-listing";
import { getI18n } from "@/locales/server";
import type { Locale } from "@/lib/catalog";
import { setStaticParamsLocale } from "next-international/server";

export default async function ShopPage({ params, searchParams }: { params: Promise<{ locales: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locales } = await params;
  setStaticParamsLocale(locales);
  const locale: Locale = locales === "en" ? "en" : "fr";
  const search = await searchParams;
  // Anciens liens /boutique?categorie=homme : la catégorie est désormais une sous-route.
  const legacy = Array.isArray(search.categorie) ? search.categorie[0] : search.categorie;
  if (legacy && legacy !== "tous") redirect(`/${locale}/boutique/${encodeURIComponent(legacy)}`);
  const t = await getI18n();
  return <ShopListing locale={locale} search={search} title={t("catalog.title")} intro={t("catalog.intro")} />;
}
