import { backendApiUrl } from "@/lib/backend-api";

export type ClientErrorReport = {
  message: string;
  stack?: string;
  url?: string;
  kind?: "error" | "unhandledrejection" | "render";
  digest?: string;
};

// Garde-fous : au plus 10 rapports par chargement de page, sans doublon.
const MAX_REPORTS = 10;
const sent = new Set<string>();

/**
 * Envoie une erreur du navigateur au backend (POST /monitoring/client-errors) :
 * elle apparaît dans la supervision (source « frontend-browser »). Ne lève jamais.
 */
export function reportClientError(report: ClientErrorReport) {
  if (typeof window === "undefined") return;
  const key = `${report.kind}:${report.message}`;
  if (sent.has(key) || sent.size >= MAX_REPORTS) return;
  sent.add(key);
  const body = JSON.stringify({
    message: report.message.slice(0, 1000),
    stack: report.stack?.slice(0, 8000),
    url: (report.url ?? window.location.pathname + window.location.search).slice(0, 500),
    kind: report.kind ?? "error",
    digest: report.digest,
  });
  // keepalive : le rapport part même si la page se ferme ; aucun cookie n'est nécessaire.
  fetch(`${backendApiUrl}/monitoring/client-errors`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "omit" }).catch(() => undefined);
}
