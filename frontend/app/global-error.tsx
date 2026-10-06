"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring";

// Erreur dans le layout racine : rendu autonome (sans styles globaux) et rapport à la supervision.
export default function GlobalError({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  useEffect(() => {
    reportClientError({ message: error.message, stack: error.stack, digest: error.digest, kind: "render" });
  }, [error]);
  return (
    <html lang="fr">
      <body style={{ fontFamily: "sans-serif", padding: 40, textAlign: "center" }}>
        <h1>Une erreur est survenue</h1>
        <p>Le site n’a pas pu s’afficher. Réessayez dans un instant.</p>
        {error.digest && <p><small>Référence : <code>{error.digest}</code></small></p>}
        <button type="button" onClick={() => (retry ?? reset)?.()}>Réessayer</button>
      </body>
    </html>
  );
}
