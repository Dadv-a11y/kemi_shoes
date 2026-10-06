import type { NextRequest } from "next/server";

import { createI18nMiddleware } from "next-international/middleware";

const I18nMiddleware = createI18nMiddleware({
  locales: ["fr", "en"],
  defaultLocale: "fr",
});

// Plus de redirection forcée vers la vérification OTP : un bandeau non bloquant
// (components/storefront/otp-pending-banner.tsx) propose de reprendre la saisie.
export function proxy(request: NextRequest) {
  return I18nMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|static|.*\\..*|_next|favicon.ico|robots.txt).*)"],
};
