"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearOtpChallenge, createOtpChallenge, maskPhone, readOtpChallenge, type OtpChallenge } from "@/lib/auth";
import { backendRequest, saveSession } from "@/lib/backend-api";

export function OtpView({ labels }: { labels: Record<string, string> }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

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
      const { expiresAt } = await backendRequest<{ expiresAt: string }>("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone: challenge.phone }) });
      setChallenge(createOtpChallenge(challenge.phone, challenge.mode, challenge.name, expiresAt));
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
      const result = await backendRequest<{ accessToken: string; refreshToken: string }>("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone: challenge.phone, code, name: challenge.name }) });
      saveSession(result.accessToken, result.refreshToken);
      clearOtpChallenge();
      router.push(`/${locale}/boutique`);
    } catch (verifyError) {
      setCode("");
      setError(verifyError instanceof Error ? verifyError.message : "");
    }
  };

  const countdown = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  const expired = !challenge || remaining === 0;
  return <main className="auth-page"><div className="auth-wrap"><div className="auth-card otp-card">
    <Link className="otp-back" href={`/${locale}/compte/connexion`}>← {labels.back}</Link><h1>{labels.verification}</h1>
    {expired ? <><p className="otp-expired">{labels.expired}</p><button className="auth-primary" onClick={resend} disabled={!challenge || sending}>{labels.resend}</button>{error && <span className="auth-error">{error}</span>}</> : <><p className="otp-message">{labels.sentTo} <strong>{maskPhone(challenge.phone)}</strong> <Link href={`/${locale}/compte/connexion`}>{labels.edit}</Link></p><div className="otp-boxes">{Array.from({ length: 6 }, (_, index) => <input key={index} maxLength={1} value={code[index] ?? ""} aria-label={`${labels.code} ${index + 1}`} onChange={(event) => setCode(code.slice(0, index) + event.target.value.replace(/\D/g, "").slice(-1) + code.slice(index + 1))} />)}</div><p className="otp-timer">{labels.resendIn} <strong>{countdown}</strong></p><button className="auth-primary" disabled={code.length !== 6} onClick={verify}>{labels.verify}</button>{error && <span className="auth-error">{error}</span>}</>}
  </div></div></main>;
}