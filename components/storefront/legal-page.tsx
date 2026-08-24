import fs from "node:fs/promises";
import path from "node:path";
import { remark } from "remark";
import remarkHtml from "remark-html";
import type { Locale } from "@/lib/catalog";

const documents = {
  mentions: {
    file: "mentions-legales.md",
    title: { fr: "Mentions légales", en: "Legal notice" },
  },
  cgv: {
    file: "cgv.md",
    title: { fr: "Conditions Générales de Vente", en: "Terms and conditions" },
  },
  confidentialite: {
    file: "confidentialite.md",
    title: { fr: "Politique de confidentialité", en: "Privacy policy" },
  },
} as const;

export type LegalDocument = keyof typeof documents;

export async function LegalPage({ locale, document }: { locale: Locale; document: LegalDocument }) {
  const definition = documents[document];
  const markdown = await fs.readFile(path.join(process.cwd(), "public", "legales", definition.file), "utf8");
  const result = await remark().use(remarkHtml).process(markdown);

  return (
    <main className="legal-page">
      <header className="legal-heading">
        <span className="eyebrow">KEMI SHOES</span>
        <h1>{definition.title[locale]}</h1>
        <p>{locale === "fr" ? "Informations officielles et conditions applicables à votre utilisation du site." : "Official information and terms applicable to your use of the website."}</p>
      </header>
      <article className="legal-content prose prose-stone max-w-none" dangerouslySetInnerHTML={{ __html: result.toString() }} />
    </main>
  );
}
