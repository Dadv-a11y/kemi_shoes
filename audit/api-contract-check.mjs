// Vérifie chaque route du backend avec les payloads réellement envoyés par le
// frontend boutique et le back-office, ainsi que les contrôles d'accès (RBAC).
//
//   node audit/api-contract-check.mjs [http://localhost:4000/api/v1]
//
// Prérequis : backend démarré, base seedée (npm run db:seed), comptes
//   admin@test.local / Admin12345 (rôle ADMIN) et client@test.local / Client12345.
const API = process.argv[2] ?? process.env.API_URL ?? 'http://localhost:4000/api/v1';
const results = [];
const hit = new Set();

// Les sessions sont des cookies HttpOnly : `token` est l'en-tête Cookie d'un
// navigateur connecté (kemi_at=…; kemi_rt=…), extrait des Set-Cookie de la connexion.
async function call(method, path, { token, body, expect, label, form, origin } = {}) {
  const headers = {};
  if (token) headers.Cookie = token;
  if (origin) headers.Origin = origin;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const response = await fetch(`${API}${path}`, { method, headers, body: payload, redirect: 'manual' });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  const expected = [].concat(expect ?? [200]);
  const ok = expected.includes(response.status);
  results.push({ ok, method, path, status: response.status, expected: expected.join('|'), label: label ?? '', detail: ok ? '' : JSON.stringify(data)?.slice(0, 200) });
  const setCookies = response.headers.getSetCookie?.() ?? [];
  return { status: response.status, data, setCookies, cookie: setCookies.map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ') };
}
const route = (key) => hit.add(key);

const login = async (email, password, label = 'login') => (await call('POST', '/auth/login', { body: { email, password }, label })).cookie;

const A = await login('admin@test.local', 'Admin12345'); route('POST /auth/login');
const C = await login('client@test.local', 'Client12345');
const adminId = (await call('GET', '/auth/me', { token: A, label: 'admin' })).data.user.id;

// --- auth ---
const email = `e2e-${Date.now()}@test.local`;
const reg = await call('POST', '/auth/register', { body: { name: 'E2E', email, password: 'E2e123456' }, expect: 201 }); route('POST /auth/register');
// Jetons uniquement en cookies HttpOnly, jamais dans le corps de la réponse.
const atCookie = reg.setCookies.find((c) => c.startsWith('kemi_at=')) ?? '';
const rtCookie = reg.setCookies.find((c) => c.startsWith('kemi_rt=')) ?? '';
results.push({ ok: /HttpOnly/i.test(atCookie) && /HttpOnly/i.test(rtCookie) && /Path=\/api\/v1\/auth/i.test(rtCookie) && !reg.data?.accessToken && !reg.data?.refreshToken,
  method: 'POST', path: '/auth/register', status: reg.status, expected: 'cookies HttpOnly, corps sans jeton', label: 'jetons en cookies', detail: JSON.stringify({ atCookie: atCookie.replace(/=[^;]+/, '=…'), rtCookie: rtCookie.replace(/=[^;]+/, '=…'), body: Object.keys(reg.data ?? {}) }) });
await call('POST', '/auth/register', { body: { name: 'E2E', email, password: 'E2e123456' }, expect: 409, label: 'email déjà utilisé' });
await call('POST', '/auth/login', { body: { email, password: 'mauvais' }, expect: 401, label: 'mauvais mot de passe' });
const otpPhone = `+2376${String(Date.now()).slice(-8)}`;
const otp1 = await call('POST', '/auth/otp/request', { body: { phone: otpPhone }, expect: [200, 202] }); route('POST /auth/otp/request');
const otp2 = await call('POST', '/auth/otp/request', { body: { phone: otpPhone }, label: 'code encore valable : pas de nouvel envoi' });
results.push({ ok: otp1.data?.resent === true && otp2.data?.resent === false && otp2.data?.expiresAt === otp1.data?.expiresAt, method: 'POST', path: '/auth/otp/request', status: otp2.status, expected: 'resent=false, même échéance', label: 'renvoi seulement après expiration', detail: JSON.stringify(otp2.data) });
await call('POST', '/auth/otp/verify', { body: { phone: '+237690000001', code: '000000' }, expect: [400, 401], label: 'code OTP faux' }); route('POST /auth/otp/verify');
const refreshed = await call('POST', '/auth/refresh', { token: reg.cookie }); route('POST /auth/refresh');
// Refresh tokens rotatifs : l'ancien est refusé (délai de grâce multi-onglets → REFRESH_SUPERSEDED).
const reused = await call('POST', '/auth/refresh', { token: reg.cookie, expect: 401, label: 'ancien refresh token refusé (rotation)' });
results.push({ ok: reused.data?.error?.code === 'REFRESH_SUPERSEDED', method: 'POST', path: '/auth/refresh', status: reused.status, expected: 'REFRESH_SUPERSEDED', label: 'rejeu immédiat reconnu (autre onglet)', detail: JSON.stringify(reused.data) });
let E = refreshed.cookie;

// CSRF : une requête avec cookie de session venant d'une origine non autorisée est refusée.
await call('PATCH', '/auth/me', { token: E, body: { name: 'E2E' }, origin: 'https://evil.example', expect: 403, label: 'CSRF : origine non autorisée' });
await call('PATCH', '/auth/me', { token: E, body: { name: 'E2E' }, origin: 'http://localhost:3000', label: 'origine du frontend autorisée' });

// Déconnexion : la session est révoquée côté serveur et les cookies effacés.
const temp = await login(email, 'E2e123456', 'seconde session');
const out = await call('POST', '/auth/logout', { token: temp, expect: 204 }); route('POST /auth/logout');
results.push({ ok: out.setCookies.some((c) => c.startsWith('kemi_at=;')), method: 'POST', path: '/auth/logout', status: out.status, expected: 'cookies effacés', label: 'Set-Cookie d’effacement', detail: JSON.stringify(out.setCookies) });
await call('GET', '/auth/me', { token: temp, expect: 401, label: 'access token après déconnexion' });
await call('POST', '/auth/refresh', { token: temp, expect: 401, label: 'refresh token après déconnexion' });
await call('GET', '/auth/me', { token: E, label: 'les autres sessions restent actives' });
const t1 = await login(email, 'E2e123456', 'appareil 1');
const t2 = await login(email, 'E2e123456', 'appareil 2');
await call('POST', '/auth/logout-all', { token: t1, expect: 204 }); route('POST /auth/logout-all');
await call('GET', '/auth/me', { token: t2, expect: 401, label: 'déconnecté de tous les appareils' });
E = await login(email, 'E2e123456', 'reconnexion');
await call('GET', '/auth/me', { token: C }); route('GET /auth/me');
await call('GET', '/auth/me', { expect: 401, label: 'sans token' });
await call('PATCH', '/auth/me', { token: C, body: { name: 'Cliente Test' } }); route('PATCH /auth/me');
const providers = await call('GET', '/auth/providers'); route('GET /auth/providers');
results.push({ ok: providers.data?.password === true && typeof providers.data?.phone === 'boolean', method: 'GET', path: '/auth/providers', status: providers.status, expected: 'password + phone (selon fournisseur SMS)', label: 'méthodes de connexion exposées', detail: JSON.stringify(providers.data) });
await call('GET', '/auth/oauth/google', { expect: [302, 404], label: 'OAuth (404 si non configuré)' }); route('GET /auth/oauth/google'); route('GET /auth/oauth/google/callback');
await call('GET', '/auth/oauth/facebook', { expect: [302, 404], label: 'OAuth (404 si non configuré)' }); route('GET /auth/oauth/facebook'); route('GET /auth/oauth/facebook/callback');
await call('GET', '/auth/oauth/failure', { expect: 401 }); route('GET /auth/oauth/failure');

// --- produits ---
const list = await call('GET', '/products?status=active&pageSize=100'); route('GET /products');
const product = list.data.items[0];
await call('GET', `/products/slug/${encodeURIComponent(product.slugFr)}?locale=fr`); route('GET /products/slug/:slug');
await call('GET', `/products/slug/${encodeURIComponent(product.slugEn)}?locale=en`, { label: 'slug EN' });
await call('GET', `/products/${product.id}`); route('GET /products/:id');
await call('GET', '/products/pas-un-uuid', { expect: 400 });
await call('POST', '/products', { token: C, body: {}, expect: 403, label: 'client interdit' });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), 'test.png');
const upload = await call('POST', '/products/upload-image', { token: A, form, expect: 201 }); route('POST /products/upload-image');
const created = await call('POST', '/products', { token: A, expect: 201, body: {
  nameFr: `Produit E2E ${Date.now()}`, nameEn: `E2E product ${Date.now()}`, descriptionFr: 'Desc', descriptionEn: 'Desc', category: 'Femme', price: 15000,
  status: 'active', colorCustomizable: false, materialCustomizable: false,
  images: [{ url: upload.data.url, isMain: true }], colors: [{ name: 'Couleur', hex: '#14120F' }],
  sizes: [{ size: '38', available: true }, { size: '39', available: true }],
} }); route('POST /products');
const P = created.data.id;
await call('PATCH', `/products/${P}`, { token: A, body: { price: 16000 } }); route('PATCH /products/:id');
// Le back-office renvoie le produit tel que lu (booléens, couleurs, tailles) : doit être accepté.
const read = (await call('GET', `/products/${product.id}`, { label: 'lecture admin' })).data;
await call('PATCH', `/products/${product.id}`, { token: A, label: 'aller-retour admin (produit tel que lu)', body: {
  nameFr: read.nameFr, nameEn: read.nameEn, descriptionFr: read.descriptionFr, descriptionEn: read.descriptionEn,
  category: read.category, price: read.price, status: read.status,
  colorCustomizable: read.colorCustomizable, materialCustomizable: read.materialCustomizable,
  images: read.images.map(({ url, isMain }) => ({ url, isMain })), colors: read.colors,
  sizes: read.sizes.map(({ size, available }) => ({ size, available })),
} });
await call('PATCH', `/products/${P}/sizes`, { token: A, body: { size: '39', available: false } }); route('PATCH /products/:id/sizes');
const media = await call('GET', '/media?category=brand'); route('GET /media');
const imgRes = await fetch(new URL(upload.data.url, API).toString());
results.push({ ok: imgRes.ok, method: 'GET', path: upload.data.url, status: imgRes.status, expected: '200', label: 'image uploadée servie', detail: '' });

