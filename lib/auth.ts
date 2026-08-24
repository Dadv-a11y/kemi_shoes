export const OTP_COOKIE = "kemi-otp-challenge";
export const OTP_VALIDITY_SECONDS = 45;

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

export function createOtpChallenge(phone: string, mode: OtpChallenge["mode"], name?: string) {
  const challenge: OtpChallenge = {
    token: crypto.randomUUID(),
    expiresAt: Date.now() + OTP_VALIDITY_SECONDS * 1000,
    phone,
    mode,
    ...(name ? { name } : {}),
  };
  document.cookie = `${OTP_COOKIE}=${encodeURIComponent(JSON.stringify(challenge))}; path=/; max-age=${OTP_VALIDITY_SECONDS}; samesite=lax`;
  return challenge;
}

export function clearOtpChallenge() {
  document.cookie = `${OTP_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 4 ? `+237 ${digits.slice(0, 1)}XX XXX XX${digits.slice(-2)}` : phone;
}