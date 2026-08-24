import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getI18n } from "@/locales/server";
import { cn } from "@/lib/utils";

const categories = [
  { key: "men", href: "/boutique?categorie=homme", image: "/categories_hommes.jpg" },
  { key: "women", href: "/boutique?categorie=femme", image: "/categories_femme.jpg" },
  { key: "new", href: "/boutique?categorie=nouveautes", image: "/images_demo/mule_à_bride_diagonale_et_boucle.jpg" },
  { key: "family", href: "/boutique?categorie=couple-enfant", image: "/images_demo/mules_à_brides_croisées.jpg" },
] as const;

const favorites = [
  { name: "BILAMA.", sub: "Sandale homme, cuir tressé", price: "10 000 FCFA", image: "/images_demo/mule_à_large_bande_avec_liseré_bleu_et_écusson_métallique.jpg" },
  { name: "JANI.", sub: "Élégante et légère", price: "8 000 FCFA", image: "/images_demo/sandales_à_bague_d_orteil.jpg" },
  { name: "GABI.", sub: "Design with cork", price: "12 000 FCFA", image: "/images_demo/mule_plateforme_à_nœud_et_fines_brides.jpg" },
  { name: "Spartiate", sub: "Sandale en cuir pour lui", price: "18 000 FCFA", image: "/images_demo/sandale_spartiate_en_cuir_à_rivets_et_bride_cheville.jpg" },
];

const reviews = [
  "Cuir superbe, confort au top, livraison rapide sur Douala.",
  "La qualité justifie largement le prix. Je recommande à tous mes proches.",
  "Ma troisième paire chez eux, toujours aussi solide.",
  "Les finitions sont bluffantes pour ce prix-là.",
  "Commandé pour un mariage, tout le monde m'a demandé la marque.",
];

