"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { addToCart } from "@/lib/cart";
import { BASE_MATERIAL, type Locale, type Product } from "@/lib/catalog";

/**
 * Ajout rapide depuis une carte produit : une taille à choisir (parmi celles en stock), couleur et matière
 * par défaut. Le toast « Ajouté au panier » confirme l'ajout (hors panier et fiche produit).
 */
export function QuickAdd({ product, locale }: { product: Product; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const sizes = [...product.availableSizes].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  if (!product.id || sizes.length === 0) return null;

  const add = (size: string) => {
    addToCart({ productId: product.id as string, slug: product.slug[locale], name: product.name[locale], price: product.price, image: product.image, size, color: product.colorOptions?.[0]?.name ?? "", material: BASE_MATERIAL[locale] }, 1);
    setOpen(false);
    setDone(true);
    window.setTimeout(() => setDone(false), 1500);
  };
  const label = locale === "en" ? { add: "Quick add", pick: "Pick a size" } : { add: "Ajout rapide", pick: "Choisir une taille" };

  return (
    <div className="quick-add-layer" ref={root}>
      {open && (
        <div className="quick-add-sizes" role="menu" aria-label={label.pick}>
          <span>{label.pick}</span>
          <div>{sizes.map((size) => <button type="button" role="menuitem" key={size} onClick={() => add(size)}>{size}</button>)}</div>
        </div>
      )}
      <button type="button" className="quick-add-button" aria-label={`${label.add} : ${product.name[locale]}`} aria-expanded={open} onClick={() => setOpen((state) => !state)}>
        {done ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
      </button>
    </div>
  );
}
