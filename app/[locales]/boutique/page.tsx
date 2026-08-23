import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { getI18n } from "@/locales/server";
import { formatPrice, getProductsForCategory, type Locale } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const categories = ["tous", "homme", "femme", "nouveautes", "couple-enfant"] as const;

export default async function ShopPage({ params, searchParams }: { params: Promise<{ locales: string }>; searchParams: Promise<{ categorie?: string }> }) {
  const t = await getI18n();
  const { locales } = await params;
  const { categorie } = await searchParams;
  const category = categorie && categorie !== "tous" ? categorie : undefined;
  const visibleProducts = getProductsForCategory(category);
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
          <Link key={item} href={item === "tous" ? "/boutique" : `/boutique?categorie=${item}`} className={cn("shop-tab", (category ?? "tous") === item && "shop-tab-active")}>
            {t(`catalog.categories.${item}` as "catalog.categories.tous")}
          </Link>
        ))}
        <CatalogFilters labels={{ trigger: t("catalog.filter"), title: t("catalog.filterTitle"), sort: t("catalog.sort"), newest: t("catalog.newest"), priceAsc: t("catalog.priceAsc"), priceDesc: t("catalog.priceDesc"), popular: t("catalog.popular"), gender: t("catalog.gender"), men: t("catalog.categories.homme"), women: t("catalog.categories.femme"), child: t("catalog.child"), size: t("catalog.size"), color: t("catalog.color"), price: t("catalog.price"), reset: t("catalog.reset"), results: t("catalog.results"), activeFilter: t("catalog.activeFilter") }} />
      </nav>
      <section className="section shop-results">
        <div className="shop-toolbar"><span className="catalog-result-count">{visibleProducts.length} {t("catalog.items")}</span></div>
        <div className="catalog-grid">
          {visibleProducts.map((product) => (
            <Link href={`/produits/${product.slug[locale]}`} className="catalog-card" key={product.slug.fr}>
              <div className="catalog-image"><Image src={product.image} alt={product.name[locale]} fill sizes="(max-width: 768px) 100vw, 25vw" />{product.badge && <Badge variant="secondary" className="catalog-badge">{product.badge[locale]}</Badge>}<span className="catalog-price">{formatPrice(product.price, locale)}</span></div>
              <div className="catalog-info"><div><h2>{product.name[locale]}</h2><span>{t(`catalog.categories.${product.category}` as "catalog.categories.tous")}</span></div><ArrowUpRight className="catalog-arrow" aria-hidden="true" /></div><div className="catalog-swatches" aria-label={t("catalog.availableColors")}>{product.colors.map((color) => <span key={color} title={color} style={{ backgroundColor: color }} />)}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
