import type { Instrumentation } from "next";

/**
 * Erreurs du serveur Next (rendu, route handlers, proxy) remontées au backend :
 * elles apparaissent dans la supervision (source « frontend-server ») et déclenchent
 * une alerte e-mail. Authentifié par LOG_INGEST_KEY (variable serveur, jamais exposée
 * au navigateur). Sans clé configurée, rien n'est envoyé.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const apiUrl = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL;
  const key = process.env.LOG_INGEST_KEY;
  if (!apiUrl || !key) return;
  const error = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  try {
    await fetch(`${apiUrl}/monitoring/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Log-Ingest-Key": key },
      body: JSON.stringify({
        message: error.message.slice(0, 1000),
        stack: error.stack?.slice(0, 8000),
        url: request.path.split("?")[0].slice(0, 500),
        route: `${context.routePath} (${context.routeType})`.slice(0, 300),
        method: request.method,
        kind: "server",
        digest,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* backend injoignable : l'erreur reste dans les logs Vercel */
  }
};
