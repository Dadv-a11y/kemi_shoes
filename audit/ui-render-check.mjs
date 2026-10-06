// Rendu de toutes les vues (boutique, compte, admin) en FR/EN, desktop + mobile, avec
// collecte des erreurs console, exceptions JS, requêtes en échec, images cassées et
// débordement horizontal. Termine par un parcours d'achat complet et une passe admin.
//
//   NODE_PATH=$(npm root -g) node audit/ui-render-check.mjs [front] [api] [dossier-captures]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// require() respecte NODE_PATH (playwright installé globalement).
const { chromium } = createRequire(import.meta.url)('playwright');

const FRONT = process.argv[2] ?? 'http://localhost:3000';
const API = process.argv[3] ?? 'http://localhost:4000/api/v1';
const SHOTS = process.argv[4] ?? 'audit/screenshots';
fs.mkdirSync(SHOTS, { recursive: true });

const json = async (method, url, body, cookie) => {
  const res = await fetch(`${API}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return res.status === 204 ? null : res.json();
};
// Connexion : la session arrive en cookies HttpOnly (Set-Cookie), jamais dans le corps.
async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error(`Connexion impossible pour ${email} : HTTP ${res.status} (rate-limit ? lancer le backend avec AUTH_RATE_LIMIT=500)`);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
const admin = await login('admin@test.local', 'Admin12345');
const client = await login('client@test.local', 'Client12345');
// Une zone active est nécessaire au checkout (le seed n'en crée pas).
const zones = await json('GET', '/delivery-zones?activeOnly=true');
if (!zones.length) await json('POST', '/delivery-zones', { country: 'Cameroun', regionOrCity: 'Douala', feeFcfa: 1500, etaMinHours: 24, etaMaxHours: 48, codAvailable: true, paymentMethods: ['mobile_money', 'card', 'cod'] }, admin);
const { items: products } = await json('GET', '/products?status=active&pageSize=100');
const product = products.find((p) => p.sizes.some((s) => s.available));

const report = [];
// Capture d'une étape de navigation (parcours) : audit/screenshots/<nom>.png
const step = async (page, name) => {
  // En haut de page : sinon l'en-tête « sticky » apparaît au milieu de la capture pleine page.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function audit(name, url, { session, viewport = { width: 1366, height: 900 }, action, shot = true, shotName } = {}) {
  const context = await browser.newContext({ viewport, locale: 'fr-FR' });
  if (session) {
    // Cookies HttpOnly de l'API (localhost : partagés entre les ports 3000 et 4000) + indicateur « connecté » du front.
    await context.addCookies(session.split('; ').map((pair) => {
      const [name, ...value] = pair.split('=');
      return { name, value: value.join('='), domain: 'localhost', path: name === 'kemi_rt' ? '/api/v1/auth' : '/', httpOnly: true, sameSite: 'Lax' };
    }));
    await context.addInitScript(() => localStorage.setItem('kemi-has-session', '1'));
  }
  // CDN externes (Font Awesome) : inaccessibles en environnement isolé, on les neutralise
  // pour ne pas fausser la mesure (dépendance signalée dans l'audit).
  await context.route(/cdnjs\.cloudflare\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await context.newPage();
  const issues = [];
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`console: ${m.text().slice(0, 180)}`); });
  page.on('pageerror', (e) => issues.push(`exception: ${e.message.slice(0, 180)}`));
  page.on('requestfailed', (r) => { const f = r.failure()?.errorText ?? ''; if (!f.includes('ERR_ABORTED')) issues.push(`réseau: ${r.method()} ${r.url()} ${f}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) issues.push(`HTTP ${r.status()}: ${r.request().method()} ${r.url().replace(FRONT, '').replace(API, 'API')}`); });
  let status = 0;
  try {
    const res = await page.goto(`${FRONT}${url}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500); // hydratation + appels API côté client
    status = res?.status() ?? 0;
    if (action) await action(page, issues);
    await page.waitForTimeout(300);
    const dom = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) ?? '',
      brokenImages: [...document.images].filter((img) => img.complete && img.naturalWidth === 0 && img.loading !== 'lazy').map((img) => img.currentSrc || img.src).slice(0, 5),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      headerHeight: document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0,
      finalPath: location.pathname + location.search,
      // Liens du contenu qui sortent de la locale courante (ou sans préfixe de locale).
      wrongLocaleLinks: (() => {
        const current = location.pathname.split('/')[1];
        if (!['fr', 'en'].includes(current) || document.title.includes('404') || document.title.includes('introuvable')) return [];
        return [...document.querySelectorAll('main a[href^="/"]')].map((a) => a.getAttribute('href'))
          .filter((href) => !href.startsWith(`/${current}/`) && href !== `/${current}` && !href.startsWith('/_next') && !/\.[a-z]{2,4}$/.test(href)).slice(0, 5);
      })(),
    }));
    dom.wrongLocaleLinks.forEach((href) => issues.push(`lien hors locale: ${href}`));
    dom.brokenImages.forEach((src) => issues.push(`image cassée: ${src}`));
    if (dom.overflow > 2) issues.push(`débordement horizontal: ${dom.overflow}px`);
    if (dom.headerHeight > 90) issues.push(`en-tête déformé: ${Math.round(dom.headerHeight)}px de haut`);
    if (shot) await page.evaluate(() => window.scrollTo(0, 0));
    if (shot) await page.screenshot({ path: path.join(SHOTS, `${shotName ?? name}.png`), fullPage: viewport.width > 500 });
    report.push({ name, url, status, ...dom, issues: [...new Set(issues)] });
  } catch (error) {
    report.push({ name, url, status, issues: [...new Set([...issues, `ÉCHEC: ${error.message.split('\n')[0]}`])] });
  }
  await context.close();
}

const pages = [
  ['accueil', ''], ['boutique', '/boutique'], ['boutique-femme', '/boutique?categorie=femme'], ['panier-vide', '/panier'],
  ['notre-histoire', '/notre-histoire'], ['cgv', '/cgv'], ['confidentialite', '/confidentialite'], ['mentions-legales', '/mentions-legales'],
  ['connexion', '/compte/connexion'], ['verification-otp', '/compte/verification'], ['compte-invite', '/compte'], ['commande-vide', '/commande'],
  ['suivi-sans-commande', '/commande/suivi'], ['admin-invite', '/admin'], ['404', '/page-inexistante'],
];
for (const locale of ['fr', 'en']) {
  for (const [name, url] of pages) await audit(`${locale}-${name}`, `/${locale}${url}`, {});
  await audit(`${locale}-produit`, `/${locale}/produits/${locale === 'fr' ? product.slugFr : product.slugEn}`);
}
await audit('admin-racine-invite', '/admin');
for (const [name, url] of [['mobile-accueil', '/fr'], ['mobile-boutique', '/fr/boutique'], ['mobile-produit', `/fr/produits/${product.slugFr}`], ['mobile-panier', '/fr/panier']]) {
  await audit(name, url, { viewport: { width: 390, height: 844 } });
}

// --- Parcours cliente : produit → panier → checkout (paiement à la livraison) → compte ---
let placedReference = '';
await audit('parcours-achat', `/fr/produits/${product.slugFr}`, {
  session: client,
  action: async (page, issues) => {
    await step(page, 'parcours-1-fiche-produit');
    await page.locator('.purchase-button').click();
    await page.waitForTimeout(500);
    await step(page, 'parcours-2-ajout-panier');
    await page.goto(`${FRONT}/fr/panier`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await step(page, 'parcours-3-panier');
    const legacy = await page.locator('.cart-recommendation-card').count();
    const cards = await page.locator('.cart-recommendations .catalog-card').count();
    if (legacy || !cards) issues.push(`suggestions du panier : ${cards} card(s) boutique, ${legacy} ancienne(s)`);
    await page.goto(`${FRONT}/fr/commande`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.fill('#fullName', 'Cliente Test');
    await page.fill('#phone', '+237690000002');
    await page.fill('#email', 'client@test.local');
    await page.fill('#city', 'Douala');
    for (const id of ['#neighborhood', '#address']) if (await page.locator(id).count()) await page.fill(id, id === '#address' ? 'Rue 1' : 'Akwa');
    await step(page, 'parcours-4-livraison');
    await page.locator('.checkout-step-content .checkout-primary').first().click();
    await page.locator('.checkout-payment-option', { hasText: 'Paiement à la livraison' }).click();
    await step(page, 'parcours-5-paiement');
    await page.locator('.checkout-step-content .checkout-primary').first().click();
    await page.locator('.checkout-check input').check();
    await step(page, 'parcours-6-recapitulatif');
    await page.locator('.checkout-step-content .checkout-primary').click();
    await page.waitForSelector('.checkout-confirmation, .checkout-field-error', { timeout: 15000 });
    const error = await page.locator('.checkout-field-error').allTextContents();
    if (error.length) issues.push(`checkout refusé: ${error.join(' | ')}`);
    placedReference = (await page.locator('.checkout-confirmation strong').first().textContent().catch(() => '')) ?? '';
  },
  shotName: 'parcours-7-confirmation',
});
await audit('compte-cliente', '/fr/compte', {
  session: client,
  action: async (page, issues) => {
    const withImage = await page.locator('.order-card .product-thumb.has-image img').count();
    if (!withImage) issues.push('cards de commande sans photo produit');
    // Menu des notifications (avis demandé après livraison) ouvert au survol.
    if (await page.locator('.notification-button').count()) {
      await page.locator('.notification-button').hover();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, 'compte-cliente-notifications.png') });
      await page.mouse.move(0, 400);
    }
  },
});

// --- Back-office : chaque onglet ---
const tabs = ["Vue d'ensemble", 'Commandes', 'Produits', 'Clients', 'Livraison', 'Paiement', 'Avis clients', 'Contenu & traductions', 'Paramètres'];
for (const [index, tab] of tabs.entries()) {
  await audit(`admin-${index}-${tab.replace(/[^a-zA-Zéè]+/g, '-').toLowerCase()}`, '/fr/admin', {
    session: admin,
    action: async (page, issues) => {
      await page.getByRole('button', { name: tab }).first().click();
      await page.waitForTimeout(1500);
      // L'écran doit tenir dans le viewport : ni la page ni la zone de contenu ne défilent.
      const fit = await page.evaluate(() => {
        const main = document.querySelector('main');
        return { page: document.documentElement.scrollHeight - window.innerHeight, main: main ? main.scrollHeight - main.clientHeight : 0 };
      });
      if (fit.page > 2 || fit.main > 2) issues.push(`dépasse le viewport : page +${fit.page}px, contenu +${fit.main}px`);
    },
  });
}
// Édition d'un produit multi-couleurs depuis le back-office : ses couleurs doivent survivre à l'enregistrement.
const multi = products.find((p) => p.colors.length > 1);
await audit('admin-edition-produit', '/fr/admin', {
  session: admin,
  action: async (page, issues) => {
    await page.getByRole('button', { name: 'Produits' }).first().click();
    await page.waitForTimeout(800);
    await step(page, 'admin-edition-1-liste-produits');
    await page.locator('tr', { hasText: multi.nameFr }).getByRole('button', { name: 'Éditer' }).click();
    await page.waitForTimeout(800);
    await step(page, 'admin-edition-2-formulaire');
    await page.getByRole('button', { name: 'Publier' }).click();
    await page.waitForTimeout(1500);
    const after = await json('GET', `/products/${multi.id}`);
    const before = multi.colors.map((c) => `${c.name}:${c.hex}`).join(',');
    const now = after.colors.map((c) => `${c.name}:${c.hex}`).join(',');
    if (before !== now) issues.push(`couleurs modifiées par l'enregistrement admin : ${before} → ${now}`);
  },
  shotName: 'admin-edition-3-apres-publication',
});
await audit('admin-refuse-cliente', '/fr/admin', { session: client });

