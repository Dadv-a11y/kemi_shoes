import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
      </nav>
      <section className="section shop-results">
        <div className="shop-toolbar"><span>{visibleProducts.length} {t("catalog.items")}</span><Link href="/boutique?tri=prix" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}><SlidersHorizontal data-icon="inline-start" /> {t("catalog.filter")}</Link></div>
        <div className="catalog-grid">
          {visibleProducts.map((product) => (
            <Link href={`/produits/${product.slug[locale]}`} className="catalog-card" key={product.slug.fr}>
              <div className="catalog-image"><Image src={product.image} alt={product.name[locale]} fill sizes="(max-width: 768px) 100vw, 25vw" />{product.badge && <Badge variant="secondary" className="catalog-badge">{product.badge[locale]}</Badge>}</div>
              <div className="catalog-info"><div><h2>{product.name[locale]}</h2><span>{t(`catalog.categories.${product.category}` as "catalog.categories.tous")}</span></div><strong>{formatPrice(product.price, locale)} <ArrowUpRight aria-hidden="true" /></strong></div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
