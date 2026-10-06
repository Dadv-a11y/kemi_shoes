import { SupervisionDashboard } from "@/components/supervision/supervision-dashboard";

export const metadata = {
  title: "KEMI SHOES | Supervision",
  description: "Logs, santé du serveur et journal d'audit (équipe technique).",
  robots: { index: false, follow: false },
};

export default function SupervisionPage() {
  return <SupervisionDashboard />;
}
