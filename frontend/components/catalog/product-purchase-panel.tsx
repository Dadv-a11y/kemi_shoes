"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addToCart, savePreferences } from "@/lib/cart";

// Repli si le produit ne renvoie ni tailles ni couleurs (ne devrait pas arriver avec l'API).
const FALLBACK_SIZES = ["38", "39", "40", "41", "42", "43"];
const FALLBACK_COLORS = [{ name: "Noir", hex: "#171310" }, { name: "Cognac", hex: "#9b5a32" }, { name: "Naturel", hex: "#d2a477" }];

export function ProductPurchasePanel({ productId, slug, name, price, image, addLabel, whatsappLabel, colorLabel, sizeLabel, quantityLabel = "Quantité", materialLabel, materialValue, materialCustomizable = true, colorOptions, availableSizes, unavailableSizes, customNote }: { productId?: string; slug: string; name: string; price: number; image: string; addLabel: string; whatsappLabel: string; colorLabel: string; sizeLabel: string; quantityLabel?: string; materialLabel: string; materialValue: string; materialCustomizable?: boolean; colorOptions?: { name: string; hex: string }[]; availableSizes: string[]; unavailableSizes: string[]; customNote: string }) {
  // Tailles et couleurs réelles du produit : la taille envoyée au backend doit exister et être disponible.
  const sizes = [...new Set([...availableSizes, ...unavailableSizes])].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const displayedSizes = sizes.length ? sizes : FALLBACK_SIZES;
  const colors = colorOptions?.length ? colorOptions : FALLBACK_COLORS;
  const [selectedSize, setSelectedSize] = useState(availableSizes.includes("40") ? "40" : availableSizes[0] ?? "");
  const [selectedColor, setSelectedColor] = useState(colors[0].name);
  const [selectedMaterial, setSelectedMaterial] = useState(materialValue);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const updatePreference = (preference: { size?: string; color?: string; material?: string }) => {
    const next = { size: preference.size ?? selectedSize, color: preference.color ?? selectedColor, material: preference.material ?? selectedMaterial };
    if (preference.size) setSelectedSize(preference.size);
    if (preference.color) setSelectedColor(preference.color);
    if (preference.material) setSelectedMaterial(preference.material);
    savePreferences(next);
  };

  const handleAdd = () => {
    if (!productId || !availableSizes.includes(selectedSize)) return;
    addToCart({ productId, slug, name, price, image, size: selectedSize, color: selectedColor, material: selectedMaterial }, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="purchase-panel">
      <fieldset className="option-group"><legend>{colorLabel}</legend><div className="option-row">{colors.map(({ name: color, hex }) => <button type="button" key={color} onClick={() => updatePreference({ color })} className={cn("color-option", selectedColor === color && "option-selected")}><span className="color-swatch" style={{ backgroundColor: hex }} />{color}{selectedColor === color && <Check aria-hidden="true" />}</button>)}</div></fieldset>
      <fieldset className="option-group"><legend>{materialLabel}</legend><div className="material-row">{(materialCustomizable ? [materialValue, "Cuir lisse", "Daim"] : [materialValue]).map((material) => <Button key={material} type="button" variant={selectedMaterial === material ? "default" : "outline"} onClick={() => updatePreference({ material })}>{material}</Button>)}</div><p className="custom-note">{customNote}</p></fieldset>
      <fieldset className="option-group"><legend>{sizeLabel}</legend><div className="size-row">{displayedSizes.map((size) => { const unavailable = unavailableSizes.includes(size) || !availableSizes.includes(size); return <button type="button" disabled={unavailable} key={size} onClick={() => updatePreference({ size })} className={cn("size-option", selectedSize === size && "option-selected", unavailable && "size-unavailable")}>{size}</button>; })}</div><p className="size-note">Les tailles disponibles varient selon le modèle.</p></fieldset>
      <div className="quantity-row"><span>{quantityLabel}</span><div className="quantity-control"><Button type="button" variant="outline" size="icon-sm" aria-label="Diminuer la quantité" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus aria-hidden="true" /></Button><span>{quantity}</span><Button type="button" variant="outline" size="icon-sm" aria-label="Augmenter la quantité" onClick={() => setQuantity(quantity + 1)}><Plus aria-hidden="true" /></Button></div></div>
      <Button type="button" size="lg" className="purchase-button" disabled={!availableSizes.includes(selectedSize)} onClick={handleAdd}><ShoppingBag data-icon="inline-start" />{added ? "Ajouté au panier" : addLabel}</Button>
      <Button type="button" variant="outline" size="lg" className="whatsapp-button">{whatsappLabel}</Button>
    </div>
  );
}
