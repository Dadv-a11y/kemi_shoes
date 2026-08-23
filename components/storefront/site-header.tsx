import Link from "next/link";
import { Menu, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <>
      <div className="announcement">Livraison partout au Cameroun · Paiement à la livraison disponible</div>
      <header className="site-header">
        <Link href="/" className="logo" aria-label="KEMI SHOES, accueil">KEMI <span>SHOES</span></Link>
        <nav className="main-nav" aria-label="Navigation principale">
          <Link href="/boutique">La boutique</Link>
          <Link href="/notre-histoire">Notre histoire</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <div className="header-actions">
          <Link href="/compte/connexion" className="account-link">Compte</Link>
          <Link href="/panier" className="cart-link" aria-label="Panier"><ShoppingBag aria-hidden="true" /><span>0</span></Link>
          <Button variant="ghost" size="icon" className="mobile-menu" aria-label="Ouvrir le menu"><Menu aria-hidden="true" /></Button>
        </div>
      </header>
    </>
  );
}
