"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { markShopScroll } from "@/lib/shop-scroll";

/** Onglet de la boutique : mémorise que la page suivante doit défiler jusqu'à la liste de produits. */
export function ShopTabLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} onClick={(event) => { markShopScroll(); props.onClick?.(event); }} />;
}