// --- zones de livraison ---
const zones = await call('GET', '/delivery-zones?activeOnly=true'); route('GET /delivery-zones');
await call('POST', '/delivery-zones', { token: C, body: {}, expect: 403, label: 'client interdit' });
const zone = await call('POST', '/delivery-zones', { token: A, expect: 201, body: { country: 'Cameroun', regionOrCity: 'Douala E2E', feeFcfa: 1500, etaMinHours: 24, etaMaxHours: 48, codAvailable: true, paymentMethods: ['mobile_money', 'card', 'cod'] } }); route('POST /delivery-zones');
const Z = zone.data.id;
await call('GET', `/delivery-zones/${Z}`); route('GET /delivery-zones/:id');
await call('PATCH', `/delivery-zones/${Z}`, { token: A, body: { feeFcfa: 2000 } }); route('PATCH /delivery-zones/:id');

// --- adresses ---
await call('GET', '/addresses', { token: C }); route('GET /addresses');
const address = await call('POST', '/addresses', { token: C, expect: 201, body: { label: 'Maison', fullName: 'Cliente Test', phone: '+237690000002', country: 'Cameroun', city: 'Douala', district: 'Akwa', street: 'Rue 1', isDefault: true } }); route('POST /addresses');
await call('PATCH', `/addresses/${address.data.id}`, { token: C, body: { isDefault: true } }); route('PATCH /addresses/:id');
await call('PATCH', `/addresses/${address.data.id}`, { token: E, body: { city: 'Yaoundé' }, expect: 404, label: 'IDOR : adresse d’un autre compte' });

