// Codes HTTP des URL de la boutique : les éléments inconnus doivent répondre 404 (et non un 200 « soft 404 »),
// les anciens liens /boutique?categorie=… une redirection permanente.
//
//   node audit/http-status-check.mjs [http://localhost:3000] [http://localhost:4000/api/v1]
const FRONT = process.argv[2] ?? 'http://localhost:3000';
const API = process.argv[3] ?? 'http://localhost:4000/api/v1';

const categories = (await (await fetch(`${API}/categories`)).json()).items.map((item) => item.slug);
const collections = (await (await fetch(`${API}/collections`)).json()).items.map((item) => item.slug);
const product = (await (await fetch(`${API}/products?status=active&pageSize=1`)).json()).items[0];

const cases = [
  ['/fr', 200], ['/fr/boutique', 200], ['/en/boutique', 200],
  ...categories.map((slug) => [`/fr/boutique/${slug}`, 200]),
  ...collections.slice(0, 2).map((slug) => [`/fr/collections/${slug}`, 200]),
  [`/fr/produits/${product.slugFr}`, 200], [`/en/produits/${product.slugEn}`, 200],
  ['/fr/boutique/categorie-inconnue', 404], ['/en/boutique/unknown-category', 404],
  ['/fr/collections/collection-inconnue', 404], ['/fr/produits/produit-inconnu', 404], ['/en/produits/unknown-product', 404],
  ['/fr/route-inconnue', 404],
  ['/fr/boutique?categorie=femme', 308],
];

let failed = 0;
for (const [path, expected] of cases) {
  const response = await fetch(`${FRONT}${path}`, { redirect: 'manual' });
  const ok = response.status === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✖'} ${String(response.status).padEnd(4)} (attendu ${expected})  ${path}${response.status === 308 ? ` → ${response.headers.get('location')}` : ''}`);
}
console.log(`\n${cases.length - failed}/${cases.length} codes HTTP conformes`);
process.exit(failed ? 1 : 0);
