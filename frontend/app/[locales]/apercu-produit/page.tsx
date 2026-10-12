import { ProductPreviewFrame } from "@/components/catalog/product-preview-frame";
import { getI18n } from "@/locales/server";
import type { Locale } from "@/lib/catalog";
import { setStaticParamsLocale } from "next-international/server";

// Page technique du back-office : vide tant qu'aucun produit ne lui est transmis, non indexée.
export const metadata = { robots: { index: false, follow: false } };

export default async function ProductPreviewPage({ params }: { params: Promise<{ locales: string }> }) {
  const { locales } = await params;
  setStaticParamsLocale(locales);
  const locale: Locale = locales === "en" ? "en" : "fr";
  const t = await getI18n();
  return <ProductPreviewFrame locale={locale} labels={{ catalogTitle: t("catalog.title"), handmade: t("product.handmade"), add: t("product.add"), whatsapp: t("product.whatsapp"), color: t("product.color"), size: t("product.size"), material: t("product.material"), customNote: t("product.customNote"), making: t("product.making"), care: t("product.care"), delivery: t("product.delivery") }} />;
}
