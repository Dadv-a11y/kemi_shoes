"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { backendRequest } from "@/lib/backend-api";

type StoreSettings = { whatsapp: string; instagram: string; facebook: string; address: string; email: string };

const defaultSettings: StoreSettings = { whatsapp: "+237678666069", instagram: "https://www.instagram.com/kemi_shoes_237", facebook: "https://web.facebook.com/ischristdiamal0", address: "pk11, Douala", email: "" };

export function SiteFooter() {
  const pathname = usePathname();
  const locale = pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  const prefix = `/${locale}`;
  const [settings, setSettings] = useState(defaultSettings);
  useEffect(() => {
    // Coordonnées éditables dans Admin > Paramètres ; valeurs par défaut si vides.
    backendRequest<Partial<StoreSettings>>("/settings")
      .then((result) => setSettings((current) => ({ ...current, ...Object.fromEntries(Object.entries(result).filter(([, value]) => value)) })))
      .catch(() => undefined);
  }, []);
  const legal = locale === "en" ? { notice: "Legal notice", terms: "Terms", privacy: "Privacy policy", madeBy: "Created by" } : { notice: "Mentions légales", terms: "CGV", privacy: "Politique de confidentialité", madeBy: "Créé par" };

  return (
    <footer className="site-footer">
      <div className="footer-top"><div className="footer-brand"><span className="logo">KEMI <span>SHOES</span></span><p>Sandales en cuir assemblées à la main à Douala, Cameroun. Livraison nationale et internationale.</p></div><div className="footer-col"><h4>Boutique</h4><Link href={`${prefix}/boutique?categorie=homme`}>Sandales Homme</Link><Link href={`${prefix}/boutique?categorie=femme`}>Sandales Femme</Link><Link href={`${prefix}/boutique?categorie=nouveautes`}>Nouveautés</Link><Link href={`${prefix}/boutique?categorie=couple-enfant`}>Couple & Enfant</Link></div><div className="footer-col"><h4>Aide</h4><Link href={`${prefix}/cgv`}>Livraison & retours</Link><Link href={`${prefix}/compte`}>Suivre ma commande</Link><a href={settings.email ? `mailto:${settings.email}` : `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}>Contact</a></div><div className="footer-col"><h4>Contact</h4><Link href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}>WhatsApp</Link><Link href={settings.instagram}><i className="fa-brands fa-instagram" aria-hidden="true" /> Instagram</Link><Link href={settings.facebook}><i className="fa-brands fa-facebook" aria-hidden="true" /> Facebook</Link><span>{settings.address}</span></div></div>
      <div className="footer-bottom"><small>© 2026 KEMI SHOES — Tous droits réservés</small><small><Link href={`${prefix}/mentions-legales`}>{legal.notice}</Link> · <Link href={`${prefix}/cgv`}>{legal.terms}</Link> · <Link href={`${prefix}/confidentialite`}>{legal.privacy}</Link></small><small>{legal.madeBy} <a href="https://nexa-digitallab.com" target="_blank" rel="noopener noreferrer">Nexa Digital</a></small></div>
    </footer>
  );
}
