import { NextResponse, type NextRequest } from "next/server";

import { createI18nMiddleware } from "next-international/middleware";

const I18nMiddleware = createI18nMiddleware({
  locales: ["fr", "en"],
  defaultLocale: "fr",
});

const apiUrl = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:4000/api/v1";

// Les pages dynamiques sont rendues dans un <Suspense> (chargement des traductions) : le statut HTTP part avant
// que la page ne sache si la catégorie, la collection ou le produit existe, et notFound() ne peut plus produire
// un 404. L'existence est donc contrôlée ici, avant le rendu. Résultats gardés 30 s en mémoire.
const TTL_MS = 30_000;
const cache = new Map<string, { exists: boolean; at: number }>();

async function lookup(key: string, check: () => Promise<boolean | null>) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.exists;
  // null : l'API n'a pas répondu clairement — on laisse la page décider plutôt que de renvoyer un faux 404.
  const exists = await check().catch(() => null);
  if (exists === null) return true;
  if (cache.size > 500) cache.clear();
  cache.set(key, { exists, at: Date.now() });
  return exists;
}

async function listContains(path: string, slug: string) {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) return null;
  const { items } = (await response.json()) as { items: { slug: string }[] };
  return items.some((item) => item.slug === slug);
}

async function productExists(slug: string, locale: string) {
  const response = await fetch(`${apiUrl}/products/slug/${encodeURIComponent(slug)}?locale=${locale}`);
  if (response.status === 404) return false;
  if (!response.ok) return null;
  return (await response.json() as { status?: string }).status !== "draft";
}

// Plus de redirection forcée vers la vérification OTP : un bandeau non bloquant
// (components/storefront/otp-pending-banner.tsx) propose de reprendre la saisie.
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Anciens liens /boutique?categorie=homme → vraie redirection vers /boutique/homme.
  const legacy = pathname.match(/^\/(fr|en)\/boutique\/?$/);
  const category = searchParams.get("categorie");
  if (legacy && category && category !== "tous") {
    return NextResponse.redirect(new URL(`/${legacy[1]}/boutique/${encodeURIComponent(category)}`, request.url), 308);
  }

  const match = pathname.match(/^\/(fr|en)\/(boutique|collections|produits)\/([^/]+)\/?$/);
  if (match) {
    const [, locale, section, rawSlug] = match;
    const slug = decodeURIComponent(rawSlug);
    const exists = await lookup(`${section}:${locale}:${slug}`, () =>
      section === "boutique" ? listContains("/categories", slug)
        : section === "collections" ? listContains("/collections", slug)
          : productExists(slug, locale));
    // Réécriture vers une URL sans route : réponse 404 standard (app/global-not-found.tsx).
    if (!exists) return NextResponse.rewrite(new URL(`/${locale}/introuvable`, request.url));
  }

  return I18nMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|static|.*\\..*|_next|favicon.ico|robots.txt).*)"],
};