export default async function Home() {
  const t = await getI18n();

  return (
    <main>
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="hero-mobile-bg" aria-hidden="true">{["hero_1.jpg", "hero_2.jpg", "hero_3.jpg", "hero_4.jpg"].map((image, index) => <div className="hero-bg-slide" key={image}><Image src={`/${image}`} alt={`Image hero ${index + 1}`} fill priority={index === 0} sizes="100vw" /></div>)}<div className="hero-mobile-overlay" /></div>
          <span className="eyebrow">Atelier KEMI SHOES — Douala, Cameroun</span>
          <h1>Des sandales <em>façonnées</em><br />à la main, à Douala.</h1>
          <p>{t("home.intro")}</p>
          <div className="hero-actions"><Link href="/boutique" className={cn(buttonVariants({ size: "lg", variant: "default" }))}>{t("home.collection")} <ArrowUpRight data-icon="inline-end" /></Link><Link href="/notre-histoire" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "hero-secondary-button")}>{t("home.knowHow")} <ArrowUpRight data-icon="inline-end" /></Link></div>
        </div>
        <div className="hero-mosaic">
          <div className="hero-tile"><Image src="/hero_1.jpg" alt="Sandale KEMI SHOES portée avec style" fill priority sizes="(max-width: 860px) 100vw, 16vw" /><span><b>01</b> Portées avec style<small>L&apos;élégance au quotidien</small></span></div>
          <div className="hero-tile"><Image src="/hero_2.jpg" alt="Sandales KEMI SHOES en cuir avec boucles" fill sizes="(max-width: 860px) 100vw, 16vw" /><span><b>02</b> Design intemporel<small>Des modèles pensés pour durer</small></span></div>
          <div className="hero-tile"><Image src="/hero_3.jpg" alt="Savoir-faire artisanal KEMI SHOES" fill sizes="(max-width: 860px) 100vw, 16vw" /><span><b>03</b> Savoir-faire local<small>Le geste, la précision, la passion</small></span></div>
          <div className="hero-tile"><Image src="/hero_4.jpg" alt="L'esprit Douala de KEMI SHOES" fill sizes="(max-width: 860px) 100vw, 16vw" /><span><b>04</b> Esprit Douala<small>Notre ville, notre inspiration</small></span></div>
        </div>
      </section>

      <section className="section home-section"><div className="section-heading"><h2>{t("home.choosePair")}</h2><Link href="/boutique" className="text-link dark-link">{t("home.viewAll")} <ArrowUpRight aria-hidden="true" /></Link></div><div className="home-category-grid">{categories.map((category) => <Link href={category.href} className="home-category-card" key={category.key}><Image src={category.image} alt={t(`home.categories.${category.key}` as "home.categories.men")} fill sizes="(max-width: 700px) 100vw, 25vw" /><span>{t(`home.categories.${category.key}` as "home.categories.men")}</span></Link>)}</div></section>

      <section className="savoir-section"><div className="savoir-inner"><div className="savoir-media"><Image src="/images_demo/atelier_3.jpg" alt="Travail artisanal du cuir dans l&apos;atelier KEMI SHOES" fill sizes="(max-width: 860px) 100vw, 50vw" /><span className="play-indicator"><Play aria-hidden="true" /></span><span className="stitched-tag">Depuis l&apos;atelier</span></div><div className="savoir-copy"><span className="eyebrow">{t("home.atelier")}</span><h2>{t("home.atelierTitle")}</h2><p>{t("home.atelierText")}</p><Link href="/notre-histoire" className={cn(buttonVariants({ variant: "outline" }), "light-button")}>{t("home.discoverWorkshop")} <ArrowUpRight data-icon="inline-end" /></Link></div></div></section>

      <section className="section home-section"><div className="section-heading"><h2>{t("home.favorites")}</h2><Link href="/boutique" className="text-link dark-link">{t("home.viewAll")} <ArrowUpRight aria-hidden="true" /></Link></div><div className="favorites-grid">{favorites.map((product) => <Link href="/boutique" className="favorite-card" key={product.name}><div className="favorite-media"><Image src={product.image} alt={product.name} fill sizes="(max-width: 560px) 100vw, 25vw" /><span>{product.price}</span></div><strong>{product.name}</strong><small>{product.sub}</small></Link>)}</div></section>

      <section className="proof-section"><div className="proof-heading"><div><span className="eyebrow">{t("home.reviewsEyebrow")}</span><h2>{t("home.reviewsTitle")}</h2></div><div className="proof-stat"><strong>78K</strong><span>{t("home.followers")}</span></div></div><div className="reviews-track">{[...reviews, ...reviews].map((review, index) => <article className="review-card" key={`${review}-${index}`}><div className="stars">★★★★★</div><p>« {review} »</p><small>{t("home.verified")}</small></article>)}</div></section>

      <section className="about-section section"><div className="about-media"><Image src="/images_demo/fondatrice_kemi_shoes.jpg" alt="Marthe Nyobe, fondatrice de KEMI SHOES" fill sizes="(max-width: 860px) 100vw, 50vw" /></div><div className="about-copy"><span className="eyebrow">KEMI SHOES</span><h2>{t("home.aboutTitle")}</h2><p>{t("home.aboutText")}</p><Link href="/notre-histoire" className={cn(buttonVariants(), "about-button")}>{t("home.fullStory")} <ArrowUpRight data-icon="inline-end" /></Link></div></section>

      <section className="find-pair-section"><div className="find-pair-inner"><div className="find-pair-heading"><div><span className="eyebrow">KEMI / COLLECTION</span><h2>{t("home.findPairTitle")}</h2></div><p>{t("home.findPairText")}</p></div><div className="find-pair-grid">{categories.map((category, index) => <Link href={category.href} className={`find-pair-link find-pair-link-${index + 1}`} key={category.key}><span>{t(`home.categories.${category.key}` as "home.categories.men")}</span><ArrowUpRight aria-hidden="true" /></Link>)}</div><Link href="/boutique" className={cn(buttonVariants({ size: "lg" }), "find-pair-cta")}>{t("home.exploreCollection")} <ArrowUpRight data-icon="inline-end" /></Link></div></section>
    </main>
  );
}
