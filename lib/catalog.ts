export type Locale = "fr" | "en";
export type ProductCategory = "femme" | "homme" | "nouveautes" | "couple-enfant";

export type LocalizedText = { fr: string; en: string };

export type Product = {
  slug: LocalizedText;
  name: LocalizedText;
  price: number;
  image: string;
  category: ProductCategory;
  badge?: LocalizedText;
};

export const products: Product[] = [
  { slug: { fr: "mule-entredoigt-tressee", en: "woven-toe-mule" }, name: { fr: "Mule entre-doigt tressée", en: "Woven toe mule" }, price: 28000, image: "/images_demo/mule_entredoigt_couvrante_en_cuir_tressé.jpg", category: "femme", badge: { fr: "Nouveau", en: "New" } },
  { slug: { fr: "mule-bride-diagonale", en: "diagonal-strap-mule" }, name: { fr: "Mule à bride diagonale", en: "Diagonal strap mule" }, price: 32000, image: "/images_demo/mule_à_bride_diagonale_et_boucle.jpg", category: "femme" },
  { slug: { fr: "sandale-spartiate-rivets", en: "studded-leather-sandal" }, name: { fr: "Sandale spartiate à rivets", en: "Studded leather sandal" }, price: 35000, image: "/images_demo/sandale_spartiate_en_cuir_à_rivets_et_bride_cheville.jpg", category: "homme" },
  { slug: { fr: "mule-a-double-boucle", en: "double-buckle-mule" }, name: { fr: "Mule à double boucle", en: "Double buckle mule" }, price: 30000, image: "/images_demo/mule_à_double_boucle_découpée.jpg", category: "homme" },
  { slug: { fr: "sandale-bague-orteil", en: "toe-ring-sandal" }, name: { fr: "Sandale à bague d’orteil", en: "Toe ring sandal" }, price: 26000, image: "/images_demo/sandales_à_bague_d_orteil.jpg", category: "nouveautes", badge: { fr: "Nouveau", en: "New" } },
  { slug: { fr: "mule-bandes-croisees", en: "crossed-strap-mule" }, name: { fr: "Mule à brides croisées", en: "Crossed strap mule" }, price: 29000, image: "/images_demo/mules_à_brides_croisées.jpg", category: "couple-enfant" },
];

export function formatPrice(price: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CM" : "en-CM").format(price) + " FCFA";
}

export function getProductsForCategory(category?: string) {
  if (!category || !["femme", "homme", "nouveautes", "couple-enfant"].includes(category)) return products;
  return products.filter((product) => product.category === category);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug.fr === slug || product.slug.en === slug);
}
