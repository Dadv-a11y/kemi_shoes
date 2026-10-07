// Peuple la base avec le catalogue de démarrage à partir de backend/images_demo.
//
//   npm run db:seed            # ajoute ce qui manque (idempotent)
//   npm run db:seed -- --force # met aussi à jour les produits déjà présents
//
// Chaque image du dossier est prise en compte, sans exception : les photos sont
// regroupées par modèle (`nom.jpg`, `nom_1.jpg`… = vues du même produit), copiées
// dans uploads/products puis rattachées au produit.
// Une image absente de seed-demo.data.js devient quand même un produit (brouillon,
// nom déduit du fichier) pour qu'aucune photo ne soit ignorée.
// Les visuels de marque (atelier, fondatrice, procédés) ne passent pas par ici :
// ce sont des fichiers statiques de frontend/public.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, closeDb, get } from '../src/db/client.js';
import { createProduct, updateProduct } from '../src/modules/products/products.service.js';
import { PRODUCTS } from './seed-demo.data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'images_demo');
const uploadDir = path.join(root, 'uploads', 'products');
const force = process.argv.includes('--force');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const nfc = (value) => value.normalize('NFC');
const products = Object.fromEntries(Object.entries(PRODUCTS).map(([key, value]) => [nfc(key), value]));

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function humanize(stem) {
  const text = stem.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Rattache un fichier à son modèle : nom exact, sinon nom sans suffixe de vue (_1, _2…). */
function resolveKey(stem) {
  if (products[stem]) return stem;
  const base = stem.replace(/_\d+$/, '');
  return base;
}

async function copyToUploads(file, targetName) {
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.copyFile(path.join(sourceDir, file), path.join(uploadDir, targetName));
  return `/uploads/products/${targetName}`;
}

async function main() {
  const files = (await fs.readdir(sourceDir))
    .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'fr'));
  if (!files.length) throw new Error(`Aucune image trouvée dans ${sourceDir}`);

  // Regroupement : { clé → [fichiers] }, la vue sans suffixe en premier (image principale).
  const groups = new Map();
  for (const file of files) {
    const stem = nfc(path.basename(file, path.extname(file)));
    const key = resolveKey(stem);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ file, stem });
  }
  for (const list of groups.values()) list.sort((a, b) => a.stem.length - b.stem.length || a.stem.localeCompare(b.stem));

  await openDb();
  const report = { created: [], updated: [], skipped: [], fallback: [] };
  let imageCount = 0;

  for (const [key, list] of groups) {
    const definition = products[key] ?? {
      nameFr: humanize(key), nameEn: humanize(key),
      descriptionFr: 'Modèle fait main à Douala par l’atelier KEMI SHOES.',
      descriptionEn: 'Handmade in Douala by the KEMI SHOES workshop.',
      category: 'Nouveautes', price: 25000, status: 'draft',
      colors: [{ name: 'Cognac', hex: '#92502F' }], sizes: ['37', '38', '39', '40', '41'],
    };
    if (!products[key]) report.fallback.push(key);

    const slugFr = slugify(definition.nameFr);
    const images = [];
    for (const [index, { file }] of list.entries()) {
      images.push({ url: await copyToUploads(file, `demo-${slugFr}-${index + 1}${path.extname(file).toLowerCase()}`), isMain: index === 0 });
    }
    imageCount += list.length;

    const payload = {
      slugFr,
      slugEn: slugify(definition.nameEn),
      nameFr: definition.nameFr,
      nameEn: definition.nameEn,
      descriptionFr: definition.descriptionFr,
      descriptionEn: definition.descriptionEn,
      category: definition.category,
      price: definition.price,
      status: definition.status ?? 'active',
      colorCustomizable: true,
      materialCustomizable: true,
      images,
      colors: definition.colors,
      sizes: definition.sizes.map((size) => ({ size, available: true })),
    };

    const existing = await get(`SELECT id FROM Product WHERE slugFr = ?`, [slugFr]);
    if (!existing) {
      await createProduct(payload);
      report.created.push(`${definition.nameFr} (${list.length} photo${list.length > 1 ? 's' : ''})`);
    } else if (force) {
      await updateProduct(existing.id, payload);
      report.updated.push(definition.nameFr);
    } else {
      report.skipped.push(definition.nameFr);
    }
  }

  if (imageCount !== files.length) throw new Error(`Incohérence : ${files.length} images trouvées, ${imageCount} traitées.`);

  console.log(`\n${files.length} images traitées depuis images_demo/`);
  console.log(`✔ Produits créés : ${report.created.length}`);
  report.created.forEach((line) => console.log(`   + ${line}`));
  if (report.updated.length) console.log(`↻ Produits mis à jour : ${report.updated.length}`);
  if (report.skipped.length) console.log(`• Déjà présents (relancer avec --force pour les mettre à jour) : ${report.skipped.length}`);
  if (report.fallback.length) {
    console.log(`⚠ ${report.fallback.length} image(s) sans fiche dans seed-demo.data.js, créées en brouillon :`);
    report.fallback.forEach((key) => console.log(`   ? ${key}`));
  }
}

try {
  await main();
} catch (error) {
  console.error('✖ Seed interrompu :', error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
