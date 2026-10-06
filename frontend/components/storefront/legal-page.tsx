import fs from "node:fs/promises";
import path from "node:path";
import { remark } from "remark";
import remarkHtml from "remark-html";
import type { Locale } from "@/lib/catalog";

const documents = {
  mentions: {
    file: "mentions-legales.md",
    slug: "mentions-legales",
    title: { fr: "Mentions légales", en: "Legal notice" },
  },
  cgv: {
    file: "cgv.md",
    slug: "cgv",
    title: { fr: "Conditions Générales de Vente", en: "Terms and conditions" },
  },
  confidentialite: {
    file: "confidentialite.md",
    slug: "confidentialite",
    title: { fr: "Politique de confidentialité", en: "Privacy policy" },
  },
} as const;

export type LegalDocument = keyof typeof documents;

type ContentPage = { titleFr: string; titleEn?: string | null; bodyFr: string; bodyEn?: string | null };

const apiUrl = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:4000/api/v1";

// Contenu éditable depuis l'admin (« Contenu & traductions ») ; le fichier
// Markdown de public/legales sert de repli si la page n'existe pas en base.
async function fetchContentPage(slug: string): Promise<ContentPage | null> {
  try {
    const response = await fetch(`${apiUrl}/content/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    return response.ok ? ((await response.json()) as ContentPage) : null;
  } catch {
    return null;
  }
}

export async function LegalPage({ locale, document }: { locale: Locale; document: LegalDocument }) {
  const definition = documents[document];
  const page = await fetchContentPage(definition.slug);
  const body = page ? (locale === "en" && page.bodyEn ? page.bodyEn : page.bodyFr) : null;
  const title = page ? (locale === "en" && page.titleEn ? page.titleEn : page.titleFr) : definition.title[locale];
  const markdown = body ?? (await fs.readFile(path.join(process.cwd(), "public", "legales", definition.file), "utf8"));
  const result = await remark().use(remarkHtml).process(markdown);
  // Liens internes du Markdown (ex. "/cgv") : préfixés par la locale courante,
  // sinon le proxy redirige vers la locale par défaut.
  const html = result.toString().replace(/href="\/(?!fr\/|en\/|fr"|en")/g, `href="/${locale}/`);

  return (
    <main className="legal-page">
      <header className="legal-heading">
        <span className="eyebrow">KEMI SHOES</span>
        <h1>{title}</h1>
        <p>{locale === "fr" ? "Informations officielles et conditions applicables à votre utilisation du site." : "Official information and terms applicable to your use of the website."}</p>
      </header>
      <article className="legal-content prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