// Fiche produit : nom des suggestions réduit et limité à 2 lignes.
await audit('produit-suggestions', `/fr/produits/${product.slugFr}`, {
  shot: false,
  action: async (page, issues) => {
    const style = await page.locator('.related-grid .catalog-info h2').first().evaluate((el) => {
      const css = getComputedStyle(el);
      return { size: css.fontSize, clamp: css.webkitLineClamp, lines: Math.round(el.getBoundingClientRect().height / parseFloat(css.lineHeight)) };
    });
    if (style.size !== '14px' || style.clamp !== '2' || style.lines > 2) issues.push(`nom des suggestions : ${JSON.stringify(style)}`);
  },
});

// OTP : compte à rebours aligné sur le serveur, renvoi possible seulement après expiration.
await audit('otp-1-compte-a-rebours', '/fr/compte/connexion', {
  shotName: 'otp-2-expire',
  action: async (page, issues) => {
    await page.fill('input[type="tel"], input[placeholder*="6XX"]', `69${String(Date.now()).slice(-7)}`);
    await page.getByRole('button', { name: 'Recevoir un code' }).click();
    await page.waitForURL(/verification/, { timeout: 10000 });
    await page.waitForTimeout(1200);
    await step(page, 'otp-1-compte-a-rebours');
    const timer = (await page.locator('.otp-timer strong').textContent()) ?? '';
    if (!/^0[4-5]:\d\d$/.test(timer)) issues.push(`compte à rebours inattendu : ${timer}`);
    if (await page.getByRole('button', { name: 'Renvoyer le code' }).count()) issues.push('bouton « Renvoyer » visible avant expiration');
    // Code en attente : l'accueil reste accessible (plus de redirection forcée), un bandeau propose de reprendre.
    await page.goto(`${FRONT}/fr`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    if (new URL(page.url()).pathname !== '/fr') issues.push(`accueil redirigé vers ${page.url()}`);
    if (!(await page.locator('.otp-pending-banner').count())) issues.push('bandeau « code en attente » absent');
    await step(page, 'otp-3-bandeau-accueil');
    await page.locator('.otp-pending-banner').getByRole('link', { name: 'Saisir le code' }).click();
    await page.waitForURL(/verification/, { timeout: 10000 });
    await page.waitForTimeout(800);
    // Simule l'expiration côté navigateur : le bouton de renvoi doit apparaître.
    await page.evaluate(() => {
      const raw = document.cookie.split('; ').find((c) => c.startsWith('kemi-otp-challenge='));
      const challenge = JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('=')));
      challenge.expiresAt = Date.now() - 1000;
      document.cookie = `kemi-otp-challenge=${encodeURIComponent(JSON.stringify(challenge))}; path=/; max-age=60`;
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    if (!(await page.getByRole('button', { name: 'Renvoyer le code' }).count())) issues.push('pas de bouton « Renvoyer » après expiration');
  },
});

// « Ignorer » efface le rappel du code en attente.
await audit('otp-ignorer-bandeau', '/fr/compte/connexion', {
  shot: false,
  action: async (page, issues) => {
    await page.fill('input[type="tel"]', `69${String(Date.now()).slice(-7)}`);
    await page.getByRole('button', { name: 'Recevoir un code' }).click();
    await page.waitForURL(/verification/, { timeout: 10000 });
    await page.goto(`${FRONT}/fr/boutique`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.locator('.otp-pending-banner').getByRole('button', { name: 'Ignorer' }).click();
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    if (await page.locator('.otp-pending-banner').count()) issues.push('bandeau toujours affiché après « Ignorer »');
  },
});

// Connexion réelle par e-mail depuis le formulaire : les cookies HttpOnly suffisent à ouvrir l'espace compte.
await audit('connexion-email', '/fr/compte/connexion', {
  shotName: 'connexion-email-compte',
  action: async (page, issues) => {
    await page.getByRole('button', { name: 'Utiliser un email et un mot de passe à la place' }).click();
    await page.fill('input[placeholder="nom@exemple.com"]', 'client@test.local');
    await page.fill('input[type="password"]', 'Client12345');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL(/\/compte$/, { timeout: 10000 });
    await page.waitForTimeout(1500);
    const cookies = await page.context().cookies();
    const at = cookies.find((cookie) => cookie.name === 'kemi_at');
    if (!at?.httpOnly) issues.push(`cookie kemi_at absent ou non HttpOnly : ${JSON.stringify(at)}`);
    if (!/Bonjour/.test((await page.locator('h1').first().textContent()) ?? '')) issues.push('espace compte non ouvert après connexion');
  },
});

// Sans fournisseur SMS côté backend (phone: false), la connexion par téléphone est masquée.
await audit('connexion-sans-sms', '/fr/compte/connexion', {
  action: async (page, issues) => {
    await page.route('**/auth/providers', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ password: true, phone: false, google: false, facebook: false }) }));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    if (await page.locator('input[type="tel"]').count()) issues.push('champ téléphone affiché sans fournisseur SMS');
    if (!(await page.locator('input[type="password"]').count())) issues.push('formulaire e-mail non affiché par défaut');
    if (await page.getByText('Continuer avec Google').count()) issues.push('bouton Google affiché alors que non configuré');
  },
});

