export type Locale = "fr" | "en";
export type ProductCategory = "femme" | "homme" | "nouveautes" | "couple-enfant";

export type LocalizedText = { fr: string; en: string };

export type Product = {
  slug: LocalizedText;
  name: LocalizedText;
  price: number;
  image: string;
  category: ProductCategory;
  colors: string[];
  material: LocalizedText;
  subtitle: LocalizedText;
  availableSizes: string[];
  unavailableSizes: string[];
  badge?: LocalizedText;
};

export const products: Product[] = [
  { slug: { fr: "mule-entredoigt-tressee", en: "woven-toe-mule" }, name: { fr: "Mule entre-doigt tressée", en: "Woven toe mule" }, price: 28000, image: "/images_demo/mule_entredoigt_couvrante_en_cuir_tressé.jpg", category: "femme", colors: ["#14120F", "#92502f", "#D2531E"], material: { fr: "Cuir tressé", en: "Woven leather" }, subtitle: { fr: "Cuir pleine fleur tressé, semelle cuir cousue main", en: "Woven full-grain leather, hand-stitched leather sole" }, availableSizes: ["38", "39", "40", "41"], unavailableSizes: ["42", "43"], badge: { fr: "Nouveau", en: "New" } },
  { slug: { fr: "mule-bride-diagonale", en: "diagonal-strap-mule" }, name: { fr: "Mule à bride diagonale", en: "Diagonal strap mule" }, price: 32000, image: "/images_demo/mule_à_bride_diagonale_et_boucle.jpg", category: "femme", colors: ["#14120F", "#92502f"], material: { fr: "Cuir lisse", en: "Smooth leather" }, subtitle: { fr: "Une silhouette graphique, pensée pour durer", en: "A graphic silhouette, made to last" }, availableSizes: ["38", "39", "40", "41", "42"], unavailableSizes: ["43"] },
  { slug: { fr: "sandale-spartiate-rivets", en: "studded-leather-sandal" }, name: { fr: "Sandale spartiate à rivets", en: "Studded leather sandal" }, price: 35000, image: "/images_demo/sandale_spartiate_en_cuir_à_rivets_et_bride_cheville.jpg", category: "homme", colors: ["#92502f", "#D2A477"], material: { fr: "Cuir pleine fleur", en: "Full-grain leather" }, subtitle: { fr: "Une spartiate structurée pour lui", en: "A structured gladiator sandal for him" }, availableSizes: ["39", "40", "41", "42", "43"], unavailableSizes: ["38"] },
  { slug: { fr: "mule-a-double-boucle", en: "double-buckle-mule" }, name: { fr: "Mule à double boucle", en: "Double buckle mule" }, price: 30000, image: "/images_demo/mule_à_double_boucle_découpée.jpg", category: "homme", colors: ["#92502f", "#D2A477", "#14120F"], material: { fr: "Cuir lisse", en: "Smooth leather" }, subtitle: { fr: "Du caractère et du confort au quotidien", en: "Character and comfort for every day" }, availableSizes: ["39", "40", "41", "42"], unavailableSizes: ["38", "43"] },
  { slug: { fr: "sandale-bague-orteil", en: "toe-ring-sandal" }, name: { fr: "Sandale à bague d’orteil", en: "Toe ring sandal" }, price: 26000, image: "/images_demo/sandales_à_bague_d_orteil.jpg", category: "nouveautes", colors: ["#92502f", "#D2531E"], material: { fr: "Cuir souple", en: "Soft leather" }, subtitle: { fr: "Élégante et légère", en: "Elegant and light" }, availableSizes: ["36", "37", "38", "39", "40"], unavailableSizes: ["41", "42"], badge: { fr: "Nouveau", en: "New" } },
  { slug: { fr: "mule-bandes-croisees", en: "crossed-strap-mule" }, name: { fr: "Mule à brides croisées", en: "Crossed strap mule" }, price: 29000, image: "/images_demo/mules_à_brides_croisées.jpg", category: "couple-enfant", colors: ["#14120F", "#92502f"], material: { fr: "Cuir tressé", en: "Woven leather" }, subtitle: { fr: "Une ligne essentielle et confortable", en: "An essential, comfortable line" }, availableSizes: ["36", "37", "38", "39", "40", "41"], unavailableSizes: ["42", "43"] },
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
