export const OTP_COOKIE = "kemi-otp-challenge";
export const SESSION_COOKIE = "kemi-session";
// Repli si le backend ne renvoie pas d'échéance (OTP_TTL_MINUTES côté API, 5 min par défaut).
export const OTP_VALIDITY_SECONDS = 5 * 60;
export const SESSION_VALIDITY_SECONDS = 60 * 60 * 24 * 30;

export type OtpChallenge = {
  token: string;
  expiresAt: number;
  phone: string;
  mode: "login" | "signup";
  name?: string;
};

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  return document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

export function readOtpChallenge(): OtpChallenge | null {
  const value = readCookie(OTP_COOKIE);
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as OtpChallenge;
  } catch {
    return null;
  }
}

/** expiresAt : échéance du code renvoyée par POST /auth/otp/request (ISO). */
export function createOtpChallenge(phone: string, mode: OtpChallenge["mode"], name?: string, expiresAt?: string) {
  const serverExpiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const challenge: OtpChallenge = {
    token: crypto.randomUUID(),
    expiresAt: Number.isFinite(serverExpiry) ? serverExpiry : Date.now() + OTP_VALIDITY_SECONDS * 1000,
    phone,
    mode,
    ...(name ? { name } : {}),
  };
  document.cookie = `${OTP_COOKIE}=${encodeURIComponent(JSON.stringify(challenge))}; path=/; max-age=${Math.max(1, Math.ceil((challenge.expiresAt - Date.now()) / 1000))}; samesite=lax`;
  return challenge;
}

export function clearOtpChallenge() {
  document.cookie = `${OTP_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

function encodeBase64Url(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createSessionToken(phone?: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_VALIDITY_SECONDS;
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({ sub: phone ?? "guest", iat: Math.floor(Date.now() / 1000), exp: expiresAt, jti: crypto.randomUUID() }));
  const signature = encodeBase64Url(crypto.randomUUID());
  const token = `${header}.${payload}.${signature}`;
  document.cookie = `${SESSION_COOKIE}=${token}; path=/; max-age=${SESSION_VALIDITY_SECONDS}; samesite=lax`;
  return token;
}

export function clearSession() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 4 ? `+237 ${digits.slice(0, 1)}XX XXX XX${digits.slice(-2)}` : phone;
}