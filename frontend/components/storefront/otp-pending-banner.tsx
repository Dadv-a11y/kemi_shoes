"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearOtpChallenge, readOtpChallenge, type OtpChallenge } from "@/lib/auth";

/**
 * Rappel non bloquant d'un code OTP en attente : le visiteur peut naviguer
 * librement (auparavant l'accueil le renvoyait de force vers la vérification
 * pendant toute la validité du code), reprendre la saisie ou ignorer le rappel.
 */
export function OtpPendingBanner() {
  const pathname = usePathname();
  const locale = pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);

  useEffect(() => {
    // Relu à chaque navigation ; masqué automatiquement à l'expiration du code.
    const load = window.setTimeout(() => {
      const current = readOtpChallenge();
      setChallenge(current && current.expiresAt > Date.now() ? current : null);
    }, 0);
    const expiry = window.setInterval(() => setChallenge((current) => (current && current.expiresAt <= Date.now() ? null : current)), 1000);
    return () => {
      window.clearTimeout(load);
      window.clearInterval(expiry);
    };
  }, [pathname]);

  const onAuthPage = /\/compte\/(verification|connexion)$/.test(pathname);
  if (!challenge || onAuthPage) return null;

  const dismiss = () => {
    clearOtpChallenge();
    setChallenge(null);
  };

  return (
    <div className="otp-pending-banner" role="status">
      <span>{locale === "en" ? "A verification code is waiting for you." : "Un code de vérification vous attend."}</span>
      <Link href={`/${locale}/compte/verification`}>{locale === "en" ? "Enter the code" : "Saisir le code"}</Link>
      <button type="button" onClick={dismiss}>{locale === "en" ? "Dismiss" : "Ignorer"}</button>
    </div>
  );
}
