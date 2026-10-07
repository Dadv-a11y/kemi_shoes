import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getI18n } from "@/locales/server";
import { getCatalogProducts } from "@/lib/catalog-api";
import { BRAND_IMAGES } from "@/lib/brand-images";
import { type Locale } from "@/lib/catalog";
import { ProductCard } from "@/components/catalog/product-card";
import { cn } from "@/lib/utils";
import { setStaticParamsLocale } from "next-international/server";

const categories = [
  { key: "men", href: "/boutique?categorie=homme", image: "/categories_hommes.jpg" },
  { key: "women", href: "/boutique?categorie=femme", image: "/categories_femme.jpg" },
  // Visuel = photo du premier produit de la catégorie (catalogue en base).
  { key: "new", href: "/boutique?categorie=nouveautes", category: "nouveautes" },
  { key: "family", href: "/boutique?categorie=couple-enfant", category: "couple-enfant" },
] as const;

const FALLBACK_IMAGE = "/logo_kemi_shoes.jpg";

export default async function Home({ params }: { params: Promise<{ locales: string }> }) {
  const { locales } = await params;
  setStaticParamsLocale(locales);
  const t = await getI18n();
  const locale: Locale = locales === "en" ? "en" : "fr";
  // Liens toujours préfixés par la locale : sans préfixe, le proxy redirige vers /fr.
  const localized = (path: string) => `/${locale}${path}`;
  const allProducts = await getCatalogProducts();
  const featuredProducts = allProducts.slice(0, 4);
  const categoryImage = (category: (typeof categories)[number]) =>
    "image" in category ? category.image : allProducts.find((product) => product.category === category.category)?.image ?? FALLBACK_IMAGE;
  const { savoirFaire, founder } = BRAND_IMAGES;

  return (
    <main>
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="hero-mobile-bg" aria-hidden="true">{["hero_1.jpg", "hero_2.jpg", "hero_3.jpg", "hero_4.jpg"].map((image, index) => <div className="hero-bg-slide" key={image}><Image src={`/${image}`} alt={`Image hero ${index + 1}`} fill priority={index === 0} sizes="100vw" /></div>)}<div className="hero-mobile-overlay" /></div>
          <span className="eyebrow">Atelier KEMI SHOES — Douala, Cameroun</span>
          <h1>Des sandales <em>façonnées</em><br />à la main, à Douala.</h1>
          <p>{t("home.intro")}</p>
          <div className="hero-actions"><Link href={localized("/boutique")} className={cn(buttonVariants({ size: "lg", variant: "default" }))}>{t("home.collection")} <ArrowUpRight data-icon="inline-end" /></Link><Link href={localized("/notre-histoire")} className={cn(buttonVariants({ size: "lg", variant: "outline" }), "hero-secondary-button")}>{t("home.knowHow")} <ArrowUpRight data-icon="inline-end" /></Link></div>
        </div>
        <div className="hero-mosaic">
          <div className="hero-tile"><Image src="/hero_1.jpg" alt="Sandale KEMI SHOES portée avec style" fill priority sizes="(max-width: 860px) 100vw, 16vw" /><span><b>01</b> Portées avec style<small>L&apos;élégance au quotidien</small></span></div>
          <div className="hero-tile"><Image src="/hero_2.jpg" alt="Sandales KEMI SHOES en cuir avec boucles" fill sizes="(max-width: 860px) 100vw, 16vw" /><span><b>02</b> Design intemporel<small>Des modèles pensés pour durer</small></span></div>
          <div className="hero-tile"><Image src="/hero_3.jpg" alt="Savoir-faire artisanal KEMI SHOES" fill sizes="(max-width: 860px) 100vw, 16vw" /><span><b>03</b> Savoir-faire local<small>Le geste, la précision, la passion</small></span></div>
          <div className="hero-tile"><Image src="/hero_4.jpg" alt="L'esprit Douala de KEMI SHOES" fill sizes="(max-width: 860px) 100vw, 16vw" /><span><b>04</b> Esprit Douala<small>Notre ville, notre inspiration</small></span></div>
        </div>
      </section>

      <section className="section home-section"><div className="section-heading"><h2>{t("home.choosePair")}</h2><Link href={localized("/boutique")} className="text-link dark-link">{t("home.viewAll")} <ArrowUpRight aria-hidden="true" /></Link></div><div className="home-category-grid">{categories.map((category) => <Link href={localized(category.href)} className="home-category-card" key={category.key}><Image src={categoryImage(category)} alt={t(`home.categories.${category.key}` as "home.categories.men")} fill sizes="(max-width: 700px) 100vw, 25vw" /><span>{t(`home.categories.${category.key}` as "home.categories.men")}</span></Link>)}</div></section>

      <section className="savoir-section"><div className="savoir-inner"><div className="savoir-media"><Image src={savoirFaire.src} alt={savoirFaire.altFr} fill sizes="(max-width: 860px) 100vw, 50vw" /><span className="play-indicator"><Play aria-hidden="true" /></span><span className="stitched-tag">Depuis l&apos;atelier</span></div><div className="savoir-copy"><span className="eyebrow">{t("home.atelier")}</span><h2>{t("home.atelierTitle")}</h2><p>{t("home.atelierText")}</p><Link href={localized("/notre-histoire")} className={cn(buttonVariants({ variant: "outline" }), "light-button")}>{t("home.discoverWorkshop")} <ArrowUpRight data-icon="inline-end" /></Link></div></div></section>

      <section className="section home-section"><div className="section-heading"><h2>{t("home.favorites")}</h2><Link href={`/${locale}/boutique#shop-results`} className="text-link dark-link">{t("home.viewAll")} <ArrowUpRight aria-hidden="true" /></Link></div><div className="favorites-grid">{featuredProducts.map((product) => <ProductCard key={product.id ?? product.slug.fr} product={product} locale={locale} categoryLabel={t(`catalog.categories.${product.category}` as "catalog.categories.tous")} />)}{featuredProducts.length === 0 && <p className="catalog-empty">Aucun produit disponible pour le moment.</p>}</div></section>

      <section className="about-section section"><div className="about-media"><Image src={founder.src} alt={founder.altFr} fill sizes="(max-width: 860px) 100vw, 50vw" /></div><div className="about-copy"><span className="eyebrow">KEMI SHOES</span><h2>{t("home.aboutTitle")}</h2><p>{t("home.aboutText")}</p><Link href={localized("/notre-histoire")} className={cn(buttonVariants(), "about-button")}>{t("home.fullStory")} <ArrowUpRight data-icon="inline-end" /></Link></div></section>

      <section className="find-pair-section"><div className="find-pair-inner"><div className="find-pair-heading"><div><span className="eyebrow">KEMI / COLLECTION</span><h2>{t("home.findPairTitle")}</h2></div><p>{t("home.findPairText")}</p></div><div className="find-pair-grid">{categories.map((category, index) => <Link href={localized(category.href)} className={`find-pair-link find-pair-link-${index + 1}`} key={category.key}><span>{t(`home.categories.${category.key}` as "home.categories.men")}</span><ArrowUpRight aria-hidden="true" /></Link>)}</div><Link href={localized("/boutique")} className={cn(buttonVariants({ size: "lg" }), "find-pair-cta")}>{t("home.exploreCollection")} <ArrowUpRight data-icon="inline-end" /></Link></div></section>
    </main>
  );
}