// --- commandes (payload identique à checkout-view.tsx) ---
const BASE_MATERIALS = ['Cuir', 'Leather'];
const orderBody = (productId, size, material) => ({
  items: [{ productId, quantity: 1, size, color: 'Noir', ...(material && !BASE_MATERIALS.includes(material) ? { customMaterial: material } : {}) }],
  deliveryZoneId: Z,
  address: { country: 'Cameroun', city: 'Douala', district: 'Akwa', street: 'Rue 1' },
  guest: { name: 'Cliente Test', phone: '+237690000002', email: 'client@test.local' },
  paymentMethod: 'CASH_ON_DELIVERY',
});
const seeded = list.data.items.find((item) => item.sizes?.some((s) => s.available));
const seededSize = seeded.sizes.find((s) => s.available).size;
const order = await call('POST', '/orders', { token: C, body: orderBody(seeded.id, seededSize, undefined), expect: 201 }); route('POST /orders');
// Matière de base (« Cuir ») : le checkout ne l'envoie plus comme personnalisation.
await call('POST', '/orders', { body: orderBody(P, '38', 'Cuir'), expect: 201, label: 'matière par défaut sur produit non personnalisable' });
await call('POST', '/orders', { body: orderBody(P, '38', 'Daim'), expect: 400, label: 'matière personnalisée refusée si non personnalisable' });
await call('POST', '/orders', { body: orderBody(P, '39', undefined), expect: 400, label: 'taille désactivée' });
const O = order.data.order.id;
await call('GET', '/orders/me?pageSize=50', { token: C }); route('GET /orders/me');
await call('GET', '/orders?pageSize=100', { token: A }); route('GET /orders');
await call('GET', '/orders?pageSize=100', { token: C, expect: 403, label: 'client interdit' });
const detail = await call('GET', `/orders/${O}`, { token: C }); route('GET /orders/:id');
results.push({ ok: Boolean(detail.data?.items?.[0]?.imageUrl && detail.data.items[0].slugFr), method: 'GET', path: `/orders/${O}`, status: detail.status, expected: 'imageUrl + slugFr', label: 'articles de commande avec image produit', detail: JSON.stringify(detail.data?.items?.[0])?.slice(0, 200) });
await call('GET', `/orders/${O}`, { token: E, expect: 403, label: 'IDOR : commande d’un autre compte' });
await call('PATCH', `/orders/${O}/note`, { token: A, body: { note: 'Note interne' } }); route('PATCH /orders/:id/note');
await call('PATCH', `/orders/${O}/status`, { token: A, body: { status: 'CONFIRMED' } }); route('PATCH /orders/:id/status');
for (const status of ['PREPARING', 'SHIPPED']) await call('PATCH', `/orders/${O}/status`, { token: A, body: { status }, label: 'transition admin' });
await call('PATCH', `/orders/${O}/status`, { token: A, body: { status: 'CONFIRMED' }, expect: 409, label: 'transition interdite SHIPPED → CONFIRMED' });
await call('PATCH', `/orders/${O}/status`, { token: A, body: { status: 'DELIVERED' }, label: 'DELIVERED → notification avis' });

