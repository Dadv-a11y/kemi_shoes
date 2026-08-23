import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { getI18n } from "@/locales/server";
import { formatPrice, getProductBySlug, products, type Locale } from "@/lib/catalog";
import { ProductPurchasePanel } from "@/components/catalog/product-purchase-panel";

export async function generateStaticParams() {
  return products.flatMap((product) => [
    { locales: "fr", slug: product.slug.fr },
    { locales: "en", slug: product.slug.en },
  ]);
}

export default async function ProductPage({ params }: { params: Promise<{ locales: string; slug: string }> }) {
  const { locales, slug } = await params;
  const t = await getI18n();
  const locale: Locale = locales === "en" ? "en" : "fr";
  const product = getProductBySlug(slug);

  if (!product) notFound();

  return (
    <main className="product-page">
      <div className="product-breadcrumb"><Link href="/boutique"><ArrowLeft aria-hidden="true" /> {t("catalog.title")}</Link></div>
      <section className="product-layout section">
        <div className="product-gallery"><div className="product-main-image"><Image src={product.image} alt={product.name[locale]} fill priority sizes="(max-width: 768px) 100vw, 55vw" /></div><Badge variant="secondary" className="product-handmade">{t("product.handmade")}</Badge></div>
        <div className="product-details"><span className="eyebrow">KEMI SHOES</span><h1>{product.name[locale]}</h1><strong className="product-price">{formatPrice(product.price, locale)}</strong><p className="product-description">{t("product.description")}</p><ProductPurchasePanel addLabel={t("product.add")} whatsappLabel={t("product.whatsapp")} /><Accordion className="product-accordion" defaultValue={["making"]} multiple><AccordionItem value="making"><AccordionTrigger>{t("product.making")}</AccordionTrigger><AccordionContent>Chaque paire est découpée, assemblée et finie à la main dans notre atelier à Douala.</AccordionContent></AccordionItem><AccordionItem value="care"><AccordionTrigger>{t("product.care")}</AccordionTrigger><AccordionContent>Protégez le cuir de l'humidité et nourrissez-le régulièrement avec un produit adapté.</AccordionContent></AccordionItem><AccordionItem value="delivery"><AccordionTrigger>{t("product.delivery")}</AccordionTrigger><AccordionContent>Livraison partout au Cameroun et paiement à la livraison selon la zone.</AccordionContent></AccordionItem></Accordion></div>
      </section>
      <section className="product-related section"><span className="eyebrow">KEMI SHOES</span><h2>Vous aimerez aussi <ArrowUpRight aria-hidden="true" /></h2></section>
    </main>
  );
}
