"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname === "/fr/admin" || pathname.startsWith("/fr/admin/") || pathname === "/en/admin" || pathname.startsWith("/en/admin/");

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}