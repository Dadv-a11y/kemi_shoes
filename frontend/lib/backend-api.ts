const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? process.env.BACKEND_API_URL ?? "http://localhost:4000/api/v1";

export type ApiError = { error?: { code?: string; message?: string } };

function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("kemi-access-token");
}

function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("kemi-refresh-token");
}

export function saveSession(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("kemi-access-token", accessToken);
  window.localStorage.setItem("kemi-refresh-token", refreshToken);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("kemi-access-token");
  window.localStorage.removeItem("kemi-refresh-token");
}

export async function backendRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestJson<T>(path, options, true);
}

async function requestJson<T>(path: string, options: RequestInit, refreshOnUnauthorized: boolean): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers });
  if (response.status === 401 && refreshOnUnauthorized && getRefreshToken()) {
    try {
      const refreshed = await fetch(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: getRefreshToken() }),
      });
      if (refreshed.ok) {
        const session = (await refreshed.json()) as { accessToken: string; refreshToken: string };
        saveSession(session.accessToken, session.refreshToken);
        return requestJson<T>(path, options, false);
      }
    } catch {
      clearSession();
    }
    clearSession();
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(payload.error?.message ?? "Une erreur est survenue.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function uploadProductImage(file: File): Promise<{ url: string }> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const body = new FormData();
  body.append("image", file);
  const response = await fetch(`${apiUrl}/products/upload-image`, { method: "POST", headers, body });
  if (response.status === 401 && getRefreshToken()) {
    await requestJson<unknown>("/auth/me", { method: "GET" }, true);
    return uploadProductImage(file);
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

export function hasSession() {
  return Boolean(getToken() || getRefreshToken());
}
