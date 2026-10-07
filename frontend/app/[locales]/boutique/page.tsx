import Link from "next/link";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ProductCard } from "@/components/catalog/product-card";
import { getI18n } from "@/locales/server";
import { type Locale, type ProductCategory } from "@/lib/catalog";
import { getCatalogProducts } from "@/lib/catalog-api";
import { cn } from "@/lib/utils";
import { setStaticParamsLocale } from "next-international/server";

const categories = ["tous", "homme", "femme", "nouveautes", "couple-enfant"] as const;

export default async function ShopPage({ params, searchParams }: { params: Promise<{ locales: string }>; searchParams: Promise<{ categorie?: string }> }) {
  const { locales } = await params;
  setStaticParamsLocale(locales);
  const t = await getI18n();
  const { categorie } = await searchParams;
  const category = categorie && categorie !== "tous" ? categorie : undefined;
  const validCategory = category && ["femme", "homme", "nouveautes", "couple-enfant"].includes(category) ? category as ProductCategory : undefined;
  const visibleProducts = await getCatalogProducts(validCategory);
  const locale: Locale = locales === "en" ? "en" : "fr";

  return (
    <main className="shop-page">
      <section className="shop-intro section">
        <span className="eyebrow">KEMI SHOES</span>
        <h1>{t("catalog.title")}</h1>
        <p>{t("catalog.intro")}</p>
      </section>
      <nav className="shop-tabs" aria-label={t("catalog.categoriesLabel")}>
        {categories.map((item) => (
          <Link key={item} href={`/${locale}/boutique${item === "tous" ? "" : `?categorie=${item}`}#shop-results`} className={cn("shop-tab", (category ?? "tous") === item && "shop-tab-active")}>
            {t(`catalog.categories.${item}` as "catalog.categories.tous")}
          </Link>
        ))}
        <CatalogFilters labels={{ trigger: t("catalog.filter"), title: t("catalog.filterTitle"), sort: t("catalog.sort"), newest: t("catalog.newest"), priceAsc: t("catalog.priceAsc"), priceDesc: t("catalog.priceDesc"), popular: t("catalog.popular"), gender: t("catalog.gender"), men: t("catalog.categories.homme"), women: t("catalog.categories.femme"), child: t("catalog.child"), size: t("catalog.size"), color: t("catalog.color"), price: t("catalog.price"), reset: t("catalog.reset"), results: t("catalog.results"), activeFilter: t("catalog.activeFilter") }} />
      </nav>
      <section id="shop-results" className="section shop-results">
        <div className="shop-toolbar"><span className="catalog-result-count">{visibleProducts.length} {t("catalog.items")}</span></div>
        <div className="catalog-grid">
          {visibleProducts.map((product) => <ProductCard key={product.id ?? product.slug.fr} product={product} locale={locale} categoryLabel={t(`catalog.categories.${product.displayCategory}` as "catalog.categories.tous")} />)}
          {visibleProducts.length === 0 && <p className="catalog-empty">Aucun produit disponible dans cette catégorie.</p>}
        </div>
      </section>
    </main>
  );
}
