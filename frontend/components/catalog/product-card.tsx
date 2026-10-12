import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice, type Locale, type Product } from "@/lib/catalog";

export function ProductCard({ product, locale, categoryLabel }: { product: Product; locale: Locale; categoryLabel: string }) {
  return (
    <Link href={`/${locale}/produits/${product.slug[locale]}`} className="catalog-card">
      <div className="catalog-image">
        <Image src={product.image} alt={product.name[locale]} fill sizes="(max-width: 768px) 100vw, 25vw" />
        {product.badge && <Badge variant="secondary" className="catalog-badge">{product.badge[locale]}</Badge>}
        <span className="catalog-price">{formatPrice(product.price, locale)}</span>
      </div>
      <div className="catalog-info"><div><h2>{product.name[locale]}</h2><span>{categoryLabel}</span></div><ArrowUpRight className="catalog-arrow" aria-hidden="true" /></div>
      <div className="catalog-swatches" aria-label="Couleurs disponibles">{product.colors.map((color) => <span key={color} title={color} style={{ backgroundColor: color }} />)}</div>
    </Link>
  );
}