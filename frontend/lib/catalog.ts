export type Locale = "fr" | "en";
/** Slug d'une catégorie gérée dans le back-office (« homme », « femme », …). */
export type ProductCategory = string;

/** Slug de la vue « Nouveautés » (calculée : produits de moins de 14 jours). */
export const NEW_CATEGORY_SLUG = "nouveautes";

export type LocalizedText = { fr: string; en: string };

export type Product = {
  id?: string;
  slug: LocalizedText;
  name: LocalizedText;
  price: number;
  image: string;
  images: string[];
  /** Catégorie réelle choisie dans le back-office (slug, jamais « nouveautes »). */
  category: ProductCategory;
  /** Nom de la catégorie, tel que saisi dans le back-office. */
  categoryName: LocalizedText;
  /** Ajouté depuis moins de 14 jours (calculé par l'API). */
  isNew?: boolean;
  colors: string[];
  /** Couleurs du produit (nom + hex) telles que saisies dans le back-office. */
  colorOptions?: { name: string; hex: string }[];
  material: LocalizedText;
  /** false : seule la matière de base est proposée (le backend refuse customMaterial). */
  materialCustomizable?: boolean;
  subtitle: LocalizedText;
  availableSizes: string[];
  unavailableSizes: string[];
  badge?: LocalizedText;
};


/** Matière standard : la choisir n'est pas une personnalisation. */
export const BASE_MATERIAL = { fr: "Cuir", en: "Leather" } as const;

export function isCustomMaterial(material?: string) {
  return Boolean(material) && material !== BASE_MATERIAL.fr && material !== BASE_MATERIAL.en;
}

export function formatPrice(price: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CM" : "en-CM").format(price) + " FCFA";
}

/** Libellé de catégorie des cartes : « Nouveautés » pendant 14 jours, puis la vraie catégorie. */
export function productCategoryLabel(product: Pick<Product, "isNew" | "categoryName">, locale: Locale) {
  return product.isNew ? (locale === "en" ? "New in" : "Nouveautés") : product.categoryName[locale];
}
