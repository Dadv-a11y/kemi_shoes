"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // /admin (sans locale) existe aussi : il ne doit pas hériter de l'en-tête boutique.
  const isAdmin = /^\/((fr|en)\/)?admin(\/|$)/.test(pathname);

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}