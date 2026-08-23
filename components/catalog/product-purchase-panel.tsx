"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sizes = ["38", "39", "40", "41", "42", "43"];
const colors = ["Noir", "Cognac", "Naturel"];

export function ProductPurchasePanel({ addLabel, whatsappLabel }: { addLabel: string; whatsappLabel: string }) {
  const [selectedSize, setSelectedSize] = useState("40");
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="purchase-panel">
      <fieldset className="option-group"><legend>Couleur</legend><div className="option-row">{colors.map((color) => <button type="button" key={color} onClick={() => setSelectedColor(color)} className={cn("color-option", selectedColor === color && "option-selected")}><span className={cn("color-swatch", `swatch-${color.toLowerCase()}`)} />{color}{selectedColor === color && <Check aria-hidden="true" />}</button>)}</div></fieldset>
      <fieldset className="option-group"><legend>Taille (EU)</legend><div className="size-row">{sizes.map((size) => <button type="button" key={size} onClick={() => setSelectedSize(size)} className={cn("size-option", selectedSize === size && "option-selected")}>{size}</button>)}</div></fieldset>
      <div className="quantity-row"><span>Quantité</span><div className="quantity-control"><Button type="button" variant="outline" size="icon-sm" aria-label="Diminuer la quantité" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus aria-hidden="true" /></Button><span>{quantity}</span><Button type="button" variant="outline" size="icon-sm" aria-label="Augmenter la quantité" onClick={() => setQuantity(quantity + 1)}><Plus aria-hidden="true" /></Button></div></div>
      <Button type="button" size="lg" className="purchase-button"><ShoppingBag data-icon="inline-start" />{addLabel}</Button>
      <Button type="button" variant="outline" size="lg" className="whatsapp-button">{whatsappLabel}</Button>
    </div>
  );
}
