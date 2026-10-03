"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createOtpChallenge } from "@/lib/auth";
import { backendApiUrl, backendRequest, saveSession } from "@/lib/backend-api";

type Labels = Record<string, string>;

export function AuthView({ locale, labels }: { locale: "fr" | "en"; labels: Labels }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [countryCode, setCountryCode] = useState("+237");
  const [providers, setProviders] = useState({ google: false, facebook: false });

  useEffect(() => {
    backendRequest<{ google: boolean; facebook: boolean }>("/auth/providers").then(setProviders).catch(() => undefined);
    // Retour du callback OAuth backend : tokens transmis dans le fragment d'URL.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("accessToken");
    const refreshToken = fragment.get("refreshToken");
    if (accessToken && refreshToken) {
      saveSession(accessToken, refreshToken);
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(`/${locale}/compte`);
    } else if (fragment.get("error")) {
      window.setTimeout(() => setError(labels.oauthError), 0);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [labels.oauthError, locale, router]);

  // Le backend attend un numéro E.164 (+2376XXXXXXXX).
  const fullPhone = () => {
    const digits = phone.replace(/\D/g, "");
    return phone.trim().startsWith("+") ? `+${digits}` : `${countryCode}${digits.replace(/^0+/, "")}`;
  };

  const requestCode = async () => {
    if (mode === "signup" && !name.trim()) return setError(labels.required);
    if (!phone.trim()) return setError(labels.required);
    setError("");
    try {
      const e164 = fullPhone();
      await backendRequest("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone: e164 }) });
      createOtpChallenge(e164, mode, name.trim() || undefined);
      router.push(`/${locale}/compte/verification`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : labels.required);
    }
  };

  return <main className="auth-page"><div className="auth-wrap"><div className="auth-card">
    <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>{labels.login}</button><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>{labels.signup}</button></div>
    <p className="auth-intro">{labels.intro}</p>
    {providers.google && <a className="auth-oauth" href={`${backendApiUrl}/auth/oauth/google`}><span>G</span>{labels.google}</a>}{providers.facebook && <a className="auth-oauth" href={`${backendApiUrl}/auth/oauth/facebook`}><span>f</span>{labels.facebook}</a>}
    {(providers.google || providers.facebook) && <div className="auth-divider"><i />{labels.or}<i /></div>}
    {!emailOpen ? <>
      {mode === "signup" && <AuthField label={labels.name} value={name} placeholder={labels.namePlaceholder} onChange={setName} />}
      <div className="auth-field"><label>{labels.phone}</label><div className="auth-phone"><select aria-label={labels.countryCode} value={countryCode} onChange={(event) => setCountryCode(event.target.value)}><option>+237</option><option>+225</option><option>+33</option></select><input value={phone} placeholder={labels.phonePlaceholder} onChange={(event) => setPhone(event.target.value)} /></div>{error && <span className="auth-error">{error}</span>}</div>
      <button className="auth-primary" onClick={requestCode}>{labels.receiveCode}</button>
      <button className="auth-email-toggle" onClick={() => setEmailOpen(true)}>{labels.emailToggle}</button>
    </> : <div className="auth-email-fields"><AuthField label={labels.email} value={email} placeholder={labels.emailPlaceholder} onChange={setEmail} /><AuthField label={labels.password} value={password} placeholder={labels.passwordPlaceholder} onChange={setPassword} type="password" /><button className="auth-primary" onClick={async () => { try { const result = await backendRequest<{ accessToken: string; refreshToken: string }>(mode === "login" ? "/auth/login" : "/auth/register", { method: "POST", body: JSON.stringify(mode === "login" ? { email, password } : { name, email, password }) }); saveSession(result.accessToken, result.refreshToken); router.push(`/${locale}/compte`); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : labels.required); } }}>{labels.continue}</button><button className="auth-email-toggle" onClick={() => setEmailOpen(false)}>{labels.phone}</button>{error && <span className="auth-error">{error}</span>}</div>}
    <p className="auth-fineprint">{labels.fineprint} <Link href={`/${locale}/cgv`}>{labels.terms}</Link> {labels.and} <Link href={`/${locale}/confidentialite`}>{labels.privacy}</Link>.</p>
    <div className="auth-guest">{labels.guest} <Link href={`/${locale}/boutique`}>{labels.continueGuest}</Link></div>
  </div></div></main>;
}

function AuthField({ label, value, placeholder, onChange, type = "text" }: { label: string; value?: string; placeholder: string; onChange?: (value: string) => void; type?: string }) {
  return <div className="auth-field"><label>{label}</label><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} /></div>;
}