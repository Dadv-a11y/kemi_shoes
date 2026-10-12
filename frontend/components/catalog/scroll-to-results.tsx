"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { consumeShopScroll } from "@/lib/shop-scroll";

/**
 * Après un clic sur un onglet (catégorie, collection) ou un filtre, amène la liste de produits en haut
 * de l'écran : plus besoin de refaire défiler la page à chaque transition. Sans effet à l'arrivée directe.
 */
export function ScrollToResults() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    if (!consumeShopScroll()) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("shop-results")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, search]);
  return null;
}
