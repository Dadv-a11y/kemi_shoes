# Audit KEMI SHOES — rendu des vues, intégration admin / front / back, écosystème

_Date : 6 octobre 2026 — branche `claude/test-render-ecosystem-audit-wyq9sk`_

## 1. Périmètre et méthode

| Élément | Détail |
|---|---|
| Backend | Node 22, Express 4, PostgreSQL 16 (base locale), seed `npm run db:seed` |
| Frontend | Next.js 16.3 (build de production `next build` + `next start`), next-international |
| Données de test | `backend/images_demo/` (non versionné) : 39 images générées par `python3 backend/scripts/generate-demo-images.py` (25 produits dont 10 avec 2 vues + 4 visuels de marque), noms attendus par `npm run db:seed` |
| Comptes de test | `admin@test.local` (ADMIN) et `client@test.local` (CUSTOMER) |

Trois niveaux de vérification :

1. **Tests unitaires backend** (`npm test`) : 100/100.
2. **Contrat API** (`audit/api-contract-check.mjs`) : chaque route est appelée avec **le payload exact envoyé par le front ou l'admin**, plus les contrôles d'accès (401/403/IDOR) → **93/93 vérifications, 60 routes**.
3. **Rendu des vues** (`audit/ui-render-check.mjs`, Playwright/Chromium) : 53 vues FR/EN, desktop + mobile (390 px), visiteur / cliente / admin. Collecte des erreurs console, exceptions JS, requêtes HTTP ≥ 400, images cassées, débordement horizontal, hauteur de l'en-tête et liens qui sortent de la locale. Parcours complet produit → panier → checkout → confirmation → compte, OTP (compte à rebours, renvoi après expiration), déconnexion, chaque onglet du back-office (qui doit tenir dans le viewport 1366×900) → **53/53**.

Résultats bruts : `audit/resultats/`. Le script de rendu écrit une capture de chaque vue et de chaque étape de navigation dans `audit/screenshots/` (non versionné).

## 2. Résultat global

| Étape | Avant correctifs | Après |
|---|---|---|
| Tests backend | 47/93 (mot de passe de la base de test codé en dur) | **115/115** |
| Contrat API | 77/83 | **118/118** (62 routes) |
| Rendu des vues | 22/49, aucune commande possible | **55/55**, commande passée depuis l'UI |
| `npm audit --omit=dev` (frontend) | 1 critique, plusieurs élevées | **0** |
| Lint frontend | 1 erreur | 0 erreur (1 avertissement) |

## 3. Couverture des routes backend

Les 62 routes ont un consommateur. Une seule est orpheline.

