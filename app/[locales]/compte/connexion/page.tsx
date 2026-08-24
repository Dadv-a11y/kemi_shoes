import { AuthView } from "@/components/storefront/auth-view";
import { getI18n } from "@/locales/server";

export default async function LoginPage({ params }: { params: Promise<{ locales: string }> }) {
  const { locales } = await params;
  const locale = locales === "en" ? "en" : "fr";
  const t = await getI18n();
  const keys = ["login", "signup", "intro", "google", "facebook", "or", "name", "namePlaceholder", "phone", "countryCode", "phonePlaceholder", "receiveCode", "emailToggle", "email", "emailPlaceholder", "password", "passwordPlaceholder", "continue", "fineprint", "terms", "and", "privacy", "guest", "continueGuest", "required"] as const;
  const labels = Object.fromEntries(keys.map((key) => [key, t(`auth.${key}`)]));
  return <AuthView locale={locale} labels={labels} />;
}