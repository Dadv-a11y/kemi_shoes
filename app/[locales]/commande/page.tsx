import { CheckoutView } from "@/components/cart/checkout-view";
import { getI18n } from "@/locales/server";
import type { Locale } from "@/lib/catalog";

export default async function CheckoutPage({ params }: { params: Promise<{ locales: string }> }) {
  const { locales } = await params;
  const locale: Locale = locales === "en" ? "en" : "fr";
  const t = await getI18n();
  const keys = ["delivery", "payment", "confirmation", "guest", "login", "fullName", "fullNamePlaceholder", "phone", "phonePlaceholder", "email", "emailPlaceholder", "country", "city", "cityPlaceholder", "neighborhood", "neighborhoodPlaceholder", "address", "addressPlaceholder", "estimated", "estimatedDetail", "continuePayment", "yourOrder", "subtotal", "shipping", "total", "mobileMoney", "mobileMoneyNote", "mobileNumber", "card", "cardNumber", "expiration", "cvc", "cod", "codNote", "continueSummary", "editDelivery", "summary", "deliveryAddress", "paymentMethod", "items", "edit", "accept", "confirm", "thanks", "confirmationSent", "order", "paidTotal", "follow", "createAccount", "createAccountText", "create", "continueShopping", "secure", "required", "invalidEmail"] as const;
  const labels = Object.fromEntries(keys.map((key) => [key, t(`checkout.${key}`)])) as Record<string, string>;
  labels.size = t("cart.size");

  return <CheckoutView locale={locale} labels={labels} />;
}
