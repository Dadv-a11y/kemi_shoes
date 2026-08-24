"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createOtpChallenge } from "@/lib/auth";

type Labels = Record<string, string>;

export function AuthView({ locale, labels }: { locale: "fr" | "en"; labels: Labels }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [error, setError] = useState("");

  const requestCode = () => {
    if (mode === "signup" && !name.trim()) return setError(labels.required);
    if (!phone.trim()) return setError(labels.required);
    setError("");
    createOtpChallenge(phone, mode, name.trim() || undefined);
    router.push(`/${locale}/compte/verification`);
  };

  return <main className="auth-page"><div className="auth-wrap"><div className="auth-card">
    <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>{labels.login}</button><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>{labels.signup}</button></div>
    <p className="auth-intro">{labels.intro}</p>
    <button className="auth-oauth"><span>G</span>{labels.google}</button><button className="auth-oauth"><span>f</span>{labels.facebook}</button>
    <div className="auth-divider"><i />{labels.or}<i /></div>
    {!emailOpen ? <>
      {mode === "signup" && <AuthField label={labels.name} value={name} placeholder={labels.namePlaceholder} onChange={setName} />}
      <div className="auth-field"><label>{labels.phone}</label><div className="auth-phone"><select aria-label={labels.countryCode}><option>+237</option><option>+225</option><option>+33</option></select><input value={phone} placeholder={labels.phonePlaceholder} onChange={(event) => setPhone(event.target.value)} /></div>{error && <span className="auth-error">{error}</span>}</div>
      <button className="auth-primary" onClick={requestCode}>{labels.receiveCode}</button>
      <button className="auth-email-toggle" onClick={() => setEmailOpen(true)}>{labels.emailToggle}</button>
    </> : <div className="auth-email-fields"><AuthField label={labels.email} placeholder={labels.emailPlaceholder} /><AuthField label={labels.password} placeholder={labels.passwordPlaceholder} type="password" /><button className="auth-primary">{labels.continue}</button><button className="auth-email-toggle" onClick={() => setEmailOpen(false)}>{labels.phone}</button></div>}
    <p className="auth-fineprint">{labels.fineprint} <Link href={`/${locale}/cgv`}>{labels.terms}</Link> {labels.and} <Link href={`/${locale}/confidentialite`}>{labels.privacy}</Link>.</p>
    <div className="auth-guest">{labels.guest} <Link href={`/${locale}/boutique`}>{labels.continueGuest}</Link></div>
  </div></div></main>;
}

function AuthField({ label, value, placeholder, onChange, type = "text" }: { label: string; value?: string; placeholder: string; onChange?: (value: string) => void; type?: string }) {
  return <div className="auth-field"><label>{label}</label><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} /></div>;
}