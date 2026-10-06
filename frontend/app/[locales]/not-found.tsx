"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LocaleNotFound() {
  const locale = usePathname().split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  return (
    <main className="legal-page">
      <header className="legal-heading">
        <span className="eyebrow">404</span>
        <h1>{locale === "en" ? "Page not found" : "Page introuvable"}</h1>
        <p>{locale === "en" ? "This page does not exist or has been moved." : "Cette page n’existe pas ou a été déplacée."}</p>
        <p><Link href={`/${locale}/boutique`}>{locale === "en" ? "Back to the shop" : "Retour à la boutique"}</Link></p>
      </header>
    </main>
  );
}
