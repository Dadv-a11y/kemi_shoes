// Complète le build `output: "standalone"` : Next.js ne copie ni public/ ni
// .next/static/ dans .next/standalone (ils sont censés être servis par un CDN).
// Ici, server.js les sert directement : le dossier .next/standalone devient
// déployable tel quel (`node server.js`).
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("✖ .next/standalone/server.js introuvable — lancez d'abord `next build` avec output: \"standalone\".");
  process.exit(1);
}

cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

cpSync(path.join(root, "scripts", "passenger-app.cjs"), path.join(standalone, "app.cjs"));

console.log("✔ Build standalone prêt : .next/standalone (démarrage : node server.js)");
