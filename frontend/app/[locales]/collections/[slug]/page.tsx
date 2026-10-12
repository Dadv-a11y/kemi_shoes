import { notFound } from "next/navigation";
import { ShopListing } from "@/components/catalog/shop-listing";
import type { Locale } from "@/lib/catalog";
import { getStoreCollections } from "@/lib/catalog-api";
import { setStaticParamsLocale } from "next-international/server";

export default async function CollectionPage({ params, searchParams }: { params: Promise<{ locales: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locales, slug } = await params;
  setStaticParamsLocale(locales);
  const locale: Locale = locales === "en" ? "en" : "fr";
  const collection = (await getStoreCollections()).items.find((item) => item.slug === slug);
  if (!collection) notFound();
  return <ShopListing locale={locale} collection={collection.slug} search={await searchParams} title={locale === "en" ? collection.nameEn : collection.nameFr} intro={(locale === "en" ? collection.descriptionEn : collection.descriptionFr) ?? undefined} />;
}