// --- paiements ---
await call('GET', '/payments/providers', { token: A }); route('GET /payments/providers');
await call('GET', `/payments/${O}/status`); route('GET /payments/:id/status');
await call('POST', `/payments/${O}/confirm`, { body: { reference: 'ref-inexistante' }, expect: [200, 400, 404, 409] }); route('POST /payments/:id/confirm');
await call('POST', `/payments/${O}/retry`, { body: {}, expect: [200, 400, 409] }); route('POST /payments/:id/retry');
await call('POST', '/payments/campay/webhook', { body: { reference: 'x', status: 'SUCCESSFUL', external_reference: O }, expect: [200, 401], label: 'webhook sans signature' }); route('ALL /payments/campay/webhook');

// --- notifications ---
const notifs = await call('GET', '/notifications', { token: C }); route('GET /notifications');
const notif = notifs.data?.[0];
if (notif) { await call('PATCH', `/notifications/${notif.id}/read`, { token: C, expect: 204 }); }
else results.push({ ok: false, method: 'GET', path: '/notifications', status: 200, expected: '≥1', label: 'aucune notification après livraison', detail: '' });
await call('PATCH', '/notifications/pas-un-id/read', { token: C, expect: [204, 400, 404], label: 'id invalide' }); route('PATCH /notifications/:id/read');

