import { NextResponse, NextRequest } from "next/server";

import { createI18nMiddleware } from "next-international/middleware";

const I18nMiddleware = createI18nMiddleware({
  locales: ["fr", "en"],
  defaultLocale: "fr",
});

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = pathname.split("/").filter(Boolean)[0];
  const sessionCookie = request.cookies.get("kemi-session")?.value;
  const challengeCookie = request.cookies.get("kemi-otp-challenge")?.value;

  if ((locale === "fr" || locale === "en") && pathname === `/${locale}`) {
    try {
      if (sessionCookie) {
        const payloadPart = sessionCookie.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
        if (payloadPart) {
          const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payloadPart), (character) => character.charCodeAt(0)))) as { exp?: number };
          if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
            return NextResponse.redirect(new URL(`/${locale}/boutique`, request.url));
          }
        }
      }

      if (challengeCookie) {
        const challenge = JSON.parse(decodeURIComponent(challengeCookie)) as { expiresAt?: number };
        if (challenge.expiresAt && challenge.expiresAt > Date.now()) {
          return NextResponse.redirect(new URL(`/${locale}/compte/verification`, request.url));
        }
      }
    } catch {
      return I18nMiddleware(request);
    }
  }

  return I18nMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|static|.*\\..*|_next|favicon.ico|robots.txt).*)"],
};
