import Link from "next/link";
import { Truck } from "lucide-react";
import { PaymentTracker } from "@/components/cart/payment-tracker";
import { getI18n } from "@/locales/server";
import type { Locale } from "@/lib/catalog";
import { checkoutLabelKeys } from "@/lib/checkout-labels";
import { setStaticParamsLocale } from "next-international/server";

// Page de retour CamPay (carte) et lien de suivi partagé après commande.
export default async function OrderTrackingPage({ params, searchParams }: { params: Promise<{ locales: string }>; searchParams: Promise<{ order?: string; reference?: string }> }) {
  const [{ locales }, { order, reference }] = await Promise.all([params, searchParams]);
  setStaticParamsLocale(locales);
  const locale: Locale = locales === "en" ? "en" : "fr";
  const t = await getI18n();
  const labels = Object.fromEntries(checkoutLabelKeys.map((key) => [key, t(`checkout.${key}`)])) as Record<string, string>;

  return (
    <main className="checkout-page">
      <div className="checkout-body">
        <section className="order-done">
          <div className="order-done-hero"><div className="checkout-confirm-icon order-done-icon-track"><Truck aria-hidden="true" /></div><h1>{labels.trackTitle}</h1></div>
          {order ? <PaymentTracker orderId={order} locale={locale} labels={labels} returnReference={reference ?? null} showReference timeline={[t("account.confirmed"), t("account.prepared"), t("account.shipped"), t("account.deliveredStep")]} /> : <p className="order-done-missing">{labels.trackMissing}</p>}
          <div className="order-done-actions"><Link className="checkout-secondary" href={`/${locale}/boutique`}>{labels.continueShopping}</Link></div>
        </section>
      </div>
    </main>
  );
}
