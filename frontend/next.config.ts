import type { NextConfig } from "next";

// Origine du backend (ex. https://api-kemishoes.example.com) : les images
// produits uploadées sont servies par le backend sous /uploads.
const backendOrigin = new URL(
  process.env.NEXT_PUBLIC_BACKEND_API_URL ?? process.env.BACKEND_API_URL ?? "http://localhost:4000/api/v1",
);

const nextConfig: NextConfig = {
  // Build autonome : .next/standalone contient server.js + les node_modules
  // strictement nécessaires (voir scripts/standalone.mjs et DEPLOIEMENT.md).
 
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
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
};

export default nextConfig;
