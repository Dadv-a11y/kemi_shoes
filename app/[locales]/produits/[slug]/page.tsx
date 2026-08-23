import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, ChevronRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { getI18n } from "@/locales/server";
import { formatPrice, getProductBySlug, products, type Locale } from "@/lib/catalog";
import { ProductPurchasePanel } from "@/components/catalog/product-purchase-panel";
import { ProductReviews } from "@/components/catalog/product-reviews";

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

  const relatedProducts = products.filter((item) => item.slug.fr !== product.slug.fr).slice(0, 4);
  const galleryImages = [product.image];

  return (
    <main className="product-page">
      <div className="product-breadcrumb"><Link href={`/${locale}/boutique`}><ArrowLeft aria-hidden="true" /> {t("catalog.title")}</Link><ChevronRight aria-hidden="true" /><span>{product.name[locale]}</span></div>
      <section className="product-layout section">
        <div className="product-gallery"><div className="product-main-image"><Image src={galleryImages[0]} alt={product.name[locale]} fill priority sizes="(max-width: 768px) 100vw, 55vw" /><span className="gallery-caption">Photo produit — vue 1</span><span className="gallery-dots"><i /><i /><i /><i /></span></div><div className="product-thumbnails">{galleryImages.map((image, index) => <button type="button" className="product-thumbnail active" key={image} aria-label={`Vue ${index + 1} de ${product.name[locale]}`}><Image src={image} alt="" fill sizes="84px" /></button>)}</div><Badge variant="secondary" className="product-handmade">{t("product.handmade")}</Badge></div>
        <div className="product-details"><span className="eyebrow">{t(`catalog.categories.${product.category}` as "catalog.categories.tous")}</span><h1>{product.name[locale]}</h1><p className="product-subtitle">{product.subtitle[locale]}</p><div className="product-price-row"><strong className="product-price">{formatPrice(product.price, locale)}</strong><Badge className="stock-badge"><Check data-icon="inline-start" />En stock</Badge></div><ProductPurchasePanel addLabel={t("product.add")} whatsappLabel={t("product.whatsapp")} colorLabel={t("product.color")} sizeLabel={t("product.size")} materialLabel={t("product.material")} materialValue={product.material[locale]} availableSizes={product.availableSizes} unavailableSizes={product.unavailableSizes} customNote={t("product.customNote")} /><ul className="delivery-list"><li><i />Livraison estimée : 24–48h (Douala/Yaoundé)</li><li><i />Paiement à la livraison disponible au Cameroun</li><li><i />Retours et échanges acceptés sous 7 jours</li></ul><Accordion className="product-accordion" defaultValue={["making"]} multiple><AccordionItem value="making"><AccordionTrigger>{t("product.making")}</AccordionTrigger><AccordionContent>Chaque paire est découpée, assemblée et finie à la main dans notre atelier à Douala par les mêmes artisans.</AccordionContent></AccordionItem><AccordionItem value="care"><AccordionTrigger>{t("product.care")}</AccordionTrigger><AccordionContent>Nettoyez avec un chiffon doux et nourrissez régulièrement le cuir avec un produit adapté.</AccordionContent></AccordionItem><AccordionItem value="delivery"><AccordionTrigger>{t("product.delivery")}</AccordionTrigger><AccordionContent>Livraison nationale sous 24h à 5 jours selon la zone. Retours acceptés sous 7 jours pour un article non porté.</AccordionContent></AccordionItem></Accordion></div>
      </section>
      <ProductReviews labels={{ open: t("product.reviewsOpen"), title: t("product.reviewsTitle"), summary: t("product.reviewsSummary"), rating: t("product.reviewsRating"), date: t("product.reviewsDate"), recent: t("product.reviewsRecent"), oldest: t("product.reviewsOldest"), filters: t("product.reviewsFilters"), clear: t("product.reviewsClear"), empty: t("product.reviewsEmpty"), close: t("product.reviewsClose") }} />
      <section className="product-related section"><div className="related-heading"><div><span className="eyebrow">KEMI SHOES</span><h2>{t("product.related")}</h2></div><Link href="/boutique" className="text-link dark-link">{t("home.viewAll")} <ArrowUpRight aria-hidden="true" /></Link></div><div className="related-grid">{relatedProducts.map((item) => <Link href={`/produits/${item.slug[locale]}`} className="related-card" key={item.slug.fr}><div className="related-image"><Image src={item.image} alt={item.name[locale]} fill sizes="(max-width: 640px) 50vw, 25vw" /><span>{formatPrice(item.price, locale)}</span></div><strong>{item.name[locale]}</strong><small>{item.subtitle[locale]}</small></Link>)}</div></section>
    </main>
  );
}
