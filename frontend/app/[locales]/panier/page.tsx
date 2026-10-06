import { CartView } from "@/components/cart/cart-view";
import { getI18n } from "@/locales/server";
import type { Locale } from "@/lib/catalog";
import { setStaticParamsLocale } from "next-international/server";

export default async function CartPage({ params }: { params: Promise<{ locales: string }> }) {
  const { locales } = await params;
  setStaticParamsLocale(locales);
  const locale: Locale = locales === "en" ? "en" : "fr";
  const t = await getI18n();
  const keys = ["title", "emptyTitle", "emptyText", "discover", "clear", "deliveryTo", "destination", "edit", "size", "color", "material", "personalized", "remove", "promo", "promoPlaceholder", "apply", "summary", "subtotal", "delivery", "discount", "total", "totalNote", "checkout", "secure", "returns", "recommendations", "filledPreview", "emptyPreview", "preview"] as const;
  const labels = Object.fromEntries(keys.map((key) => [key, t(`cart.${key}`)])) as Record<(typeof keys)[number], string>;

  // Libellés de catégorie pour les cards de suggestion (identiques à celles de la boutique).
  const categoryLabels = Object.fromEntries((["femme", "homme", "nouveautes", "couple-enfant"] as const).map((category) => [category, t(`catalog.categories.${category}`)]));

  return <CartView locale={locale} labels={labels} categoryLabels={categoryLabels} />;
}