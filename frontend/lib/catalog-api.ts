import { BASE_MATERIAL, type Locale, type Product } from "@/lib/catalog";
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
  categoryName?: { fr: string; en: string };
  isNew?: boolean;
  price: number;
  status: string;
  materialCustomizable?: boolean | number;
  images?: Array<{ url: string; isMain?: boolean }>;
  colors?: Array<{ name: string; hex: string }>;
  sizes?: Array<{ size: string; available: boolean | number }>;
};

type CatalogListResponse = {
  items: CatalogApiProduct[];
};

const apiUrl = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:4000/api/v1";

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
    category: product.category,
    categoryName: product.categoryName ?? { fr: product.category, en: product.category },
    isNew: Boolean(product.isNew),
    colors: (product.colors ?? []).map((color) => color.hex),
    colorOptions: product.colors ?? [],
    material: { fr: BASE_MATERIAL.fr, en: BASE_MATERIAL.en },
    materialCustomizable: Boolean(product.materialCustomizable),
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

export type StoreCategory = { id: string; slug: string; nameFr: string; nameEn: string; count: number; virtual: boolean };
export type StoreCollection = { id: string; slug: string; nameFr: string; nameEn: string; descriptionFr?: string | null; descriptionEn?: string | null; count: number; bestProduct: Product | null };
export type CatalogFacets = { sizes: string[]; colors: { name: string; hex: string }[]; minPrice: number | null; maxPrice: number | null };
export type CatalogQuery = { category?: string; collection?: string; sort?: "popular" | "newest" | "priceAsc" | "priceDesc"; size?: string; color?: string; minPrice?: number; maxPrice?: number; pageSize?: number };

/** Paramètres d'URL de l'API à partir d'un filtre (valeurs absentes ignorées). */
function toQuery(query: CatalogQuery) {
  const params = new URLSearchParams({ status: "active", pageSize: String(query.pageSize ?? 100) });
  for (const [key, value] of Object.entries({ category: query.category, collection: query.collection, sort: query.sort, size: query.size, color: query.color, minPrice: query.minPrice, maxPrice: query.maxPrice })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params;
}

/** Catégories visibles en boutique (avec « Nouveautés » seulement si elle contient des produits). */
export async function getStoreCategories(): Promise<StoreCategory[]> {
  return (await request<{ items: StoreCategory[] }>("/categories"))?.items ?? [];
}

export async function getStoreCollections(): Promise<{ items: StoreCollection[]; showcase: boolean }> {
  const result = await request<{ items: (Omit<StoreCollection, "bestProduct"> & { bestProduct: CatalogApiProduct | null })[]; showcase: boolean }>("/collections");
  return { showcase: Boolean(result?.showcase), items: (result?.items ?? []).map((item) => ({ ...item, bestProduct: item.bestProduct ? mapProduct(item.bestProduct) : null })) };
}

export async function getCatalogFacets(scope: { category?: string; collection?: string } = {}): Promise<CatalogFacets> {
  const params = new URLSearchParams();
  if (scope.category) params.set("category", scope.category);
  if (scope.collection) params.set("collection", scope.collection);
  return (await request<CatalogFacets>(`/products/facets?${params}`)) ?? { sizes: [], colors: [], minPrice: null, maxPrice: null };
}

/** Produits du catalogue public, filtrés et triés par l'API (le tri « popular » = meilleures ventes). */
export async function getCatalogProducts(query: CatalogQuery = {}): Promise<{ items: Product[]; total: number }> {
  const result = await request<CatalogListResponse & { total?: number }>(`/products?${toQuery(query)}`);
  return { items: result?.items.map(mapProduct) ?? [], total: result?.total ?? result?.items.length ?? 0 };
}

/** Top des ventes (tendances du moment). */
export async function getTopProducts(limit = 10): Promise<Product[]> {
  const result = await request<CatalogListResponse>(`/products/top?limit=${limit}`);
  return result?.items.map(mapProduct) ?? [];
}

export async function getCatalogProductBySlug(slug: string, locale: Locale): Promise<Product | undefined> {
  const result = await request<CatalogApiProduct>(`/products/slug/${encodeURIComponent(slug)}?locale=${locale}`);
  if (result && result.status !== "draft") return mapProduct(result);

  return undefined;
}