// --- avis ---
const review = await call('POST', '/reviews', { token: C, body: { productId: seeded.id, rating: 5, comment: 'Très belle mule' }, expect: 201 }); route('POST /reviews');
await call('GET', '/reviews?status=pending', { token: A }); route('GET /reviews');
await call('PATCH', `/reviews/${review.data.id}/moderate`, { token: A, body: { status: 'approved' } }); route('PATCH /reviews/:id/moderate');
await call('GET', `/reviews/product/${seeded.id}`); route('GET /reviews/product/:productId');
await call('GET', `/reviews/product/${seeded.id}/summary`); route('GET /reviews/product/:productId/summary');

// --- contenu (admin envoie l'objet page complet tel que reçu de GET /content) ---
await call('PUT', '/content/cgv', { token: A, body: { titleFr: 'CGV', bodyFr: '# CGV\n\nTexte.' } }); route('PUT /content/:slug');
const pages = await call('GET', '/content'); route('GET /content');
const cgv = pages.data.find((page) => page.slug === 'cgv');
await call('PUT', '/content/cgv', { token: A, body: cgv, label: 'admin : objet page complet (titleEn/bodyEn null)' });
await call('GET', '/content/cgv'); route('GET /content/:slug');
await call('GET', '/content/inexistante', { expect: 404 });

// --- paramètres / utilisateurs / tableau de bord ---
const settings = await call('GET', '/settings'); route('GET /settings');
await call('PUT', '/settings', { token: A, body: settings.data }); route('PUT /settings');
await call('PUT', '/settings', { token: C, body: {}, expect: 403, label: 'client interdit' });
await call('GET', '/users?role=CUSTOMER&pageSize=100', { token: A }); route('GET /users');
const target = (await call('GET', '/users?role=CUSTOMER&pageSize=100', { token: A })).data.items.find((u) => u.email === email);
await call('PATCH', `/users/${target.id}/role`, { token: A, body: { role: 'PRODUCT_MANAGER' } }); route('PATCH /users/:id/role');
await call('GET', '/auth/me', { token: E, expect: 401, label: 'changement de rôle : sessions révoquées' });
E = await login(email, 'E2e123456', 'reconnexion avec le nouveau rôle');
await call('GET', '/products?pageSize=1', { token: E, label: 'nouveau rôle actif' });
await call('PATCH', `/users/${adminId}/role`, { token: A, body: { role: 'CUSTOMER' }, expect: [400, 403], label: 'admin ne peut pas se rétrograder' });
const now = new Date(); const from = new Date(now.getTime() - 30 * 864e5);
const period = `?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(now.toISOString())}`;
await call('GET', `/dashboard/kpis${period}`, { token: A }); route('GET /dashboard/kpis');
await call('GET', `/dashboard/top-products${period}`, { token: A }); route('GET /dashboard/top-products');
await call('GET', '/dashboard/alerts', { token: A }); route('GET /dashboard/alerts');
await call('GET', '/dashboard/alerts', { token: C, expect: 403, label: 'client interdit' });

