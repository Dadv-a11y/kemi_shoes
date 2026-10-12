"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/catalog/product-card";
import { ProductDetail, type ProductDetailLabels } from "@/components/catalog/product-detail";
import { mapProduct, type CatalogApiProduct } from "@/lib/catalog-api";
import { productCategoryLabel, type Locale } from "@/lib/catalog";

export type PreviewMessage = { type: "kemi-product-preview"; mode: "card" | "pdp"; product: CatalogApiProduct };

/**
 * Page d'aperçu embarquée par le back-office : elle reçoit le produit en cours d'édition (postMessage)
 * et le rend avec les vrais composants de la boutique, dans une vraie fenêtre (media queries comprises).
 */
export function ProductPreviewFrame({ locale, labels }: { locale: Locale; labels: ProductDetailLabels }) {
  const [message, setMessage] = useState<PreviewMessage | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as Partial<PreviewMessage> | null;
      if (data?.type === "kemi-product-preview" && data.product) setMessage(data as PreviewMessage);
    };
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "kemi-product-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!message) return <main className="preview-empty">…</main>;
  const product = mapProduct(message.product);
  // Aperçu : aucune interaction (ajout au panier, liens) — on ne regarde que le rendu.
  return (
    <div className="product-preview-root" inert>
      {message.mode === "card"
        ? <main className="preview-card-stage"><div className="preview-card"><ProductCard product={product} locale={locale} categoryLabel={productCategoryLabel(product, locale)} /></div></main>
        : <main className="product-page"><ProductDetail product={product} locale={locale} labels={labels} /></main>}
    </div>
  );
}
