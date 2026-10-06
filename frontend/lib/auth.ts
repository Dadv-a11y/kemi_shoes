export const OTP_COOKIE = "kemi-otp-challenge";
// Repli si le backend ne renvoie pas d'échéance (OTP_TTL_MINUTES côté API, 5 min par défaut).
export const OTP_VALIDITY_SECONDS = 5 * 60;

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

/** +237690123448 → « +237 6XX XXX X48 » : indicatif conservé (l'ancienne version prenait le « 2 » de 237 pour le premier chiffre). */
export function maskPhone(phone: string) {
  const match = phone.match(/^(\+\d{3})(\d)(\d+)(\d{2})$/);
  if (!match) return phone;
  const [, country, first, middle, last] = match;
  const hidden = `${first}${"X".repeat(middle.length)}${last}`.replace(/^(.{3})(.{3})/, "$1 $2 ");
  return `${country} ${hidden}`;
}