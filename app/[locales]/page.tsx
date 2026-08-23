import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getI18n } from "@/locales/server";

const products = [
  { name: "Mule entre-doigt tressée", price: "28 000 FCFA", image: "/images_demo/mule_entredoigt_couvrante_en_cuir_tressé.jpg" },
  { name: "Mule à bride diagonale", price: "32 000 FCFA", image: "/images_demo/mule_à_bride_diagonale_et_boucle.jpg" },
  { name: "Sandale spartiate rivets", price: "35 000 FCFA", image: "/images_demo/sandale_spartiate_en_cuir_à_rivets_et_bride_cheville.jpg" },
];

export default async function Home() {
  const t = await getI18n();

  return (
    <main>
      <section className="hero-grid">
        <div className="hero-copy"><span className="eyebrow">{t("home.eyebrow")}</span><h1>{t("home.titleFirst")}<br /><em>{t("home.titleSecond")}</em></h1><p>{t("home.intro")}</p><div className="hero-actions"><Link href="/boutique" className={cn(buttonVariants({ size: "lg" }))}>{t("home.collection")} <ArrowUpRight data-icon="inline-end" /></Link><Link href="/notre-histoire" className="text-link">{t("home.knowHow")} <ArrowUpRight aria-hidden="true" /></Link></div><span className="stitched-tag">{t("home.handmade")}</span></div>
        <div className="hero-atelier"><Image src="/images_demo/atelier.jpg" alt="Artisan KEMI SHOES dans l'atelier de Douala" fill priority sizes="(max-width: 768px) 100vw, 54vw" /><span className="image-caption">{t("home.workshop")}</span></div>
        <Link href="/boutique/femme" className="hero-category category-women"><Image src="/images_demo/categories_femme.jpg" alt="Collection de sandales femme KEMI SHOES" fill sizes="(max-width: 768px) 100vw, 56vw" /><span>{t("home.women")} <ArrowUpRight aria-hidden="true" /></span></Link>
        <Link href="/boutique/homme" className="hero-category category-men"><Image src="/images_demo/categories_hommes.jpg" alt="Collection de sandales homme KEMI SHOES" fill sizes="(max-width: 768px) 100vw, 44vw" /><span>{t("home.men")} <ArrowUpRight aria-hidden="true" /></span></Link>
      </section>

      <section className="section featured-section"><div className="section-heading"><div><span className="eyebrow">{t("home.selection")}</span><h2>{t("home.essentials")}<br /><em>{t("home.madeWell")}</em></h2></div><Link href="/boutique" className="text-link dark-link">{t("home.allShop")} <ArrowUpRight aria-hidden="true" /></Link></div><div className="product-grid">{products.map((product) => <Link href="/boutique" className="product-card" key={product.name}><div className="product-image"><Image src={product.image} alt={product.name} fill sizes="(max-width: 768px) 88vw, 33vw" /></div><div className="product-info"><span>{product.name}</span><strong>{product.price}</strong></div></Link>)}</div></section>

      <section className="craft-section"><div className="craft-image"><Image src="/images_demo/fondatrice_kemi_shoes.jpg" alt="Fondatrice de KEMI SHOES dans son atelier" fill sizes="(max-width: 768px) 100vw, 50vw" /></div><div className="craft-copy"><span className="eyebrow">{t("home.story")}</span><h2>{t("home.storyTitle")}</h2><p>{t("home.storyText")}</p><Link href="/notre-histoire" className={cn(buttonVariants({ variant: "outline" }))}>{t("home.learnMore")} <ArrowUpRight data-icon="inline-end" /></Link></div></section>
    </main>
  );
}
