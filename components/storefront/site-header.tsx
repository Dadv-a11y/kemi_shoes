"use client";

import Link from "next/link";
import { Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CartBadge } from "@/components/cart/cart-badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function SiteHeader() {
  const pathname = usePathname();
  const locale = pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  const localized = (path: string) => `/${locale}${path}`;

  return (
    <>
      <div className="announcement">Livraison à Douala et partout au Cameroun · Paiement à la livraison disponible · +237 6XX XXX XXX</div>
      <header className="site-header">
        <Link href={localized("/")} className="logo" aria-label="KEMI SHOES, accueil">KEMI <span>SHOES</span></Link>
        <nav className="main-nav" aria-label="Navigation principale">
          <Link href={localized("/")} className={pathname === `/${locale}` ? "active" : ""}>Home</Link>
          <Link href={localized("/boutique?categorie=homme")}>Homme</Link>
          <Link href={localized("/boutique?categorie=femme")}>Femme</Link>
          <Link href={localized("/boutique?categorie=nouveautes")}>Nouveautés</Link>
          <Link href={localized("/notre-histoire")}>Notre histoire</Link>
        </nav>
        <div className="header-actions">
          <Link href={localized("/boutique")} className="search-link" aria-label="Rechercher"><Search aria-hidden="true" /></Link>
          <Link href={localized("/compte/connexion")} className="account-link" aria-label="Mon compte"><UserRound aria-hidden="true" /></Link>
          <CartBadge><ShoppingBag aria-hidden="true" /></CartBadge>
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="mobile-menu" aria-label="Ouvrir le menu" />}>
              <Menu aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" className="mobile-nav-sheet">
              <SheetHeader className="mobile-nav-header">
                <SheetTitle className="logo">KEMI <span>SHOES</span></SheetTitle>
              </SheetHeader>
              <nav className="mobile-nav" aria-label="Navigation mobile">
                <Link href={localized("/")}>Home</Link>
                <Link href={localized("/boutique?categorie=homme")}>Homme</Link>
                <Link href={localized("/boutique?categorie=femme")}>Femme</Link>
                <Link href={localized("/boutique?categorie=nouveautes")}>Nouveautés</Link>
                <Link href={localized("/notre-histoire")}>Notre histoire</Link>
              </nav>
              <div className="mobile-nav-footer">
                <Link href={localized("/compte/connexion")}><UserRound aria-hidden="true" /> Mon compte</Link>
                <Link href={localized("/panier")}><ShoppingBag aria-hidden="true" /> Mon panier</Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </>
  );
}
