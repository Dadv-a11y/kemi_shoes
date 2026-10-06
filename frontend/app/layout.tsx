import type { Metadata } from "next";
import { Archivo, Fraunces } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppChrome } from "@/components/app-chrome";
import { ClientErrorReporter } from "@/components/monitoring/client-error-reporter";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "KEMI SHOES | Sandales en cuir faites main à Douala",
  description: "Sandales en cuir haut de gamme, faites main à Douala.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${archivo.variable} ${fraunces.variable} h-full antialiased`}>
      <head><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" /></head>
      <body className="min-h-full">
        <ClientErrorReporter />
        <TooltipProvider>
          <AppChrome>{children}</AppChrome>
        </TooltipProvider>
      </body>
    </html>
  );
}
