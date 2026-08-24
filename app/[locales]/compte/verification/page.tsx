import { OtpView } from "@/components/storefront/otp-view";
import { getI18n } from "@/locales/server";

export default async function VerificationPage() {
  const t = await getI18n();
  const keys = ["back", "verification", "expired", "resend", "sentTo", "edit", "code", "resendIn", "verify"] as const;
  const labels = Object.fromEntries(keys.map((key) => [key, t(`auth.${key}`)]));
  return <OtpView labels={labels} />;
}