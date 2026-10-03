"use client";

import Link from "next/link";
import { Bell, Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CartBadge } from "@/components/cart/cart-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { backendRequest } from "@/lib/backend-api";

type Notification = {
  id: string;
  title: string;
  message: string;
  metadata?: string | Record<string, string>;
  readAt?: string | null;
};

export function SiteHeader() {
  const pathname = usePathname();
  const locale = pathname.split("/").filter(Boolean)[0] === "en" ? "en" : "fr";
  const localized = (path: string) => `/${locale}${path}`;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [storePhone, setStorePhone] = useState("");
  useEffect(() => {
    backendRequest<{ phone?: string }>("/settings")
      .then((settings) => setStorePhone(settings.phone ?? ""))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    backendRequest<Notification[]>("/notifications")
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);
  const openNotification = async (notification: Notification) => {
    let metadata: Record<string, string> | undefined;
    try {
      metadata =
        typeof notification.metadata === "string"
          ? (JSON.parse(notification.metadata) as Record<string, string>)
          : notification.metadata;
    } catch {
      metadata = undefined;
    }
    if (metadata?.reviewUrl)
      window.location.href = metadata.reviewUrl.includes("?")
        ? `${metadata.reviewUrl}&review=1`
        : `${metadata.reviewUrl}?review=1`;
    await backendRequest<void>(`/notifications/${notification.id}/read`, {
      method: "PATCH",
    }).catch(() => undefined);
  };

  return (
    <>
      <div className="announcement">
        Livraison à Douala et partout au Cameroun · Paiement à la livraison
        disponible{storePhone ? ` · ${storePhone}` : ""}
      </div>
      <header className="site-header">
        <Link
          href={localized("/")}
          className="logo"
          aria-label="KEMI SHOES, accueil"
        >
          KEMI <span>SHOES</span>
        </Link>
        <nav className="main-nav" aria-label="Navigation principale">
          <Link
            href={localized("/")}
            className={pathname === `/${locale}` ? "active" : ""}
          >
            Home
          </Link>
          <Link href={localized("/boutique?categorie=homme")}>Homme</Link>
          <Link href={localized("/boutique?categorie=femme")}>Femme</Link>
          <Link href={localized("/boutique?categorie=nouveautes")}>
            Nouveautés
          </Link>
          <Link href={localized("/notre-histoire")}>Notre histoire</Link>
        </nav>
        <div className="header-actions">
          <Link
            href={localized("/boutique")}
            className="search-link"
            aria-label="Rechercher"
          >
            <Search aria-hidden="true" />
          </Link>
          <Link
            href={localized("/compte/connexion")}
            className="account-link"
            aria-label="Mon compte"
          >
            <UserRound aria-hidden="true" />
          </Link>
          {notifications.length > 0 && (
            <div className="notification-menu">
              <button
                type="button"
                className="notification-button"
                aria-label="Notifications"
              >
                <Bell aria-hidden="true" />
                <span>{notifications.length}</span>
              </button>
              <div className="notification-list">
                {notifications.map((notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    className="notification-item"
                    onClick={() => openNotification(notification)}
                  >
                    <strong>{notification.title}</strong>
                    <small>{notification.message}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <CartBadge>
            <ShoppingBag aria-hidden="true" />
          </CartBadge>
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="mobile-menu"
                  aria-label="Ouvrir le menu"
                />
              }
            >
              <Menu aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="left" className="mobile-nav-sheet">
              <SheetHeader className="mobile-nav-header">
                <SheetTitle className="logo">
                  KEMI <span>SHOES</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="mobile-nav" aria-label="Navigation mobile">
                <Link href={localized("/")}>Home</Link>
                <Link href={localized("/boutique?categorie=homme")}>Homme</Link>
                <Link href={localized("/boutique?categorie=femme")}>Femme</Link>
                <Link href={localized("/boutique?categorie=nouveautes")}>
                  Nouveautés
                </Link>
                <Link href={localized("/notre-histoire")}>Notre histoire</Link>
              </nav>
              <div className="mobile-nav-footer">
                <Link href={localized("/compte/connexion")}>
                  <UserRound aria-hidden="true" /> Mon compte
                </Link>
                <Link href={localized("/panier")}>
                  <ShoppingBag aria-hidden="true" /> Mon panier
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </>
  );
}
