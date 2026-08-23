import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top"><div className="footer-brand"><span className="logo">KEMI <span>SHOES</span></span><p>Sandales en cuir assemblées à la main à Douala, Cameroun. Livraison nationale et internationale.</p></div><div className="footer-col"><h4>Boutique</h4><Link href="/boutique?categorie=homme">Sandales Homme</Link><Link href="/boutique?categorie=femme">Sandales Femme</Link><Link href="/boutique?categorie=nouveautes">Nouveautés</Link><Link href="/boutique?categorie=couple-enfant">Couple & Enfant</Link></div><div className="footer-col"><h4>Aide</h4><Link href="/aide">FAQ</Link><Link href="/aide/livraison-retours">Livraison & retours</Link><Link href="/aide/guide-des-tailles">Guide des tailles</Link><Link href="/contact">Contact</Link></div><div className="footer-col"><h4>Contact</h4><Link href="https://wa.me/237678666069">WhatsApp</Link><Link href="https://www.instagram.com/kemi_shoes_237"><i className="fa-brands fa-instagram" aria-hidden="true" /> Instagram</Link><Link href="https://web.facebook.com/ischristdiamal0"><i className="fa-brands fa-facebook" aria-hidden="true" /> Facebook</Link><span>pk11, Douala</span></div></div>
      <div className="footer-bottom"><small>© 2026 KEMI SHOES — Tous droits réservés</small><small>Mentions légales · CGV · Politique de confidentialité</small></div>
    </footer>
  );
}
