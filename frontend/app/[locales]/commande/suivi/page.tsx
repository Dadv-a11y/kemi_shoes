import Link from "next/link";
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
        <section className="checkout-confirmation">
          <h1>{labels.trackTitle}</h1>
          {order ? <PaymentTracker orderId={order} locale={locale} labels={labels} returnReference={reference ?? null} /> : <p>{labels.trackMissing}</p>}
          <Link className="checkout-link-button" href={`/${locale}/boutique`}>{labels.continueShopping}</Link>
        </section>
      </div>
    </main>
  );
}
