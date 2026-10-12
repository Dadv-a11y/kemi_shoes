import Link from "next/link";
import { Suspense } from "react";
import { ScrollToResults } from "@/components/catalog/scroll-to-results";
import { ShopTabLink } from "@/components/catalog/shop-tab-link";
import { CatalogFilters, type ShopFilters } from "@/components/catalog/catalog-filters";
import { ProductCard } from "@/components/catalog/product-card";
import { getI18n } from "@/locales/server";
import { productCategoryLabel, type Locale } from "@/lib/catalog";
import { getCatalogFacets, getCatalogProducts, getStoreCategories } from "@/lib/catalog-api";
import { cn } from "@/lib/utils";

/** Meilleures ventes préchargées par catégorie ; « Voir plus » en ajoute autant. */
export const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const number = (value: string | undefined) => (value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : undefined);

export function parseShopFilters(search: SearchParams): ShopFilters & { limit: number } {
  const sort = one(search.tri);
  return {
    sort: sort === "newest" || sort === "priceAsc" || sort === "priceDesc" ? sort : "popular",
    size: one(search.taille) || undefined,
    color: one(search.couleur) || undefined,
    minPrice: number(one(search.prix_min)),
    maxPrice: number(one(search.prix_max)),
    limit: Math.min(100, Math.max(PAGE_SIZE, number(one(search.limite)) ?? PAGE_SIZE)),
  };
}

/**
 * Liste de produits partagée par /boutique, /boutique/[categorie] et /collections/[slug] : onglets de
 * catégories issus de l'API, filtres connectés au backend, 20 meilleures ventes par défaut.
 */
export async function ShopListing({ locale, category, collection, search, title, intro }: { locale: Locale; category?: string; collection?: string; search: SearchParams; title: string; intro?: string }) {
  const t = await getI18n();
  const { limit, ...filters } = parseShopFilters(search);
  const basePath = collection ? `/${locale}/collections/${collection}` : `/${locale}/boutique${category ? `/${category}` : ""}`;
  const [categories, facets, { items, total }] = await Promise.all([
    getStoreCategories(),
    getCatalogFacets({ category, collection }),
    getCatalogProducts({ category, collection, ...filters, pageSize: limit }),
  ]);
  const moreParams = new URLSearchParams(Object.entries(search).flatMap(([key, value]) => (typeof value === "string" && key !== "limite" ? [[key, value]] : [])));
  moreParams.set("limite", String(limit + PAGE_SIZE));

  return (
    <main className="shop-page">
      <Suspense fallback={null}><ScrollToResults /></Suspense>
      <section className="shop-intro section">
        <span className="eyebrow">KEMI SHOES</span>
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </section>
      <nav className="shop-tabs" aria-label={t("catalog.categoriesLabel")}>
        <ShopTabLink href={`/${locale}/boutique#shop-results`} className={cn("shop-tab", !category && !collection && "shop-tab-active")}>{t("catalog.categories.tous")}</ShopTabLink>
        {categories.map((item) => (
          <ShopTabLink key={item.slug} href={`/${locale}/boutique/${item.slug}#shop-results`} className={cn("shop-tab", category === item.slug && "shop-tab-active")}>
            {locale === "en" ? item.nameEn : item.nameFr}
          </ShopTabLink>
        ))}
        <CatalogFilters
          basePath={basePath}
          facets={facets}
          current={filters}
          labels={{ trigger: t("catalog.filter"), title: t("catalog.filterTitle"), sort: t("catalog.sort"), newest: t("catalog.newest"), priceAsc: t("catalog.priceAsc"), priceDesc: t("catalog.priceDesc"), popular: t("catalog.popular"), size: t("catalog.size"), color: t("catalog.color"), price: t("catalog.price"), reset: t("catalog.reset"), results: t("catalog.results"), activeFilter: t("catalog.activeFilter") }}
        />
      </nav>
      <section id="shop-results" className="section shop-results">
        <div className="shop-toolbar"><span className="catalog-result-count">{total} {t("catalog.items")}</span></div>
        <div className="catalog-grid">
          {items.map((product) => <ProductCard key={product.id ?? product.slug.fr} product={product} locale={locale} categoryLabel={productCategoryLabel(product, locale)} />)}
          {items.length === 0 && <p className="catalog-empty">{t("catalog.noResults")}</p>}
        </div>
        {items.length < total && <div className="shop-more"><Link className="shop-more-link" scroll={false} href={`${basePath}?${moreParams}#shop-results`}>{t("catalog.loadMore")}</Link></div>}
      </section>
    </main>
  );
}
