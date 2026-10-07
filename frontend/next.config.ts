import type { NextConfig } from "next";

// Origine du backend (ex. https://api-kemishoes.example.com) : les images
// produits uploadées sont servies par le backend sous /uploads.
const backendOrigin = new URL(
  process.env.NEXT_PUBLIC_BACKEND_API_URL ?? process.env.BACKEND_API_URL ?? "http://localhost:4000/api/v1",
);

const nextConfig: NextConfig = {
  // app/global-not-found.tsx : 404 réelle pour les URL sans route (voir ce fichier).
  experimental: { globalNotFound: true },
  // Build autonome : .next/standalone contient server.js + les node_modules
  // strictement nécessaires (voir scripts/standalone.mjs et DEPLOIEMENT.md).
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: backendOrigin.protocol.replace(":", "") as "http" | "https",
        hostname: backendOrigin.hostname,
        port: backendOrigin.port,
        pathname: "/uploads/**",
      },
    ],
    // En local le backend tourne sur localhost : l'optimiseur d'images refuse
    // par défaut les IP privées.
    // ALLOW_LOCAL_IMAGES=true permet de tester un build de production en local
    // (`next start` avec le backend sur localhost).
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_IMAGES === "true",
  },
};

export default nextConfig;
