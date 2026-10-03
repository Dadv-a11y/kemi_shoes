import { CheckoutView } from "@/components/cart/checkout-view";
import { getI18n } from "@/locales/server";
import type { Locale } from "@/lib/catalog";
import { checkoutLabelKeys } from "@/lib/checkout-labels";
import { setStaticParamsLocale } from "next-international/server";

export default async function CheckoutPage({ params }: { params: Promise<{ locales: string }> }) {
  const { locales } = await params;
  setStaticParamsLocale(locales);
  const locale: Locale = locales === "en" ? "en" : "fr";
  const t = await getI18n();
  const labels = Object.fromEntries(checkoutLabelKeys.map((key) => [key, t(`checkout.${key}`)])) as Record<string, string>;
  labels.size = t("cart.size");

  return <CheckoutView locale={locale} labels={labels} />;
}
