import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

// URL ne correspondant à aucune route : vraie réponse 404, rendue hors du layout
// racine. Le 404 par défaut était pré-rendu en français dans le layout et son
// hydratation échouait sur les URL /en/… (React #418).
export const metadata: Metadata = {
  title: "KEMI SHOES | Page introuvable — Page not found",
};

export default function GlobalNotFound() {
  return (
    <html lang="fr">
      <body className="min-h-full">
        <main className="legal-page">
          <header className="legal-heading">
            <span className="eyebrow">KEMI SHOES · 404</span>
            <h1>Page introuvable</h1>
            <p>Cette page n’existe pas ou a été déplacée. <Link href="/fr/boutique">Retour à la boutique</Link></p>
            <p lang="en">This page does not exist or has been moved. <Link href="/en/boutique">Back to the shop</Link></p>
          </header>
        </main>
      </body>
    </html>
  );
}
