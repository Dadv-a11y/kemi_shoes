"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createOtpChallenge, maskPhone, readOtpChallenge, type OtpChallenge } from "@/lib/auth";

export function OtpView({ labels }: { labels: Record<string, string> }) {
  const pathname = usePathname();
  const locale = pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [code, setCode] = useState("");

  useEffect(() => {
    const loadChallenge = window.setTimeout(() => {
      const current = readOtpChallenge();
      setChallenge(current);
      if (!current) return;
      const tick = () => setRemaining(Math.max(0, Math.ceil((current.expiresAt - Date.now()) / 1000)));
      tick();
      const timer = window.setInterval(tick, 1000);
      window.setTimeout(() => window.clearInterval(timer), Math.max(0, current.expiresAt - Date.now()));
    }, 0);
    return () => window.clearTimeout(loadChallenge);
  }, []);

  const resend = () => {
    if (!challenge) return;
    const next = createOtpChallenge(challenge.phone, challenge.mode, challenge.name);
    setChallenge(next);
    setRemaining(Math.ceil((next.expiresAt - Date.now()) / 1000));
    setCode("");
  };

  const expired = !challenge || remaining === 0;
  return <main className="auth-page"><div className="auth-wrap"><div className="auth-card otp-card">
    <Link className="otp-back" href={`/${locale}/compte/connexion`}>← {labels.back}</Link><h1>{labels.verification}</h1>
    {expired ? <><p className="otp-expired">{labels.expired}</p><button className="auth-primary" onClick={resend} disabled={!challenge}>{labels.resend}</button></> : <><p className="otp-message">{labels.sentTo} <strong>{maskPhone(challenge.phone)}</strong> <Link href={`/${locale}/compte/connexion`}>{labels.edit}</Link></p><div className="otp-boxes">{Array.from({ length: 6 }, (_, index) => <input key={index} maxLength={1} value={code[index] ?? ""} aria-label={`${labels.code} ${index + 1}`} onChange={(event) => setCode(code.slice(0, index) + event.target.value.replace(/\D/g, "").slice(-1) + code.slice(index + 1))} />)}</div><p className="otp-timer">{labels.resendIn} <strong>00:{String(remaining).padStart(2, "0")}</strong></p><button className="auth-primary" disabled={code.length !== 6}>{labels.verify}</button><button className="auth-link" onClick={resend}>{labels.resend}</button></>}
  </div></div></main>;
}