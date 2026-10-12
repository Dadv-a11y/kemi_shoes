import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getI18n } from "@/locales/server";
import { productCategoryLabel, type Locale } from "@/lib/catalog";
import { getCatalogProductBySlug, getCatalogProducts } from "@/lib/catalog-api";
import { ProductDetail } from "@/components/catalog/product-detail";
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

  // Suggestions : meilleures ventes de la même catégorie, complétées par le reste du catalogue.
  const sameCategory = (await getCatalogProducts({ category: product.category, sort: "popular", pageSize: 5 })).items;
  const others = sameCategory.length < 5 ? (await getCatalogProducts({ sort: "popular", pageSize: 8 })).items : [];
  const relatedProducts = [...sameCategory, ...others]
    .filter((item, index, list) => item.slug.fr !== product.slug.fr && list.findIndex((other) => other.slug.fr === item.slug.fr) === index)
    .slice(0, 4);

  return (
    <main className="product-page">
      <ProductDetail
        product={product}
        locale={locale}
        labels={{ catalogTitle: t("catalog.title"), handmade: t("product.handmade"), add: t("product.add"), whatsapp: t("product.whatsapp"), color: t("product.color"), size: t("product.size"), material: t("product.material"), customNote: t("product.customNote"), making: t("product.making"), care: t("product.care"), delivery: t("product.delivery") }}
      />
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
              categoryLabel={productCategoryLabel(item, locale)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
