const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? process.env.BACKEND_API_URL ?? "http://localhost:4000/api/v1";

export type ApiError = { error?: { code?: string; message?: string } };

// Les jetons de session sont des cookies HttpOnly posés par l'API : le JavaScript
// de la page ne les voit jamais. On ne garde côté navigateur qu'un simple
// indicateur « connecté » (aucun secret) pour éviter des appels inutiles en invité.
const SESSION_FLAG = "kemi-has-session";

// Anciennes versions : jetons stockés dans localStorage. On les efface au chargement.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("kemi-access-token");
    window.localStorage.removeItem("kemi-refresh-token");
  } catch {
    /* stockage indisponible */
  }
}

export function markSession() {
  try {
    window.localStorage.setItem(SESSION_FLAG, "1");
  } catch {
    /* stockage indisponible (navigation privée stricte) : sans incidence */
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_FLAG);
  } catch {
    /* idem */
  }
}

export function hasSession() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SESSION_FLAG) === "1";
  } catch {
    return false;
  }
}

/** Requêtes vers l'API : les cookies de session sont joints (`credentials: "include"`). */
function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(`${apiUrl}${path}`, { ...options, credentials: "include" });
}

// Un seul renouvellement à la fois : les refresh tokens sont rotatifs côté serveur,
// deux renouvellements parallèles avec le même cookie seraient pris pour un rejeu.
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await apiFetch("/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (response.ok) return true;
      const payload = (await response.json().catch(() => ({}))) as ApiError;
      // Un autre onglet vient de renouveler la session : les nouveaux cookies sont déjà en place.
      if (payload.error?.code === "REFRESH_SUPERSEDED") return true;
    } catch {
      /* réseau indisponible : traité comme un échec de renouvellement */
    }
    clearSession();
    return false;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function backendRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestJson<T>(path, options, true);
}

async function requestJson<T>(path: string, options: RequestInit, refreshOnUnauthorized: boolean): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await apiFetch(path, { ...options, headers });
  if (response.status === 401 && refreshOnUnauthorized && path !== "/auth/refresh" && (await refreshTokens())) {
    return requestJson<T>(path, options, false);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(payload.error?.message ?? "Une erreur est survenue.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Après une connexion réussie (cookies posés par la réponse). */
export function onSignedIn() {
  markSession();
}

/** Déconnexion : révoque la session côté serveur (ou toutes celles du compte) et efface les cookies. */
export async function signOut(everywhere = false) {
  try {
    await backendRequest<void>(everywhere ? "/auth/logout-all" : "/auth/logout", { method: "POST" });
  } catch {
    /* session déjà expirée ou révoquée : rien à révoquer */
  } finally {
    clearSession();
  }
}

export async function uploadProductImage(file: File, retry = true): Promise<{ url: string }> {
  const body = new FormData();
  body.append("image", file);
  const response = await apiFetch("/products/upload-image", { method: "POST", body });
  if (response.status === 401 && retry && (await refreshTokens())) {
    return uploadProductImage(file, false);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(payload.error?.message ?? "Échec de l'upload.");
  }
  return (await response.json()) as { url: string };
}

export const backendApiUrl = apiUrl;

/** Origine du backend (sans /api/v1) — sert les images uploadées sous /uploads. */
export const backendOrigin = new URL(apiUrl).origin;

/** Les images produits uploadées sont renvoyées en chemin relatif au backend. */
export function resolveMediaUrl(url: string) {
  return url.startsWith("/uploads/") ? `${backendOrigin}${url}` : url;
}