| Module | Route | Consommateur |
|---|---|---|
| auth | `POST /register`, `POST /login` | `auth-view.tsx` |
| | `POST /otp/request` | `auth-view.tsx`, `otp-view.tsx` (renvoi) |
| | `POST /otp/verify` | `otp-view.tsx` |
| | `POST /refresh` | `lib/backend-api.ts` (automatique sur 401, un seul renouvellement à la fois) |
| | `POST /logout`, `POST /logout-all` | `account-view.tsx` (« Se déconnecter », « … de tous les appareils ») |
| | `GET/PATCH/DELETE /me` | `account-view.tsx` ; `GET /me` aussi par la garde admin |
| | `GET /providers` | `auth-view.tsx` |
| | `GET /oauth/{google,facebook}` (+ callbacks) | liens de `auth-view.tsx` ; callbacks appelés par le fournisseur, retour `#accessToken=…` lu par `auth-view.tsx` |
| | `GET /oauth/failure` | ⚠ **orpheline** : `failureRedirect` renvoie directement vers le front |
| products | `GET /`, `GET /slug/:slug` | `lib/catalog-api.ts` (SSR), `cart-view.tsx`, admin |
| | `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, `PATCH /:id/sizes`, `POST /upload-image` | `admin-dashboard.tsx` |
| delivery-zones | `GET /` | `cart-view.tsx`, `checkout-view.tsx`, admin |
| | `GET /:id` | `account-view.tsx` (détail commande) |
| | `POST`, `PATCH`, `DELETE` | admin |
| orders | `POST /` | `checkout-view.tsx` |
| | `GET /me` | `account-view.tsx` |
| | `GET /:id` | `account-view.tsx`, admin |
| | `GET /`, `PATCH /:id/status`, `PATCH /:id/note` | admin |
| payments | `GET /:id/status`, `POST /:id/confirm`, `POST /:id/retry` | `payment-tracker.tsx` |
| | `GET /providers` | admin |
| | `ALL /campay/webhook` | CamPay (externe) |
| reviews | `POST /`, `GET /product/:id`, `GET /product/:id/summary` | `product-reviews.tsx` |
| | `GET /`, `PATCH /:id/moderate` | admin |
| content | `GET /:slug` | `legal-page.tsx` (SSR) |
| | `GET /`, `PUT /:slug` | admin |
| dashboard | `GET /kpis`, `/top-products`, `/alerts` | admin |
| notifications | `GET /`, `PATCH /:id/read` | `site-header.tsx` |
| addresses | `GET`, `POST`, `PATCH`, `DELETE` | `account-view.tsx` |
| users | `GET /`, `PATCH /:id/role` | admin |
| settings | `GET /` | `site-header.tsx`, `site-footer.tsx`, admin |
| | `PUT /` | admin |
| media | `GET /` | accueil et « Notre histoire » (SSR) |
| infra | `/health`, `/uploads/*` | supervision, images |
| | `/metrics` | supervision Prometheus, **administrateurs uniquement** |

## 4. Anomalies trouvées et corrigées

| # | Gravité | Symptôme | Cause | Correctif |
|---|---|---|---|---|
| 1 | **Critique** | Toutes les fiches produit en **500** en production | `generateStaticParams` (rendu statique) + lecture de `searchParams` → `DYNAMIC_SERVER_USAGE` | Page rendue à la demande (`produits/[slug]/page.tsx`) |
| 2 | **Critique** | Toute modification de produit depuis l'admin refusée (**400**) | L'API renvoyait `colorCustomizable`, `materialCustomizable`, `isMain` et `available` en `0/1`, mais son schéma de mise à jour exige des booléens | Booléens normalisés dans `products.service.js` + `Boolean()` côté admin |
| 3 | **Critique** | Commande refusée pour tout produit non personnalisable | Le checkout envoyait toujours la matière par défaut (« Cuir ») dans `customMaterial` | `customMaterial` envoyé seulement pour une vraie personnalisation ; options de matière masquées si le produit n'est pas personnalisable |
| 4 | Élevée | Taille « 40 » présélectionnée même si elle est indisponible ; tailles 36/37 jamais proposées ; couleurs codées en dur (Noir/Cognac/Naturel) | Listes statiques dans `product-purchase-panel.tsx` | Tailles et couleurs réelles du produit, ajout au panier bloqué sans taille disponible |
| 5 | Élevée | L'admin écrasait les couleurs d'un produit par une seule couleur nommée « Couleur » | Payload construit à partir de la seule couleur principale | Couleurs existantes conservées, seule la principale est modifiée |
| 6 | Élevée | Enregistrement d'une page de contenu (CGV…) depuis l'admin en **400** | L'admin renvoyait l'objet complet (`titleEn: null`, `id`, `updatedAt`…) | Payload limité aux champs attendus + schéma `nullish()` côté API |
| 7 | Élevée | Suppression d'une zone de livraison utilisée → **500** exposant le nom de la contrainte SQL | Clé étrangère `Order → DeliveryZone` non gérée | 409 explicite dans `deliveryZones.service.js` ; `errorHandler` traduit 23503/23505/22P02 et les erreurs multer, et ne renvoie plus de code interne |
| 8 | Élevée | Visiteur EN renvoyé sur le site FR depuis l'accueil ; prefetch `/notre-histoire` en 404 | `locale = "fr"` codé en dur et liens sans préfixe sur l'accueil | Locale lue depuis l'URL, liens préfixés |
| 9 | Moyenne | Back-office affiché à un visiteur (avec des KPI fictifs) et cascade de 401/403 | Aucune garde côté UI | Garde `GET /auth/me` + rôle ADMIN/PRODUCT_MANAGER |
| 10 | Moyenne | Erreur d'hydratation React (#418) au checkout | Panier lu dans le cookie pendant le rendu serveur | Lecture du panier après le montage |
| 11 | Moyenne | Moyens de paiement proposés même si la zone ne les accepte pas | Les options ne tenaient pas compte de `paymentMethods` et `codAvailable` | Options filtrées selon la zone, message d'erreur traduit |
| 12 | Moyenne | Erreur d'hydratation sur les 404 `/en/…`, 404 en statut 200 | 404 racine pré-rendue en français dans le layout | `app/global-not-found.tsx` (vraie 404, bilingue) + `not-found.tsx` localisé |
| 13 | Moyenne | 4 liens du pied de page en 404 (`/aide`, `/aide/livraison-retours`, `/aide/guide-des-tailles`, `/contact`) | Pages inexistantes | Liens vers CGV, Compte, e-mail/WhatsApp |
| 14 | Faible | Notification non marquée comme lue au clic, badge jamais décrémenté, 401 sur chaque page pour un visiteur ; erreur de lint | `PATCH` lancé après la navigation, filtre `readAt` absent | Ordre inversé, filtre des notifications lues, appel uniquement si une session existe |
| 15 | Faible | « Infinity FCFA » dans le panier quand aucune zone n'est active | `Math.min()` sur une liste vide | Valeur 0 par défaut |
| 16 | Faible | Liens Markdown des pages légales (`/cgv`) sans locale | Markdown brut | Liens internes préfixés par la locale |
| 17 | Faible | `/admin` (sans locale) affiché avec l'en-tête et le pied de page de la boutique | Détection admin incomplète dans `app-chrome.tsx` | Regex couvrant `/admin`, `/fr/admin` et `/en/admin` |
| 19 | Moyenne | Pour une cliente ayant des notifications, leur liste s'affichait en clair dans l'en-tête, qui débordait sur la page (repéré sur les captures) | Aucun style pour `.notification-menu` / `.notification-list` | Menu déroulant fermé par défaut, ouvert au survol ou au focus (`globals.css`) ; le script vérifie désormais la hauteur de l'en-tête |
| 18 | Outillage | Tests backend impossibles hors du poste du développeur ; **mot de passe PostgreSQL commité** | URL codée en dur dans `tests/env.setup.js` | Lecture de `TEST_DATABASE_URL` (`.env`) |

Tests ajoutés : `errorHandler.test.js`, suppression de zone référencée, aller-retour du schéma produit.

### Deuxième lot (retours sur l'interface)

| # | Demande / constat | Mise en œuvre |
|---|---|---|
| 20 | **Sessions révocables** | Table `Session` : chaque connexion ouvre une session dont l'id (`sid`) est porté par l'access token et par le refresh token. `requireAuth` refuse tout jeton dont la session est révoquée ou expirée. Refresh tokens **rotatifs** (seul le hash du `jti` est stocké) ; rejouer un ancien refresh token révoque la session (vol), sauf dans les 60 s qui suivent une rotation (onglets multiples → `REFRESH_SUPERSEDED`). `POST /auth/logout` et `POST /auth/logout-all` ; changement de rôle = révocation de toutes les sessions de l'utilisateur ; suppression du compte = suppression en cascade. Front : un seul renouvellement à la fois, boutons « Se déconnecter » et « … de tous les appareils » |
| 21 | `/metrics` réservé aux administrateurs | `requireAuth` + `requireRole('ADMIN')` (401 sans jeton, 403 pour un autre rôle) |
| 22 | Vulnérabilités `shadcn` | CLI déplacé en `devDependencies` (seul `shadcn/tailwind.css` est importé, au build). Au passage, **Next.js 16.3.2 → 16.3.8** (RCE critique) et `npm audit fix` : `npm audit --omit=dev` = 0. Restent, en développement seulement, `braces` (aucun correctif publié) et une alerte modérée de `@tailwindcss/typography` |
| 23 | Nom des cards de suggestion de la fiche produit | 14 px, tronqué à 2 lignes (`line-clamp`, appliqué à toutes les cards) |
| 24 | Cards de suggestion du panier | Composant `ProductCard` et grille de la boutique ; les produits déjà dans le panier sont exclus |
| 25 | Pagination et tenue dans le viewport | `components/admin/table-pagination.tsx` (8 lignes, 5 pour les avis et les utilisateurs) sur commandes, produits, clients, zones, avis, utilisateurs ; back-office ancré au viewport (seule la zone de contenu défile) ; vue d'ensemble compactée. Le script vérifie qu'aucun onglet ne dépasse 1366×900 |
| 26 | Barres « Top produits » toutes à 100 % | La longueur utilisait l'évolution vs période précédente (`trendPercent`) : remplacée par la part des ventes du meilleur produit |
| 27 | OTP : renvoi après expiration | `POST /auth/otp/request` ne génère un nouveau code qu'une fois le précédent expiré (sinon il renvoie son échéance, `resent: false`). Le front affiche le compte à rebours de l'échéance serveur (5 min, au lieu d'un 45 s fixe faux) et ne propose « Renvoyer le code » qu'à l'expiration |
| 28 | Cards de commande sans produit | Les articles de commande renvoient `imageUrl` (photo principale) et les slugs ; vignettes cliquables vers la fiche produit dans « Mes commandes » et le détail |
| 29 | OAuth Google/Facebook inopérant | `findOrCreateOAuthUser` (asynchrone) n'était pas attendu : le front recevait des jetons `undefined` |
| 30 | Notifications lues qui réapparaissaient | Colonne `readAt` non remappée par la couche SQL (`readat`) |

### Troisième lot

| # | Demande / constat | Mise en œuvre |
|---|---|---|
| 31 | **Jetons en cookies** | L'API pose les jetons en cookies `HttpOnly` (`kemi_at` pour toute l'API, `kemi_rt` limité à `/api/v1/auth`), `SameSite=Lax`, `Secure` en production, durée = celle du jeton. Les réponses de connexion ne contiennent plus que l'utilisateur ; le callback OAuth ne passe plus aucun jeton dans l'URL. Le front appelle l'API avec `credentials: "include"` et ne garde qu'un indicateur « connecté » sans secret. Protection CSRF : toute requête modifiant des données avec un cookie de session doit venir d'une origine de `CORS_ORIGINS`. L'en-tête `Authorization: Bearer` reste accepté pour les scripts et la supervision |
| 32 | **SMS derrière une interface** | `modules/notifications/sms/` : contrat `SmsProvider` (`send(phone, message)`), fournisseurs `console` (dev : code affiché dans la console), `memory` (tests), registre `sms.factory.js` et `README.md` expliquant comment brancher un vrai fournisseur (exemple Twilio). Choix par `SMS_PROVIDER` / `WHATSAPP_PROVIDER` : `console` en dev, `none` en production, `console`/`memory` refusés au démarrage en production. Repli WhatsApp ; si aucun canal ne délivre le code, il est supprimé et l'API répond 502 |
| 33 | **Méthodes de connexion masquées si non configurées** | `GET /auth/providers` renvoie `{ password, phone, google, facebook }` ; `phone` dépend du fournisseur SMS. Le front n'affiche que les méthodes disponibles (formulaire e-mail par défaut sans SMS) ; `POST /auth/otp/request` répond 503 sans fournisseur |
| 34 | Inscription par e-mail impossible | Le formulaire e-mail n'avait pas de champ « Nom » en mode inscription (refus 400 de l'API) |
| 35 | Numéro masqué erroné sur la page OTP | `+237 2XX…` : le « 2 » de l'indicatif était pris pour le premier chiffre → `+237 6XX XXX X48` |
| 36 | Code mort | Faux JWT `kemi-session` (signature aléatoire, jamais posé) et sa lecture dans `proxy.ts` supprimés |

## 5. Constats non corrigés (à arbitrer)

### Critique / élevé

- **Mot de passe exposé dans l'historique git** : `daril2005` (ancien `tests/env.setup.js`). Il faut le changer s'il est réutilisé ailleurs.
- **Brouillons publics** : `GET /products?status=draft`, `GET /products/:id` et `GET /products/slug/:slug` renvoient les produits non publiés à n'importe qui. Il faut restreindre `status ≠ active` aux rôles staff.

### Moyen

- **Fournisseur SMS à choisir** : tant que `SMS_PROVIDER` vaut `none` en production, la connexion par téléphone est masquée. Il suffit d'ajouter une classe `SmsProvider` et une entrée dans `sms.factory.js` (voir le README du dossier).
- `proxy.ts` redirige l'accueil vers la page de vérification tant qu'un code OTP est en cours ; avec un code valable 5 min, un visiteur qui revient à l'accueil y est renvoyé pendant toute cette durée.
- Upload d'images : le type est contrôlé seulement sur le `mimetype` déclaré par le client (pas de vérification des octets magiques).
- Panier stocké en cookie JSON (limite d'environ 4 Ko, soit une dizaine d'articles) et envoyé à chaque requête. `localStorage` serait plus adapté.
- Le seed ne crée **aucune zone de livraison** : sur une base neuve, le checkout est bloqué tant qu'un admin n'en a pas créé une. Il faut ajouter Douala/Yaoundé au seed ou à la doc.
- `GET /delivery-zones` (public) renvoie aussi les zones inactives.
- `PATCH /notifications/:id/read` ne valide pas l'identifiant (204 même pour un id inexistant).
- Les refus métier (slug déjà pris) renvoient 400 au lieu de 409. Éditer le slug d'une page de contenu crée une nouvelle page au lieu de la renommer.
- `npm run lint` du backend échoue : ESLint n'est ni installé ni configuré.
- Aucune CI (`.github/` absent) : rien n'empêche de pousser une régression comme les points 1 à 3.

### Faible / UX / i18n

- Accueil EN : titre, sous-titres de la mosaïque et bandeau d'annonce restent en français. `<html lang="fr">` est fixe. L'en-tête mélange « Home » et « Homme ».
- Fiche produit : badge « En stock » affiché même pour `out_of_stock`, bouton « Commander sur WhatsApp » sans action, texte de livraison codé en dur. Le tri des avis n'a pas d'interface (`setSort` inutilisé).
- Callback OAuth : retour toujours sur `/fr/compte/connexion`, même pour un visiteur EN.
- Une URL produit inconnue renvoie une « soft 404 » (statut 200 + `noindex`), comportement normal de Next en streaming.
- Font Awesome est chargé depuis cdnjs, une dépendance externe bloquante pour le CSS de l'admin. Il vaudrait mieux l'auto-héberger ou utiliser `lucide-react`, déjà présent.
- CamPay en mode démo : le montant est plafonné à 25 XAF (`CAMPAY_MAX_AMOUNT_XAF`), à retirer au Go Live.

## 6. Audit de l'écosystème

**Architecture.** Séparation claire : API Express modulaire (route / schéma Zod / service), PostgreSQL via une couche SQL maison (`db/client.js` réécrit des requêtes de style SQLite), frontend Next 16 App Router avec SSR du catalogue et composants client pour le panier, le compte et l'admin. Points de friction : la couche de compatibilité SQLite → PostgreSQL (mappage manuel des colonnes en minuscules, booléens en INTEGER) est à l'origine du bug n°2. Un vrai type `BOOLEAN` ou un ORM (le `prisma/schema.prisma` présent n'est pas utilisé) réduirait ce risque.

**Sécurité (OWASP).** Points solides : validation Zod systématique, RBAC `requireRole`, protection IDOR vérifiée (adresses et commandes d'autrui → 404/403), Helmet, CORS restreint, rate-limit sur auth/OTP/paiement, hachage HMAC des OTP, noms de fichiers d'upload générés côté serveur, webhook CamPay signé, garde-fous sur `db:reset` en production. Points à traiter : voir §5 (OTP en clair dans les logs, brouillons publics, sessions non révocables, `/metrics`).

**Qualité et outillage.** Bonne base de tests unitaires backend (100) ; aucun test frontend ni test d'intégration HTTP avant cet audit. Les deux scripts d'`audit/` peuvent servir de base à une CI : Postgres en service, `db:seed`, build Next, puis les deux scripts. Lint frontend OK, lint backend non configuré.

**Contrat front ↔ back.** Les types TypeScript du frontend sont redéclarés à la main dans chaque composant (`ApiProduct`, `DeliveryZone`… dupliqués et divergents, par exemple `available: boolean | number`). Des types partagés, générés depuis les schémas Zod (par exemple `zod-to-ts`), auraient évité les bugs n°2, 3 et 6.

**Performance.** Le catalogue est rendu côté serveur avec `revalidate: 60` et les images passent par `next/image` (en local, `next start` impose `ALLOW_LOCAL_IMAGES=true`, ajouté dans `next.config.ts`). `GET /products` fait 3 requêtes par produit (N+1, 300 requêtes pour 100 produits), à regrouper par `IN (...)` avant que le catalogue grossisse.

**Déploiement.** `DEPLOIEMENT.md` est complet (build standalone, persistance de `uploads/`, variables). À ajouter : la création des zones de livraison et le branchement SMS avant ouverture.

## 7. Rejouer l'audit

```bash
# backend
cd backend && npm run db:reset && npm run db:seed && npm start
# comptes : s'inscrire admin@test.local / Admin12345 et client@test.local / Client12345, puis
npm run user:make-admin -- admin@test.local

# frontend (build de production)
cd frontend && npm run build && ALLOW_LOCAL_IMAGES=true npm start

# vérifications (depuis la racine du dépôt)
node audit/api-contract-check.mjs
NODE_PATH=$(npm root -g) node audit/ui-render-check.mjs   # captures dans audit/screenshots/
```

Les scripts ouvrent une quinzaine de sessions : lancer le backend d'audit avec `AUTH_RATE_LIMIT=500 npm start` (la valeur par défaut, 10 tentatives / 15 min par IP, est celle à garder en production).
