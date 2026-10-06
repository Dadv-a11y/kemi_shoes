export type Locale = "fr" | "en";
export type ProductCategory = "femme" | "homme" | "nouveautes" | "couple-enfant";

export type LocalizedText = { fr: string; en: string };

export type Product = {
  id?: string;
  slug: LocalizedText;
  name: LocalizedText;
  price: number;
  image: string;
  images: string[];
  category: ProductCategory;
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
