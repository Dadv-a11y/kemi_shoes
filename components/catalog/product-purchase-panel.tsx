"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addToCart, savePreferences } from "@/lib/cart";
import { getProductBySlug } from "@/lib/catalog";

const sizes = ["38", "39", "40", "41", "42", "43"];
const colors = ["Noir", "Cognac", "Naturel"];

export function ProductPurchasePanel({ addLabel, whatsappLabel, colorLabel, sizeLabel, quantityLabel = "Quantité", materialLabel, materialValue, availableSizes, unavailableSizes, customNote }: { addLabel: string; whatsappLabel: string; colorLabel: string; sizeLabel: string; quantityLabel?: string; materialLabel: string; materialValue: string; availableSizes: string[]; unavailableSizes: string[]; customNote: string }) {
  const [selectedSize, setSelectedSize] = useState("40");
  const [selectedColor, setSelectedColor] = useState(colors[0]);
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
    const slug = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    const product = getProductBySlug(slug);
    if (!product) return;
    const locale = window.location.pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
    addToCart({ slug: product.slug[locale], name: product.name[locale], price: product.price, image: product.image, size: selectedSize, color: selectedColor, material: selectedMaterial }, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="purchase-panel">
      <fieldset className="option-group"><legend>{colorLabel}</legend><div className="option-row">{colors.map((color) => <button type="button" key={color} onClick={() => updatePreference({ color })} className={cn("color-option", selectedColor === color && "option-selected")}><span className={cn("color-swatch", `swatch-${color.toLowerCase()}`)} />{color}{selectedColor === color && <Check aria-hidden="true" />}</button>)}</div></fieldset>
      <fieldset className="option-group"><legend>{materialLabel}</legend><div className="material-row">{[materialValue, "Cuir lisse", "Daim"].map((material) => <Button key={material} type="button" variant={selectedMaterial === material ? "default" : "outline"} onClick={() => updatePreference({ material })}>{material}</Button>)}</div><p className="custom-note">{customNote}</p></fieldset>
      <fieldset className="option-group"><legend>{sizeLabel}</legend><div className="size-row">{sizes.map((size) => { const unavailable = unavailableSizes.includes(size) || !availableSizes.includes(size); return <button type="button" disabled={unavailable} key={size} onClick={() => updatePreference({ size })} className={cn("size-option", selectedSize === size && "option-selected", unavailable && "size-unavailable")}>{size}</button>; })}</div><p className="size-note">Les tailles disponibles varient selon le modèle.</p></fieldset>
      <div className="quantity-row"><span>{quantityLabel}</span><div className="quantity-control"><Button type="button" variant="outline" size="icon-sm" aria-label="Diminuer la quantité" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus aria-hidden="true" /></Button><span>{quantity}</span><Button type="button" variant="outline" size="icon-sm" aria-label="Augmenter la quantité" onClick={() => setQuantity(quantity + 1)}><Plus aria-hidden="true" /></Button></div></div>
      <Button type="button" size="lg" className="purchase-button" onClick={handleAdd}><ShoppingBag data-icon="inline-start" />{added ? "Ajouté au panier" : addLabel}</Button>
      <Button type="button" variant="outline" size="lg" className="whatsapp-button">{whatsappLabel}</Button>
    </div>
  );
}
