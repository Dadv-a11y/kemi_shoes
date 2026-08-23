"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, ShoppingCart, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatPrice, type Locale } from "@/lib/catalog";
import { products } from "@/lib/catalog";
import { CART_UPDATED_EVENT, getCart, saveCart, type CartItem } from "@/lib/cart";

type Labels = Record<"title" | "emptyTitle" | "emptyText" | "discover" | "clear" | "deliveryTo" | "destination" | "edit" | "size" | "color" | "material" | "personalized" | "remove" | "promo" | "promoPlaceholder" | "apply" | "summary" | "subtotal" | "delivery" | "discount" | "total" | "totalNote" | "checkout" | "secure" | "returns" | "recommendations" | "filledPreview" | "emptyPreview" | "preview", string>;
const suggestions = products.slice(0, 4);

export function CartView({ locale, labels }: { locale: Locale; labels: Labels }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(getCart());
    sync();
    window.addEventListener(CART_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CART_UPDATED_EVENT, sync);
  }, []);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const delivery = items.length ? 1500 : 0;
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
      <section className="cart-recommendations"><h2>{labels.recommendations}</h2><div>{suggestions.map((item) => <Link href={`/${locale}/produits/${item.slug[locale]}`} className="cart-recommendation-card" key={item.slug.fr}><div className="cart-recommendation-image"><Image src={item.image} alt={item.name[locale]} fill sizes="(max-width: 560px) 50vw, 25vw" /><span>{formatPrice(item.price, locale)}</span></div><strong>{item.name[locale]}</strong><small>{item.subtitle[locale]}</small></Link>)}</div></section>
    </> : <section className="cart-empty"><div className="cart-empty-icon"><ShoppingCart aria-hidden="true" /></div><h1>{labels.emptyTitle}</h1><p>{labels.emptyText}</p><Link href={`/${locale}/boutique`} className="cart-checkout">{labels.discover}</Link></section>}
  </main>;
}