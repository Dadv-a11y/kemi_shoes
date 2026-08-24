import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getI18n } from "@/locales/server";
import { cn } from "@/lib/utils";

const methodSteps = [
  { number: "01", image: "/methodologie/ATELIER_01_DESIGN.jpg", title: "design", text: "designText" },
  { number: "02", image: "/methodologie/ATELIER_02_DECOUPE.jpg", title: "cut", text: "cutText" },
  { number: "03", image: "/methodologie/ATELIER_03_MATIERES.jpg", title: "prepare", text: "prepareText" },
  { number: "04", image: "/methodologie/ATELIER_04_ASSEMBLAGE.jpg", title: "assemble", text: "assembleText" },
  { number: "05", image: "/methodologie/ATELIER_05_SECHAGE.jpg", title: "dry", text: "dryText" },
  { number: "06", image: "/methodologie/ATELIER_06_FINITION.jpg", title: "finish", text: "finishText" },
  { number: "07", image: "/methodologie/ATELIER_07_CONTROLE.jpg", title: "control", text: "controlText" },
] as const;

export default async function OurStoryPage({ params }: { params: Promise<{ locales: string }> }) {
  const { locales } = await params;
  const locale = locales === "en" ? "en" : "fr";
  const t = await getI18n();
  const story = (key: string) => t(`storyPage.${key}` as never);

  return <main className="story-page">
    <section className="story-hero"><div className="story-hero-image"><Image src="/images_demo/atelier_3.jpg" alt={story("heroAlt")} fill priority sizes="(max-width: 760px) 100vw, 52vw" /></div><div className="story-hero-copy"><span className="eyebrow">{story("eyebrow")}</span><h1>{story("heroTitle")}</h1><p>{story("heroText")}</p><span className="stitched-tag">{story("location")}</span></div></section>

    <section className="story-intro section"><div className="story-intro-heading"><span className="section-kicker">01 / 04</span><h2>{story("introTitle")}</h2></div><div className="story-intro-copy"><p>{story("introText")}</p><div className="story-values"><div><strong>01</strong><span>{story("valueOne")}</span></div><div><strong>02</strong><span>{story("valueTwo")}</span></div><div><strong>03</strong><span>{story("valueThree")}</span></div></div></div></section>

    <section className="founder-section"><div className="founder-copy"><span className="eyebrow">02 / {story("founderEyebrow")}</span><h2>{story("founderTitle")}</h2><p>{story("founderText")}</p><p>{story("founderTextTwo")}</p><blockquote>{story("founderQuote")}</blockquote></div><div className="founder-image"><Image src="/images_demo/fondatrice_kemi_shoes.jpg" alt={story("founderAlt")} fill sizes="(max-width: 760px) 100vw, 50vw" /></div></section>

    <section className="method-section section"><div className="method-heading"><div><span className="section-kicker">03 / 04</span><h2>{story("methodTitle")}</h2></div><p>{story("methodIntro")}</p></div><div className="method-grid">{methodSteps.map((step) => <article className="method-card" key={step.number}><div className="method-image"><Image src={step.image} alt={`${story("stepAlt")} ${step.number}`} fill sizes="(max-width: 700px) 100vw, 33vw" /></div><div className="method-card-copy"><span>{step.number}</span><h3>{story(step.title)}</h3><p>{story(step.text)}</p></div></article>)}</div><div className="method-signature"><span>{story("signature")}</span><p>{story("signatureText")}</p></div></section>

    <section className="story-cta"><div><span className="eyebrow">04 / 04</span><h2>{story("ctaTitle")}</h2><p>{story("ctaText")}</p><Link href={`/${locale}/boutique`} className={cn(buttonVariants({ size: "lg" }), "story-cta-button")}>{story("ctaButton")} <ArrowUpRight data-icon="inline-end" /></Link></div><div className="story-cta-image"><Image src="/images_demo/mule_à_bride_diagonale_et_boucle.jpg" alt={story("ctaAlt")} fill sizes="(max-width: 760px) 100vw, 42vw" /></div></section>
  </main>;
}