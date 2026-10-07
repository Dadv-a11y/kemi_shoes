import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, ChevronRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { getI18n } from "@/locales/server";
import { formatPrice, type Locale } from "@/lib/catalog";
import { getCatalogProductBySlug, getCatalogProducts } from "@/lib/catalog-api";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { ProductPurchasePanel } from "@/components/catalog/product-purchase-panel";
import { ProductCard } from "@/components/catalog/product-card";
import { ProductReviews } from "@/components/catalog/product-reviews";
import { setStaticParamsLocale } from "next-international/server";

// Pas de generateStaticParams : la page lit searchParams (?review=1, lien de la
// notification d'avis), elle doit donc être rendue à la demande. Avec un
// generateStaticParams, le rendu ISR échouait en production (DYNAMIC_SERVER_USAGE → 500).

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locales: string; slug: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const { locales, slug } = await params;
  setStaticParamsLocale(locales);
  const { review } = await searchParams;
  const t = await getI18n();
  const locale: Locale = locales === "en" ? "en" : "fr";
  const product = await getCatalogProductBySlug(slug, locale);

  if (!product) notFound();
  if (!product.id) notFound();

  const relatedProducts = (await getCatalogProducts())
    .filter((item) => item.slug.fr !== product.slug.fr)
    .slice(0, 4);
  const galleryImages = product.images.length ? product.images : [product.image];

  return (
    <main className="product-page">
      <div className="product-breadcrumb">
        <Link href={`/${locale}/boutique`}>
          <ArrowLeft aria-hidden="true" /> {t("catalog.title")}
        </Link>
        <ChevronRight aria-hidden="true" />
        <span>{product.name[locale]}</span>
      </div>
      <section className="product-layout section">
        <div className="product-gallery">
          <ProductGallery images={galleryImages} name={product.name[locale]} />
          <Badge variant="secondary" className="product-handmade">
            {t("product.handmade")}
          </Badge>
        </div>
        <div className="product-details">
          <span className="eyebrow">
            {t(
              `catalog.categories.${product.displayCategory}` as "catalog.categories.tous",
            )}
          </span>
          <h1>{product.name[locale]}</h1>
          <p className="product-subtitle">{product.subtitle[locale]}</p>
          <div className="product-price-row">
            <strong className="product-price">
              {formatPrice(product.price, locale)}
            </strong>
            <Badge className="stock-badge">
              <Check data-icon="inline-start" />
              En stock
            </Badge>
          </div>
          <ProductPurchasePanel
            productId={product.id}
            slug={product.slug[locale]}
            name={product.name[locale]}
            price={product.price}
            image={product.image}
            addLabel={t("product.add")}
            whatsappLabel={t("product.whatsapp")}
            colorLabel={t("product.color")}
            sizeLabel={t("product.size")}
            materialLabel={t("product.material")}
            materialValue={product.material[locale]}
            materialCustomizable={product.materialCustomizable}
            colorOptions={product.colorOptions}
            availableSizes={product.availableSizes}
            unavailableSizes={product.unavailableSizes}
            customNote={t("product.customNote")}
          />
          <ul className="delivery-list">
            <li>
              <i />
              Livraison estimée : 24–48h (Douala/Yaoundé)
            </li>
            <li>
              <i />
              Paiement à la livraison disponible au Cameroun
            </li>
            <li>
              <i />
              Retours et échanges acceptés sous 7 jours
            </li>
          </ul>
          <Accordion
            className="product-accordion"
            defaultValue={["making"]}
            multiple
          >
            <AccordionItem value="making">
              <AccordionTrigger>{t("product.making")}</AccordionTrigger>
              <AccordionContent>
                Chaque paire est découpée, assemblée et finie à la main dans
                notre atelier à Douala par les mêmes artisans.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="care">
              <AccordionTrigger>{t("product.care")}</AccordionTrigger>
              <AccordionContent>
                Nettoyez avec un chiffon doux et nourrissez régulièrement le
                cuir avec un produit adapté.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="delivery">
              <AccordionTrigger>{t("product.delivery")}</AccordionTrigger>
              <AccordionContent>
                Livraison nationale sous 24h à 5 jours selon la zone. Retours
                acceptés sous 7 jours pour un article non porté.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
      <ProductReviews
        productId={product.id}
        openFromNotification={review === "1"}
        labels={{
          open: t("product.reviewsOpen"),
          title: t("product.reviewsTitle"),
          summary: t("product.reviewsSummary"),
          rating: t("product.reviewsRating"),
          date: t("product.reviewsDate"),
          recent: t("product.reviewsRecent"),
          oldest: t("product.reviewsOldest"),
          filters: t("product.reviewsFilters"),
          clear: t("product.reviewsClear"),
          empty: t("product.reviewsEmpty"),
          close: t("product.reviewsClose"),
        }}
      />
      <section className="product-related section">
        <div className="related-heading">
          <div>
            <span className="eyebrow">KEMI SHOES</span>
            <h2>{t("product.related")}</h2>
          </div>
          <Link
            href={`/${locale}/boutique#shop-results`}
            className="text-link dark-link"
          >
            {t("home.viewAll")} <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <div className="related-grid">
          {relatedProducts.map((item) => (
            <ProductCard
              key={item.id ?? item.slug.fr}
              product={item}
              locale={locale}
              categoryLabel={t(
                `catalog.categories.${item.displayCategory}` as "catalog.categories.tous",
              )}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