// Déconnexion : le jeton de la session est révoqué côté serveur.
const leaving = await login('client@test.local', 'Client12345');
await audit('deconnexion', '/fr/compte', {
  session: leaving,
  shot: false,
  action: async (page, issues) => {
    await page.getByRole('tab', { name: /informations/i }).click();
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
    await page.waitForURL(/connexion/, { timeout: 10000 });
    const me = await fetch(`${API}/auth/me`, { headers: { Cookie: leaving } });
    // Les jetons ne doivent jamais être lisibles par le JavaScript de la page.
    const exposed = await page.evaluate(() => document.cookie.includes('kemi_at') || Object.keys(localStorage).some((key) => /token/i.test(key)));
    if (exposed) issues.push('jeton accessible depuis le JavaScript de la page');
    if (me.status !== 401) issues.push(`jeton toujours accepté après déconnexion (HTTP ${me.status})`);
  },
});

await browser.close();
fs.writeFileSync(path.join(SHOTS, '..', 'ui-report.json'), JSON.stringify(report, null, 2));
let failed = 0;
for (const r of report) {
  // Page 404 attendue : seul le statut 404 du document est toléré.
  if (r.name.endsWith('404') && r.status === 404) r.issues = r.issues.filter((i) => !i.startsWith('HTTP 404') && !i.includes('status of 404'));
  const ko = r.issues.length > 0 || (r.status >= 400 && !r.name.endsWith('404'));
  if (ko) failed += 1;
  console.log(`${ko ? '✖' : '✔'} ${r.name.padEnd(32)} ${String(r.status).padEnd(4)} ${r.finalPath ?? ''}  « ${r.h1 ?? ''} »`);
  r.issues.forEach((issue) => console.log(`     - ${issue}`));
}
console.log(`\nCommande passée depuis l'UI : ${placedReference || 'AUCUNE'}`);
console.log(`${report.length - failed}/${report.length} vues sans erreur`);
