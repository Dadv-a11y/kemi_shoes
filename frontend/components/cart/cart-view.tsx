"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, ShoppingCart, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatPrice, type Locale, type Product } from "@/lib/catalog";
import { backendRequest } from "@/lib/backend-api";
import { mapProduct, type CatalogApiProduct } from "@/lib/catalog-api";
import { CART_UPDATED_EVENT, getCart, saveCart, type CartItem } from "@/lib/cart";
import { ProductCard } from "@/components/catalog/product-card";

type Labels = Record<"title" | "emptyTitle" | "emptyText" | "discover" | "clear" | "deliveryTo" | "destination" | "edit" | "size" | "color" | "material" | "personalized" | "remove" | "promo" | "promoPlaceholder" | "apply" | "summary" | "subtotal" | "delivery" | "discount" | "total" | "totalNote" | "checkout" | "secure" | "returns" | "recommendations" | "filledPreview" | "emptyPreview" | "preview", string>;

export function CartView({ locale, labels, categoryLabels }: { locale: Locale; labels: Labels; categoryLabels: Record<string, string> }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  useEffect(() => {
    backendRequest<{ items: CatalogApiProduct[] }>("/products?status=active&pageSize=8")
      .then((result) => setSuggestions(result.items.map(mapProduct)))
      .catch(() => setSuggestions([]));
    // Estimation : zone active la moins chère ; le montant exact est fixé au checkout.
    backendRequest<{ feeFcfa: number; active: boolean }[]>("/delivery-zones")
      .then((zones) => {
        const fees = zones.filter((zone) => zone.active).map((zone) => zone.feeFcfa);
        setDeliveryFee(fees.length ? Math.min(...fees) : 0); // Math.min() vide = Infinity
      })
      .catch(() => setDeliveryFee(0));
  }, []);
  // Suggestions : jamais un produit déjà présent dans le panier.
  const visibleSuggestions = suggestions.filter((product) => !items.some((item) => item.productId === product.id)).slice(0, 4);
  useEffect(() => {
    const sync = () => setItems(getCart());
    sync();
    window.addEventListener(CART_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CART_UPDATED_EVENT, sync);
  }, []);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const delivery = items.length && Number.isFinite(deliveryFee) ? deliveryFee : 0;
  const changeQuantity = (id: string, delta: number) => {
    const next = items.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item);
    setItems(next);
    saveCart(next);
  };
  const removeItem = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    saveCart(next);
  };
  return <main className="cart-page">
    {items.length > 0 ? <>
      <div className="cart-title-row"><h1>{labels.title} ({itemCount})</h1><button className="cart-clear" onClick={() => { setItems([]); saveCart([]); }}>{labels.clear}</button></div>
      <div className="cart-zone"><span><Truck aria-hidden="true" />{labels.deliveryTo} <strong>{labels.destination}</strong></span><button>{labels.edit}</button></div>
      <section className="cart-content"><div className="cart-layout"><div className="cart-items">{items.map((item) => <article className="cart-item" key={item.id}><div className="cart-placeholder"><Image src={item.image} alt={item.name} width={96} height={96} className="cart-product-image" /></div><div className="cart-item-info"><h2>{item.name}</h2><p>{labels.size} {item.size} · {labels.color} {item.color} · {item.material}</p><div className="cart-item-bottom"><div className="cart-quantity"><button onClick={() => changeQuantity(item.id, -1)} aria-label={`- ${item.name}`}><Minus /></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)} aria-label={`+ ${item.name}`}><Plus /></button></div><strong>{formatPrice(item.price * item.quantity, locale)}</strong></div></div><button className="cart-remove" onClick={() => removeItem(item.id)} aria-label={`${labels.remove}: ${item.name}`}><X /></button></article>)}<div className="cart-promo"><label htmlFor="promo">{labels.promo}</label><div><input id="promo" placeholder={labels.promoPlaceholder} /><button>{labels.apply}</button></div></div></div><aside className="cart-summary"><h2>{labels.summary}</h2><div><span>{labels.subtotal} ({itemCount})</span><span>{formatPrice(subtotal, locale)}</span></div><div><span>{labels.delivery}</span><span>{formatPrice(delivery, locale)}</span></div><div><span>{labels.discount}</span><span>—</span></div><div className="cart-total"><strong>{labels.total}</strong><strong>{formatPrice(subtotal + delivery, locale)}</strong></div><p>{labels.totalNote}</p><Link href={`/${locale}/commande`} className="cart-checkout">{labels.checkout}</Link><small><span>🔒 {labels.secure}</span><span>↩ {labels.returns}</span></small></aside></div></section>
      {visibleSuggestions.length > 0 && <section className="cart-recommendations"><h2>{labels.recommendations}</h2><div className="catalog-grid">{visibleSuggestions.map((item) => <ProductCard key={item.id ?? item.slug.fr} product={item} locale={locale} categoryLabel={categoryLabels[item.category] ?? ""} />)}</div></section>}
    </> : <section className="cart-empty"><div className="cart-empty-icon"><ShoppingCart aria-hidden="true" /></div><h1>{labels.emptyTitle}</h1><p>{labels.emptyText}</p><Link href={`/${locale}/boutique`} className="cart-checkout">{labels.discover}</Link></section>}
  </main>;
}