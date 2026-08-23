import Link from "next/link";
import { Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartBadge } from "@/components/cart/cart-badge";

export function SiteHeader() {
  return (
    <>
      <div className="announcement">Livraison Cameroun & international · Paiement à la livraison disponible · ★ 4.8/5 sur 300+ avis</div>
      <header className="site-header">
        <Link href="/" className="logo" aria-label="KEMI SHOES, accueil">KEMI <span>SHOES</span></Link>
        <nav className="main-nav" aria-label="Navigation principale">
          <Link href="/boutique?categorie=homme">Homme</Link>
          <Link href="/boutique?categorie=femme">Femme</Link>
          <Link href="/boutique?categorie=nouveautes">Nouveautés</Link>
          <Link href="/notre-histoire">Notre histoire</Link>
        </nav>
        <div className="header-actions">
          <Link href="/boutique" className="search-link" aria-label="Rechercher"><Search aria-hidden="true" /></Link>
          <Link href="/compte/connexion" className="account-link" aria-label="Mon compte"><UserRound aria-hidden="true" /></Link>
          <CartBadge><ShoppingBag aria-hidden="true" /></CartBadge>
          <Button variant="ghost" size="icon" className="mobile-menu" aria-label="Ouvrir le menu"><Menu aria-hidden="true" /></Button>
        </div>
      </header>
    </>
  );
}
