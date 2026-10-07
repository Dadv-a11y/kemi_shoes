// Convertit en WebP les images produits déjà uploadées (jpg/png) et met à jour la base.
// Usage : npm run images:to-webp            (ajouter -- --dry-run pour simuler)
import fs from 'node:fs';
import path from 'node:path';
import { openDb, closeDb, all, run } from '../src/db/client.js';
import { convertToWebp } from '../src/modules/products/image.convert.js';

const dryRun = process.argv.includes('--dry-run');
const dir = path.join(process.cwd(), 'uploads', 'products');
const PREFIX = '/uploads/products/';

try {
  await openDb();
  const rows = await all(`SELECT id, url FROM ProductImage WHERE url LIKE '%/uploads/products/%.jpg' OR url LIKE '%/uploads/products/%.jpeg' OR url LIKE '%/uploads/products/%.png'`);
  let converted = 0;
  for (const { id, url } of rows) {
    const name = url.slice(url.indexOf(PREFIX) + PREFIX.length);
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) { console.log(`· absent : ${name}`); continue; }
    if (dryRun) { console.log(`→ ${name} serait converti`); continue; }
    const out = await convertToWebp(file);
    if (out === name) { console.log(`✖ échec : ${name} (sharp disponible ?)`); continue; }
    await run(`UPDATE ProductImage SET url = ? WHERE id = ?`, [url.replace(name, out), id]);
    converted += 1;
    console.log(`✔ ${name} → ${out}`);
  }
  console.log(dryRun ? `${rows.length} image(s) à convertir.` : `${converted}/${rows.length} image(s) converties.`);
} finally {
  await closeDb();
}
