"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { reportClientError } from "@/lib/monitoring";

/**
 * Erreur de rendu d'une page : message lisible, référence à communiquer (digest,
 * identique à celui des logs serveur) et rapport envoyé à la supervision.
 */
export default function PageError({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  const locale = usePathname().split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  useEffect(() => {
    reportClientError({ message: error.message, stack: error.stack, digest: error.digest, kind: "render" });
  }, [error]);
  return (
    <main className="legal-page">
      <header className="legal-heading">
        <span className="eyebrow">KEMI SHOES</span>
        <h1>{locale === "en" ? "Something went wrong" : "Une erreur est survenue"}</h1>
        <p>{locale === "en" ? "The page could not be displayed. Please try again." : "La page n’a pas pu s’afficher. Réessayez dans un instant."}</p>
        {error.digest && <p><small>{locale === "en" ? "Reference" : "Référence"} : <code>{error.digest}</code></small></p>}
        <p><button type="button" className="auth-primary" onClick={() => (retry ?? reset)?.()}>{locale === "en" ? "Try again" : "Réessayer"}</button></p>
      </header>
    </main>
  );
}
