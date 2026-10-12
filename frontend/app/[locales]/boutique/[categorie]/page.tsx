import { notFound } from "next/navigation";
import { ShopListing } from "@/components/catalog/shop-listing";
import { getI18n } from "@/locales/server";
import type { Locale } from "@/lib/catalog";
import { getStoreCategories } from "@/lib/catalog-api";
import { setStaticParamsLocale } from "next-international/server";

// Route rendue à la demande : elle n'existe que pour les catégories que l'admin a créées et qui contiennent
// des produits (« nouveautes » disparaît quand aucun produit n'a moins de 14 jours).
export default async function CategoryPage({ params, searchParams }: { params: Promise<{ locales: string; categorie: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locales, categorie } = await params;
  setStaticParamsLocale(locales);
  const locale: Locale = locales === "en" ? "en" : "fr";
  const category = (await getStoreCategories()).find((item) => item.slug === categorie);
  if (!category) notFound();
  const t = await getI18n();
  return <ShopListing locale={locale} category={category.slug} search={await searchParams} title={locale === "en" ? category.nameEn : category.nameFr} intro={t("catalog.intro")} />;
}
