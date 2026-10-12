import Link from "next/link";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { ProductPurchasePanel } from "@/components/catalog/product-purchase-panel";
import { formatPrice, productCategoryLabel, type Locale, type Product } from "@/lib/catalog";

export type ProductDetailLabels = { catalogTitle: string; handmade: string; add: string; whatsapp: string; color: string; size: string; material: string; customNote: string; making: string; care: string; delivery: string };

/**
 * Cœur de la fiche produit (fil d'Ariane, galerie, prix, achat, informations). Partagé par la page
 * publique /produits/[slug] et par l'aperçu du back-office : ce que voit l'admin est ce que voit le client.
 */
export function ProductDetail({ product, locale, labels }: { product: Product; locale: Locale; labels: ProductDetailLabels }) {
  const galleryImages = product.images.length ? product.images : [product.image];
  return (
    <>
      <div className="product-breadcrumb">
        <Link href={`/${locale}/boutique`}>
          <ArrowLeft aria-hidden="true" /> {labels.catalogTitle}
        </Link>
        <ChevronRight aria-hidden="true" />
        <span>{product.name[locale]}</span>
      </div>
      <section className="product-layout section">
        <div className="product-gallery">
          <ProductGallery images={galleryImages} name={product.name[locale]} />
          <Badge variant="secondary" className="product-handmade">{labels.handmade}</Badge>
        </div>
        <div className="product-details">
          <span className="eyebrow">{productCategoryLabel(product, locale)}</span>
          <h1>{product.name[locale]}</h1>
          <p className="product-subtitle">{product.subtitle[locale]}</p>
          <div className="product-price-row">
            <strong className="product-price">{formatPrice(product.price, locale)}</strong>
            <Badge className="stock-badge"><Check data-icon="inline-start" />En stock</Badge>
          </div>
          <ProductPurchasePanel
            productId={product.id}
            slug={product.slug[locale]}
            name={product.name[locale]}
            price={product.price}
            image={product.image}
            addLabel={labels.add}
            whatsappLabel={labels.whatsapp}
            colorLabel={labels.color}
            sizeLabel={labels.size}
            materialLabel={labels.material}
            materialValue={product.material[locale]}
            materialCustomizable={product.materialCustomizable}
            colorOptions={product.colorOptions}
            availableSizes={product.availableSizes}
            unavailableSizes={product.unavailableSizes}
            customNote={labels.customNote}
          />
          <ul className="delivery-list">
            <li><i />Livraison estimée : 24–48h (Douala/Yaoundé)</li>
            <li><i />Paiement à la livraison disponible au Cameroun</li>
            <li><i />Retours et échanges acceptés sous 7 jours</li>
          </ul>
          <Accordion className="product-accordion" defaultValue={["making"]} multiple>
            <AccordionItem value="making">
              <AccordionTrigger>{labels.making}</AccordionTrigger>
              <AccordionContent>Chaque paire est découpée, assemblée et finie à la main dans notre atelier à Douala par les mêmes artisans.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="care">
              <AccordionTrigger>{labels.care}</AccordionTrigger>
              <AccordionContent>Nettoyez avec un chiffon doux et nourrissez régulièrement le cuir avec un produit adapté.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="delivery">
              <AccordionTrigger>{labels.delivery}</AccordionTrigger>
              <AccordionContent>Livraison nationale sous 24h à 5 jours selon la zone. Retours acceptés sous 7 jours pour un article non porté.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
    </>
  );
}
