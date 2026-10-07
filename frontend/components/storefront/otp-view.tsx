"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearOtpChallenge, createOtpChallenge, maskEmail, maskPhone, readOtpChallenge, type OtpChallenge } from "@/lib/auth";
import { backendRequest, onSignedIn } from "@/lib/backend-api";
import { AuthAside } from "@/components/storefront/auth-aside";

export function OtpView({ labels }: { labels: Record<string, string> }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const loadChallenge = window.setTimeout(() => setChallenge(readOtpChallenge()), 0);
    return () => window.clearTimeout(loadChallenge);
  }, []);

  // Compte à rebours jusqu'à l'échéance du code (fixée par le serveur).
  useEffect(() => {
    if (!challenge) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((challenge.expiresAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  // Un nouveau code ne peut être demandé qu'une fois le précédent expiré.
  const resend = async () => {
    if (!challenge || sending) return;
    setSending(true);
    setError("");
    try {
      const byEmail = challenge.channel === "email";
      const { expiresAt } = await backendRequest<{ expiresAt: string }>(byEmail ? "/auth/email/resend" : "/auth/otp/request", { method: "POST", body: JSON.stringify(byEmail ? { email: challenge.phone } : { phone: challenge.phone }) });
      setChallenge(createOtpChallenge(challenge.phone, challenge.mode, challenge.name, expiresAt, challenge.channel));
      setCode("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6 || !challenge || remaining === 0) return;
    try {
      const { user } = await backendRequest<{ user: { role: string } }>(challenge.channel === "email" ? "/auth/email/verify" : "/auth/otp/verify", { method: "POST", body: JSON.stringify(challenge.channel === "email" ? { email: challenge.phone, code } : { phone: challenge.phone, code, name: challenge.name }) });
      onSignedIn();
      if (user.role === "DEV") {
        clearOtpChallenge();
        router.push(`/${locale}/supervision`);
        return;
      }
      clearOtpChallenge();
      router.push(`/${locale}/boutique`);
    } catch (verifyError) {
      setCode("");
      setError(verifyError instanceof Error ? verifyError.message : "");
    }
  };

  // Saisie fluide : passage automatique à la case suivante, retour arrière et collage du code complet.
  const typeDigits = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return setCode(code.slice(0, index) + code.slice(index + 1));
    setCode((code.slice(0, index) + digits + code.slice(index + 1)).slice(0, 6));
    boxes.current[Math.min(index + digits.length, 5)]?.focus();
  };

  const countdown = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  const expired = !challenge || remaining === 0;
  return <main className="auth-page"><div className="auth-split"><AuthAside text="" /><div className="auth-wrap"><div className="auth-card otp-card">
    <Link className="otp-back" href={`/${locale}/compte/connexion`}>← {labels.back}</Link><h1>{labels.verification}</h1>
    {expired ? <><p className="otp-expired">{labels.expired}</p><button className="auth-primary" onClick={resend} disabled={!challenge || sending}>{labels.resend}</button>{error && <span className="auth-error">{error}</span>}</> : <><p className="otp-message">{labels.sentTo} <strong>{challenge.channel === "email" ? maskEmail(challenge.phone) : maskPhone(challenge.phone)}</strong> <Link href={`/${locale}/compte/connexion`}>{labels.edit}</Link></p><div className="otp-boxes" onPaste={(event) => { event.preventDefault(); setCode(event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); boxes.current[5]?.focus(); }}>{Array.from({ length: 6 }, (_, index) => <input key={index} ref={(node) => { boxes.current[index] = node; }} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={6} value={code[index] ?? ""} aria-label={`${labels.code} ${index + 1}`} onChange={(event) => typeDigits(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Backspace" && !code[index] && index > 0) boxes.current[index - 1]?.focus(); if (event.key === "Enter") void verify(); }} />)}</div><p className="otp-timer">{labels.resendIn} <strong>{countdown}</strong></p><button className="auth-primary" disabled={code.length !== 6} onClick={verify}>{labels.verify}</button>{error && <span className="auth-error">{error}</span>}</>}
  </div></div></div></main>;
}