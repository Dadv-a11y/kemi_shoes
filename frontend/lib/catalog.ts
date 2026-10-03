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
  material: LocalizedText;
  subtitle: LocalizedText;
  availableSizes: string[];
  unavailableSizes: string[];
  badge?: LocalizedText;
};


export function formatPrice(price: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CM" : "en-CM").format(price) + " FCFA";
}
