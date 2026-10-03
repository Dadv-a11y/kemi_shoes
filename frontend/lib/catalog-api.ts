import { type Locale, type Product, type ProductCategory } from "@/lib/catalog";
import { resolveMediaUrl } from "@/lib/backend-api";

export type CatalogApiProduct = {
  id: string;
  slugFr: string;
  slugEn: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  category: string;
  price: number;
  status: string;
  images?: Array<{ url: string; isMain?: boolean }>;
  colors?: Array<{ name: string; hex: string }>;
  sizes?: Array<{ size: string; available: boolean | number }>;
};

type CatalogListResponse = {
  items: CatalogApiProduct[];
};

const apiUrl = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:4000/api/v1";

function mapCategory(category: string): ProductCategory {
  const normalized = category.toLowerCase().replace("é", "e");
  if (normalized === "femme" || normalized === "homme" || normalized === "couple-enfant") return normalized;
  return "nouveautes";
}

export function mapProduct(product: CatalogApiProduct): Product {
  const images = product.images ?? [];
  const ordered = [...images].sort((a, b) => Number(Boolean(b.isMain)) - Number(Boolean(a.isMain))).map((item) => resolveMediaUrl(item.url));
  const image = ordered[0] ?? "/logo_kemi_shoes.jpg";
  const sizes = product.sizes ?? [];
  return {
    id: product.id,
    slug: { fr: product.slugFr, en: product.slugEn },
    name: { fr: product.nameFr, en: product.nameEn },
    price: product.price,
    image,
    images: ordered.length ? ordered : [image],
    category: mapCategory(product.category),
    colors: (product.colors ?? []).map((color) => color.hex),
    material: { fr: "Cuir", en: "Leather" },
    subtitle: { fr: product.descriptionFr, en: product.descriptionEn },
    availableSizes: sizes.filter((size) => Boolean(size.available)).map((size) => size.size),
    unavailableSizes: sizes.filter((size) => !Boolean(size.available)).map((size) => size.size),
  };
}

async function request<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiUrl}${path}`, { next: { revalidate: 60 } });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getCatalogProducts(category?: ProductCategory): Promise<Product[]> {
  const backendCategory = category ? {
    homme: "Homme",
    femme: "Femme",
    nouveautes: "Nouveautes",
    "couple-enfant": "Couple-Enfant",
  }[category] : undefined;
  // Le catalogue public n'affiche que les produits publiés (pas les brouillons).
  const query = `?status=active&pageSize=100${backendCategory ? `&category=${encodeURIComponent(backendCategory)}` : ""}`;
  const result = await request<CatalogListResponse>(`/products${query}`);
  return result?.items.map(mapProduct) ?? [];
}

export async function getCatalogProductBySlug(slug: string, locale: Locale): Promise<Product | undefined> {
  const result = await request<CatalogApiProduct>(`/products/slug/${encodeURIComponent(slug)}?locale=${locale}`);
  if (result && result.status !== "draft") return mapProduct(result);

  return undefined;
}

export type BrandMedia = { key: string; url: string; altFr: string | null; altEn: string | null };

/** Visuels de marque (atelier, fondatrice) indexés par clé — voir backend/scripts/seed-demo.data.js. */
export async function getBrandMedia(): Promise<Record<string, BrandMedia>> {
  const result = await request<BrandMedia[]>("/media?category=brand");
  return Object.fromEntries((result ?? []).map((media) => [media.key, { ...media, url: resolveMediaUrl(media.url) }]));
}
