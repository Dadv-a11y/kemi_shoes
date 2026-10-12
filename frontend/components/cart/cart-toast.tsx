"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { CART_ITEM_ADDED_EVENT, type CartAddedDetail } from "@/lib/cart";

const DURATION_MS = 6000;

/**
 * Toast « Ajouté au panier » (haut de l'écran, centré) : produit ajouté, nombre total d'articles et action
 * « Commander ». Jamais affiché sur le panier ni sur une fiche produit, qui confirment l'ajout à leur façon.
 */
export function CartToast() {
  const pathname = usePathname();
  const locale = pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  const hidden = /^\/((fr|en)\/)?(panier|produits)(\/|$)/.test(pathname);
  const [toast, setToast] = useState<(CartAddedDetail & { key: number }) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const dismiss = () => { window.clearTimeout(timer.current); setToast(null); };
  const arm = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(null), DURATION_MS); };

  useEffect(() => {
    const onAdded = (event: Event) => {
      setToast({ ...(event as CustomEvent<CartAddedDetail>).detail, key: Date.now() });
      arm();
    };
    window.addEventListener(CART_ITEM_ADDED_EVENT, onAdded);
    return () => { window.removeEventListener(CART_ITEM_ADDED_EVENT, onAdded); window.clearTimeout(timer.current); };
  }, []);

  if (!toast || hidden) return null;
  const copy = locale === "en"
    ? { added: "Added to cart", items: (count: number) => `${count} item${count > 1 ? "s" : ""} in your cart`, checkout: "Checkout", close: "Close" }
    : { added: "Ajouté au panier", items: (count: number) => `${count} article${count > 1 ? "s" : ""} dans votre panier`, checkout: "Commander", close: "Fermer" };

  return (
    <div className="cart-toast-wrap" role="status" aria-live="polite">
      <div className="cart-toast" key={toast.key} onMouseEnter={() => window.clearTimeout(timer.current)} onMouseLeave={arm}>
        <span className="cart-toast-thumb"><Image src={toast.image} alt="" fill sizes="56px" /></span>
        <div className="cart-toast-body">
          <strong><Check aria-hidden="true" /> {copy.added}</strong>
          <span className="cart-toast-name">{toast.name}{toast.quantity > 1 ? ` × ${toast.quantity}` : ""}</span>
          <small>{[toast.size, toast.color].filter(Boolean).join(" · ")} — {copy.items(toast.count)}</small>
        </div>
        <Link className="cart-toast-action" href={`/${locale}/commande`} onClick={dismiss}>{copy.checkout}</Link>
        <button type="button" className="cart-toast-close" aria-label={copy.close} onClick={dismiss}><X aria-hidden="true" /></button>
      </div>
    </div>
  );
}
