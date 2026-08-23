"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CART_UPDATED_EVENT, getCart } from "@/lib/cart";

export function CartBadge({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(getCart().reduce((total, item) => total + item.quantity, 0));
    sync();
    window.addEventListener(CART_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CART_UPDATED_EVENT, sync);
  }, []);

  return <Link href={`/${locale}/panier`} className="cart-link" aria-label={`Panier (${count})`}>{children}<span>{count}</span></Link>;
}