import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div><span className="logo">KEMI <span>SHOES</span></span><p>Le cuir, autrement.</p></div>
      <div className="footer-links"><Link href="/aide">Aide</Link><Link href="/contact">Contact</Link><Link href="https://www.instagram.com/kemi_shoes_237"><i className="fa-brands fa-instagram" aria-hidden="true" /> Instagram</Link></div>
      <small>© 2026 KEMI SHOES · Douala, Cameroun</small>
    </footer>
  );
}