// --- suppressions ---
await call('DELETE', `/addresses/${address.data.id}`, { token: C, expect: 204 }); route('DELETE /addresses/:id');
await call('DELETE', `/products/${P}`, { token: A, expect: 409, label: 'produit présent dans une commande' });
await call('PATCH', `/products/${P}`, { token: A, body: { status: 'draft' }, label: 'retrait du catalogue à la place' }); route('DELETE /products/:id');
await call('DELETE', `/delivery-zones/${Z}`, { token: A, expect: 409, label: 'zone utilisée par une commande' }); route('DELETE /delivery-zones/:id');
await call('PATCH', `/delivery-zones/${Z}`, { token: A, body: { active: false }, label: 'désactivation à la place' });
const spare = await call('POST', '/delivery-zones', { token: A, expect: 201, body: { country: 'Cameroun', regionOrCity: 'Zone jetable', feeFcfa: 0, etaMinHours: 1, etaMaxHours: 2, paymentMethods: ['cod'] } });
await call('DELETE', `/delivery-zones/${spare.data.id}`, { token: A, expect: 204, label: 'zone inutilisée' });
await call('DELETE', '/auth/me', { token: E, expect: 204 }); route('DELETE /auth/me');

// --- supervision (rôle DEV) ---
// Compte de l'équipe technique : créé au besoin, puis rôle DEV attribué par l'admin.
await call('POST', '/auth/register', { body: { name: 'Dev Test', email: 'dev@test.local', password: 'Dev1234567' }, expect: [201, 409], label: 'compte DEV' });
const devUser = (await call('GET', '/users?pageSize=100', { token: A, label: 'recherche du compte DEV' })).data.items.find((u) => u.email === 'dev@test.local');
if (devUser.role !== 'DEV') await call('PATCH', `/users/${devUser.id}/role`, { token: A, body: { role: 'DEV' }, label: 'attribution du rôle DEV' });
const D = await login('dev@test.local', 'Dev1234567', 'connexion DEV');
const ingest = await call('POST', '/monitoring/client-errors', { body: { message: 'TypeError: audit e2e', url: '/fr/panier', kind: 'error' }, expect: 204 }); route('POST /monitoring/client-errors');
await call('POST', '/monitoring/client-errors', { body: {}, expect: 400, label: 'rapport invalide' });
// Serveur Next (Vercel) authentifié par LOG_INGEST_KEY → source « frontend-server ».
if (process.env.LOG_INGEST_KEY) {
  const nextError = `next-render-error-${Date.now()}`;
  const res = await fetch(`${API}/monitoring/client-errors`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Log-Ingest-Key': process.env.LOG_INGEST_KEY }, body: JSON.stringify({ message: nextError, kind: 'server', route: '/[locales]/produits/[slug] (render)', method: 'GET' }) });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const serverLogs = await call('GET', `/monitoring/logs?source=frontend-server&q=${nextError}`, { token: D, label: 'erreur serveur Next' });
  results.push({ ok: res.status === 204 && serverLogs.data?.items?.length === 1, method: 'POST', path: '/monitoring/client-errors', status: res.status, expected: 'source frontend-server', label: 'clé d’ingestion Next', detail: '' });
}
for (const [token, expected, label] of [[undefined, 401, 'invité'], [A, 403, 'ADMIN refusé'], [C, 403, 'client refusé']]) {
  await call('GET', '/monitoring/logs', { token, expect: expected, label });
}
const logs = await call('GET', '/monitoring/logs?limit=50&source=frontend-browser&q=audit%20e2e', { token: D }); route('GET /monitoring/logs');
results.push({ ok: logs.data?.items?.some((e) => e.msg?.includes('audit e2e')), method: 'GET', path: '/monitoring/logs', status: logs.status, expected: 'erreur frontend retrouvée', label: 'remontée navigateur visible', detail: JSON.stringify(logs.data?.items?.[0])?.slice(0, 200) });
// Toute réponse d'erreur porte sa référence (X-Request-Id + corps) ; la ligne de log la retrouve.
const failing = await fetch(`${API}/products/slug/introuvable-${Date.now()}`);
const failingBody = await failing.json();
const reference = failing.headers.get('x-request-id');
results.push({ ok: Boolean(reference) && failingBody.error?.requestId === reference, method: 'GET', path: '/products/slug/…', status: failing.status, expected: 'requestId en en-tête et dans le corps', label: 'référence d’erreur', detail: JSON.stringify(failingBody) });
await new Promise((resolve) => setTimeout(resolve, 300)); // écriture asynchrone du fichier de log
const traced = await call('GET', `/monitoring/logs?requestId=${reference}`, { token: D, label: 'recherche par référence' });
results.push({ ok: traced.data?.items?.[0]?.res?.statusCode === 404, method: 'GET', path: '/monitoring/logs?requestId=…', status: traced.status, expected: 'ligne de la requête 404', label: 'traçabilité par référence', detail: JSON.stringify(traced.data?.items?.[0])?.slice(0, 200) });
const files = await call('GET', '/monitoring/logs/files', { token: D }); route('GET /monitoring/logs/files');
const current = files.data?.current;
const download = await fetch(`${API}/monitoring/logs/files/${encodeURIComponent(current)}`, { headers: { Cookie: D } });
results.push({ ok: download.status === 200 && (await download.text()).includes('"level"'), method: 'GET', path: '/monitoring/logs/files/:name', status: download.status, expected: '200 + NDJSON', label: 'téléchargement', detail: '' }); route('GET /monitoring/logs/files/:name');
await call('GET', `/monitoring/logs/files/${encodeURIComponent('../../.env')}`, { token: D, expect: 404, label: 'traversée de chemin refusée' });
await call('DELETE', `/monitoring/logs/files/${encodeURIComponent(current)}`, { token: D, expect: 404, label: 'fichier en cours protégé' }); route('DELETE /monitoring/logs/files/:name');
await call('POST', '/monitoring/logs/purge', { token: D, body: { olderThanDays: 365 } }); route('POST /monitoring/logs/purge');
const health = await call('GET', '/monitoring/health', { token: D }); route('GET /monitoring/health');
results.push({ ok: health.data?.database?.ok === true && health.data?.requests?.last60?.requests > 0, method: 'GET', path: '/monitoring/health', status: health.status, expected: 'base OK + trafic mesuré', label: 'santé', detail: JSON.stringify(health.data?.database) });
const auditLog = await call('GET', '/monitoring/audit?action=user.&pageSize=5', { token: D }); route('GET /monitoring/audit');
results.push({ ok: auditLog.data?.items?.every((item) => item.action.startsWith('user.')), method: 'GET', path: '/monitoring/audit', status: auditLog.status, expected: 'actions user.* uniquement', label: 'filtre audit', detail: '' });
void ingest;

// --- santé / métriques (réservées aux administrateurs) ---
for (const [label, token, expected] of [['/health public', undefined, 200], ['/metrics sans token', undefined, 401], ['/metrics client', C, 403], ['/metrics admin', A, 200]]) {
  const path = label.split(' ')[0];
  const res = await fetch(new URL(path, API).toString(), { headers: token ? { Cookie: token } : {} });
  results.push({ ok: res.status === expected, method: 'GET', path, status: res.status, expected: String(expected), label, detail: '' });
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? '✔' : '✖'} ${r.method.padEnd(6)} ${r.path.padEnd(58)} ${String(r.status).padEnd(4)} (attendu ${r.expected}) ${r.label}${!r.ok && r.detail ? `\n     → ${r.detail}` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} vérifications OK — ${hit.size} routes couvertes`);
process.exitCode = failed.length ? 1 : 0;
