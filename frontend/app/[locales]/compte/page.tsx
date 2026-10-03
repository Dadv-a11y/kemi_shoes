import { AccountView } from "@/components/storefront/account-view";
import { getI18n } from "@/locales/server";
import { setStaticParamsLocale } from "next-international/server";

export default async function AccountPage({ params }: { params: Promise<{ locales: string }> }) {
  const { locales } = await params;
  setStaticParamsLocale(locales);
  const t = await getI18n();
  const keys = ["title", "welcome", "orders", "information", "all", "inProgress", "delivered", "cancelled", "order", "viewDetails", "reorder", "shareTitle", "copyLink", "shared", "close", "tracking", "confirmed", "prepared", "shipped", "deliveredStep", "estimated", "items", "details", "address", "payment", "subtotal", "shipping", "total", "followWhatsApp", "needHelp", "profile", "name", "phone", "email", "connection", "connectedGoogle", "edit", "addresses", "defaultAddress", "setDefault", "delete", "addAddress", "signOut", "deleteAccount", "save", "saved", "emptyOrders", "loading", "loginRequired", "loginCta", "hello", "connectedPhone", "connectedEmail", "connectedFacebook", "addressLabel", "fullName", "country", "city", "district", "street", "cancel", "deleteConfirm", "paymentStatus", "paid", "unpaid", "failed", "pending", "noAddress"] as const;
  const labels = Object.fromEntries(keys.map((key) => [key, t(`account.${key}`)]));

  return <AccountView labels={labels} locale={locales === "en" ? "en" : "fr"} />;
}