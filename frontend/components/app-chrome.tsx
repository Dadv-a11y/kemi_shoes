"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { OtpPendingBanner } from "@/components/storefront/otp-pending-banner";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // /admin (sans locale) existe aussi : il ne doit pas hériter de l'en-tête boutique.
  // Back-office et supervision (équipe technique) : sans en-tête ni pied de page boutique.
  const isAdmin = /^\/((fr|en)\/)?(admin|supervision)(\/|$)/.test(pathname);

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <SiteHeader />
      <OtpPendingBanner />
      {children}
      <SiteFooter />
    </>
  );
}