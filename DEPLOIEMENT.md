# Guide de déploiement — KEMI SHOES

Ce guide décrit la mise en production de l'application :

| Composant | Techno | Dossier | Port par défaut | Domaine prévu |
|-----------|--------|---------|-----------------|---------------|
| API | Node.js 20+ / Express | `backend/` | 4000 | `https://api-kemishoes.nexa-digitallab.com` |
| Site + admin | Next.js 16, build **standalone** | `frontend/` | 3000 | `https://kemishoes.nexa-digitallab.com` |
| Base de données | PostgreSQL 14+ | — | 5432 | — |
| Paiement | CamPay (Mobile Money MTN / Orange + carte) | — | — | `demo.campay.net` puis `www.campay.net` |

```
Navigateur ──https──> Nginx ──> Next.js standalone (:3000)  ──┐
           └─https──> Nginx ──> API Express (:4000) ──> PostgreSQL
                                     ▲    │
                     webhook CamPay ─┘    └──> API CamPay (collect / transaction / lien carte)
```

---

## 1. Prérequis serveur

- Linux (Ubuntu 22.04+ recommandé), accès SSH sudo.
- **Node.js 20 LTS minimum** (le projet est développé sous Node 24) : `node -v`.
- PostgreSQL 14+ (local ou managé). Si la base est distante avec TLS : `DATABASE_SSL=true`.
- Nginx + Certbot (Let's Encrypt) pour le HTTPS.
- PM2 (`npm i -g pm2`) ou systemd pour garder les processus en vie.
- DNS : `kemishoes.nexa-digitallab.com` et `api-kemishoes.nexa-digitallab.com` pointent vers le serveur.

> **HTTPS obligatoire pour les deux domaines.** Le site étant en https, tout appel vers
> une API en `http://` est bloqué par le navigateur (contenu mixte). CamPay exige aussi
> une URL de retour publique en https pour le paiement par carte.

---

## 2. Backend (API)

### 2.1 Installation

```bash
cd /var/www/kemi_shoes/backend
npm ci --omit=dev
```

### 2.2 Variables d'environnement

Le backend lit `backend/.env` (via dotenv). En production, copiez le contenu de
`backend/.env.production` dans `backend/.env` sur le serveur (ou injectez les variables
via PM2/systemd). Toutes les variables sont validées au démarrage : une valeur invalide
arrête le serveur avec un message explicite.

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `NODE_ENV` | oui | `production` |
| `PORT` | non | Port d'écoute (4000) |
| `DATABASE_URL` | oui | `postgresql://user:motdepasse@hote:5432/kemi_shoes` |
| `DATABASE_SSL` | non | `true` pour une base managée en TLS |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | oui | Deux secrets longs et différents (`openssl rand -hex 48`) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | non | `15m` / `30d` |
| `CORS_ORIGINS` | oui | Origine(s) du site, séparées par des virgules : `https://kemishoes.nexa-digitallab.com` |
| `FRONTEND_URL` | oui | URL publique du site (liens des emails, retour paiement carte, retour OAuth) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | recommandé | Emails transactionnels. Sans `SMTP_HOST`, les emails sont seulement journalisés |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | non | Active « Continuer avec Google » |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | non | Active « Continuer avec Facebook » |
| `CAMPAY_BASE_URL` | oui | `https://demo.campay.net/api` (test) puis `https://www.campay.net/api` (live) |
| `CAMPAY_ACCESS_TOKEN` | oui* | Token permanent de l'application CamPay (prioritaire) |
| `CAMPAY_USERNAME` / `CAMPAY_APP_PASSWORD` | oui* | Alternative au token permanent : un token temporaire est demandé et mis en cache |
| `CAMPAY_APP_ID` | non | Identifiant de l'application (informatif) |
| `CAMPAY_WEBHOOK_KEY` | oui | Clé de signature du webhook (voir §4.3) |
| `CAMPAY_MAX_AMOUNT_XAF` | demo uniquement | `25` : plafonne le montant débité (limite du compte demo). **À supprimer au Go Live** |
| `LOG_LEVEL` | non | `info` |

\* `CAMPAY_ACCESS_TOKEN` **ou** le couple `CAMPAY_USERNAME`/`CAMPAY_APP_PASSWORD`.
Sans aucun identifiant CamPay, le Mobile Money passe en mode simulé et la carte est désactivée
(comportement utilisé en développement et dans les tests).

> Attention aux valeurs avec espaces ou caractères spéciaux (`SMTP_PASS`, `DATABASE_URL`) :
> entourez-les de guillemets simples dans le fichier `.env`.

### 2.3 Base de données

```bash
# Crée/met à jour le schéma (idempotent : CREATE TABLE IF NOT EXISTS)
npm run db:init
```

Le schéma est aussi appliqué automatiquement à chaque démarrage du serveur.

**Catalogue de démarrage** — peuple la base à partir des photos de `backend/images_demo/` :

```bash
npm run db:seed            # idempotent : n'ajoute que ce qui manque
npm run db:seed -- --force # réapplique aussi noms, prix, tailles et photos des produits existants
```

- Chaque photo est prise en compte : les vues d'un même modèle (`nom.jpg`, `nom_1.jpg`, `nom_2.jpg`)
  deviennent les images d'un seul produit (25 produits / 39 photos), copiées dans `uploads/products/`.
- Les photos atelier / fondatrice sont enregistrées comme visuels de marque (table `MediaAsset`,
  route publique `GET /api/v1/media`) et affichées par l'accueil et « Notre histoire ».
- Noms FR/EN, descriptions, catégories, prix, couleurs et tailles : `backend/scripts/seed-demo.data.js`
  (à ajuster avant le seed si besoin). Une photo ajoutée sans fiche dans ce fichier est créée
  en **brouillon** avec un nom déduit du fichier, pour qu'aucune image ne soit ignorée.
- Le dossier `images_demo/` doit donc être déployé avec le backend (au moins pour ce premier seed).
`npm run db:reset` **efface toutes les données** : ne jamais l'exécuter en production.

### 2.4 Premier administrateur

1. Créez un compte depuis le site (`/fr/compte/connexion`, email + mot de passe ou téléphone).
2. Promouvez-le :

```bash
npm run user:make-admin -- admin@exemple.com
```

3. Déconnectez-vous puis reconnectez-vous (le rôle est inscrit dans le token).
   Les rôles suivants se gèrent ensuite dans **Admin › Paramètres › Utilisateurs & rôles**.

### 2.5 Fichiers uploadés

Les images produits sont stockées dans `backend/uploads/products/` et servies sous
`/uploads/...`. Ce dossier doit :
- être **persistant** (hors du dossier de build, inclus dans les sauvegardes) ;
- être accessible en écriture par l'utilisateur qui exécute Node.

### 2.6 Démarrage (PM2)

```bash
cd /var/www/kemi_shoes/backend
pm2 start src/server.js --name kemi-api --time
pm2 save && pm2 startup
```

Vérification : `curl https://api-kemishoes.nexa-digitallab.com/health` → `{"status":"ok"}`.

---

## 3. Frontend (Next.js en mode standalone)

`next.config.ts` contient `output: "standalone"` : le build produit un dossier
`.next/standalone/` autonome (un `server.js` + uniquement les `node_modules` nécessaires).
Le script `scripts/standalone.mjs` y copie `public/` et `.next/static/`, ce qui le rend
déployable tel quel, sans `npm install` sur le serveur.

### 3.1 Variables d'environnement

| Variable | Moment de lecture | Rôle |
|----------|-------------------|------|
| `NEXT_PUBLIC_BACKEND_API_URL` | **au build** (injectée dans le JS navigateur) | URL de l'API appelée par le navigateur |
| `BACKEND_API_URL` | à l'exécution (serveur Next) | URL de l'API pour le rendu serveur (catalogue, pages légales). Peut être une URL interne, ex. `http://127.0.0.1:4000/api/v1` |
| `PORT` / `HOSTNAME` | à l'exécution | Port et interface d'écoute de `server.js` (`3000`, `0.0.0.0`) |

Fichiers fournis :
- `frontend/.env.production` — utilisé automatiquement par `next build` (URL de l'API de prod en https) ;
- `frontend/.env.development` — utilisé par `next dev` (API locale) ;
- `frontend/.env.example` — modèle documenté.

> Toute modification de `NEXT_PUBLIC_BACKEND_API_URL` impose de **refaire le build**.
> Le domaine de l'API sert aussi à autoriser les images produits dans l'optimiseur
> d'images (`images.remotePatterns`), lui aussi figé au build.

### 3.2 Build

Le build peut se faire sur le serveur ou sur une machine/CI de même OS et architecture
(le dossier standalone embarque des dépendances natives : ne construisez pas sous Windows
pour déployer sous Linux).

```bash
cd frontend
npm ci
npm run build:standalone
```

Résultat : `frontend/.next/standalone/` (contient `server.js`, `public/`, `.next/static/`).

### 3.3 Déploiement

```bash
# Depuis la machine de build
rsync -a --delete frontend/.next/standalone/ user@serveur:/var/www/kemi_shoes/frontend-standalone/

# Sur le serveur
cd /var/www/kemi_shoes/frontend-standalone
BACKEND_API_URL=http://127.0.0.1:4000/api/v1 PORT=3000 HOSTNAME=127.0.0.1 \
  pm2 start server.js --name kemi-web --time
pm2 save
```

Test local du build standalone : `npm run start:standalone` (depuis `frontend/`).

---

## 4. Paiement CamPay

### 4.1 Fonctionnement intégré

| Moyen | Parcours |
|-------|----------|
| Mobile Money (MTN / Orange) | `POST /orders` → l'API appelle `POST /collect/` de CamPay → le client valide sur son téléphone (code USSD affiché) → le site interroge `GET /payments/:orderId/status` toutes les 4 s → commande passée en **CONFIRMED** dès que CamPay renvoie `SUCCESSFUL`. |
| Carte bancaire | `POST /orders` → l'API crée un lien de paiement CamPay (`/get_payment_link/`) → redirection vers la page CamPay → retour sur `/fr/commande/suivi?order=…` qui suit le statut. |
| Paiement à la livraison | Aucun appel CamPay ; confirmation manuelle dans l'admin. |

Un paiement échoué peut être relancé depuis la page de suivi (`POST /payments/:orderId/retry`,
limité à 5 essais / 10 min). Le statut est toujours **re-vérifié côté serveur auprès de CamPay**
(polling et webhook), jamais déduit de ce que renvoie le navigateur.

### 4.2 Phase de test (compte demo)

Configuration actuelle de `backend/.env.production` : `CAMPAY_BASE_URL=https://demo.campay.net/api`
et `CAMPAY_MAX_AMOUNT_XAF=25` (le compte demo refuse plus de 25 XAF par transaction ;
le site affiche alors « Mode test CamPay : le montant débité est plafonné à 25 FCFA »).

Numéros de test CamPay (aucune transaction réelle) :

| Numéro | Opérateur | Résultat simulé |
|--------|-----------|-----------------|
| `237677777777` | MTN | PENDING → SUCCESSFUL |
| `237677777770` | MTN | PENDING → FAILED |
| `237699999999` | Orange | PENDING → SUCCESSFUL |
| `237699999990` | Orange | PENDING → FAILED |

Dans le champ « Numéro Mobile Money » du checkout, `677777777` ou `+237 677 77 77 77` sont acceptés
(normalisés en `237677777777`). En demo, CamPay renvoie un montant de `0.00` pour ces numéros :
le contrôle du montant payé n'est donc appliqué qu'en live.

Scénario de recette :
1. Créer une zone de livraison (Admin › Livraison) avec Mobile Money et carte activés, puis un produit actif.
2. Commander avec `677777777` → la confirmation affiche « Paiement en attente » puis « Paiement confirmé » ; la commande passe en *Confirmée* dans l'admin.
3. Commander avec `677777770` → « Paiement échoué » → saisir `699999999` et « Relancer le paiement » → confirmé.
4. Commander par carte → redirection vers `demo.campay.net/pay/...` → retour sur la page de suivi.
5. Admin › Paiement doit afficher CamPay « Mode test (demo) », webhook « configuré ».

> Le paiement par carte ne fonctionne pas avec `FRONTEND_URL=http://localhost:3000` :
> CamPay rejette les URL de retour non publiques (`Invalid redirect_url`). En local, utilisez
> un tunnel https (ex. `cloudflared tunnel --url http://localhost:3000`) et renseignez son URL
> dans `FRONTEND_URL`.

### 4.3 Webhook

Dans le tableau de bord CamPay (Applications › votre application), renseignez :

```
https://api-kemishoes.nexa-digitallab.com/api/v1/payments/campay/webhook
```

La route accepte GET et POST, vérifie la signature JWT (HS256) avec `CAMPAY_WEBHOOK_KEY`, puis
re-vérifie la transaction via l'API CamPay avant de mettre à jour la commande. Sans webhook, le
polling depuis le navigateur suffit pour le Mobile Money, mais le webhook garantit la mise à jour
même si le client ferme la page.

### 4.4 Passage en production (Go Live)

1. Cliquer sur **Go Live** dans le tableau de bord CamPay demo et attendre la validation.
2. Récupérer les **nouveaux** identifiants live (token, username/password, clé webhook) sur `www.campay.net`.
3. Dans `backend/.env` :
   ```
   CAMPAY_BASE_URL=https://www.campay.net/api
   CAMPAY_ACCESS_TOKEN=<token live>
   CAMPAY_USERNAME=<username live>
   CAMPAY_APP_PASSWORD=<mot de passe live>
   CAMPAY_WEBHOOK_KEY=<clé webhook live>
   ```
   et **supprimer** la ligne `CAMPAY_MAX_AMOUNT_XAF`.
4. Reconfigurer l'URL de webhook sur l'application live.
5. `pm2 restart kemi-api` puis vérifier Admin › Paiement : CamPay doit être « Connecté ».
6. Faire une vraie transaction de faible montant pour valider.

---

## 5. Nginx + HTTPS

`/etc/nginx/sites-available/kemishoes` :

```nginx
server {
    server_name kemishoes.nexa-digitallab.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    server_name api-kemishoes.nexa-digitallab.com;
    client_max_body_size 10m;   # upload d'images produits (5 Mo max chacune)
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # Métriques Prometheus : l'API exige déjà un jeton ADMIN (Authorization: Bearer …) ;
    # on les garde en plus hors d'Internet.
    location /metrics { allow 127.0.0.1; deny all; proxy_pass http://127.0.0.1:4000; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/kemishoes /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d kemishoes.nexa-digitallab.com -d api-kemishoes.nexa-digitallab.com
```

L'API fait confiance au premier proxy (`trust proxy = 1`) : IP clientes correctes pour le rate limiting.

---

## 6. OAuth Google / Facebook (optionnel)

URL de redirection autorisées à déclarer chez Google / Meta :

```
https://api-kemishoes.nexa-digitallab.com/api/v1/auth/oauth/google/callback
https://api-kemishoes.nexa-digitallab.com/api/v1/auth/oauth/facebook/callback
```

Après connexion, l'API redirige vers `FRONTEND_URL/fr/compte/connexion#accessToken=…` ; le site
enregistre la session puis ouvre l'espace compte. Les boutons n'apparaissent que si le fournisseur
est configuré (`GET /auth/providers`).

---

## 7. Mise à jour de l'application

```bash
# API
cd /var/www/kemi_shoes/backend && git pull && npm ci --omit=dev && pm2 restart kemi-api
# Site : rebuild puis redéploiement du dossier standalone
cd frontend && npm ci && npm run build:standalone
rsync -a --delete .next/standalone/ user@serveur:/var/www/kemi_shoes/frontend-standalone/
ssh user@serveur "pm2 restart kemi-web"
```

---

## 8. Vérifications après déploiement

- [ ] `https://api-kemishoes.nexa-digitallab.com/health` répond `{"status":"ok"}`
- [ ] Le catalogue s'affiche (rendu serveur → `BACKEND_API_URL` correcte)
- [ ] Pas d'erreur CORS dans la console navigateur (`CORS_ORIGINS` = domaine exact du site, sans `/` final)
- [ ] Connexion admin, upload d'une image produit, image visible sur la boutique
- [ ] Commande Mobile Money test (§4.2) confirmée automatiquement
- [ ] Emails de confirmation reçus (SMTP)
- [ ] `pm2 status` : `kemi-api` et `kemi-web` en ligne ; `pm2 logs` sans erreur

## 9. Dépannage

| Symptôme | Cause probable |
|----------|----------------|
| Le serveur API s'arrête avec « Configuration invalide » | Variable d'env manquante ou mal formée (le détail est affiché) |
| `Invalid redirect_url` (carte) | `FRONTEND_URL` non public / non https |
| Paiement Mobile Money bloqué en attente | Client n'a pas validé sur son téléphone ; webhook non configuré ; vérifier `pm2 logs kemi-api` (`campay_request_failed`) |
| Montant refusé par CamPay en demo | `CAMPAY_MAX_AMOUNT_XAF` absent (limite 25 XAF) |
| Images produits cassées | `NEXT_PUBLIC_BACKEND_API_URL` différent du domaine réel lors du build, ou dossier `uploads/` non persistant |
| Appels API bloqués « mixed content » | URL de l'API en `http://` alors que le site est en `https://` |
| Suppression d'un produit refusée (409) | Produit présent dans des commandes : le passer en brouillon |

---

## Annexe — Routes de l'API et écrans qui les consomment

Préfixe : `/api/v1`. 🔒 = token requis, 👑 = ADMIN / PRODUCT_MANAGER, 👑👑 = ADMIN uniquement.

| Route | Écran frontend |
|-------|----------------|
| `POST /auth/register`, `POST /auth/login` | Connexion (email / mot de passe) |
| `POST /auth/otp/request`, `POST /auth/otp/verify` | Connexion par téléphone, page Vérification |
| `POST /auth/refresh` | Automatique (renouvellement de session, `lib/backend-api.ts`) |
| `GET /auth/providers` *(nouvelle)* | Connexion : affichage des boutons Google / Facebook |
| `GET /auth/oauth/google`, `/facebook` (+ callbacks) | Boutons OAuth (callback redirigé vers le site) |
| 🔒 `GET /auth/me` | Espace compte |
| 🔒 `PATCH /auth/me` *(nouvelle)* | Compte › Mes informations (nom, email) |
| 🔒 `DELETE /auth/me` *(nouvelle)* | Compte › Supprimer mon compte |
| 🔒 `GET/POST /addresses`, `PATCH/DELETE /addresses/:id` *(nouvelles)* | Compte › Adresses enregistrées |
| `GET /products`, `GET /products/slug/:slug` | Accueil, boutique, fiche produit |
| 👑 `GET /products/:id`, `POST`, `PATCH /products/:id` | Admin › Produits (édition) |
| 👑 `DELETE /products/:id` | Admin › Produits › Supprimer |
| 👑 `PATCH /products/:id/sizes` | Admin › Produits › Disponibilité immédiate des tailles |
| 👑 `POST /products/upload-image` | Admin › Produits › Photos |
| `GET /delivery-zones` | Checkout, Admin › Livraison / Paiement |
| `GET /delivery-zones/:id` | Compte › détail commande (délai estimé) |
| 👑 `POST/PATCH/DELETE /delivery-zones` | Admin › Livraison |
| `POST /orders` | Checkout |
| 🔒 `GET /orders/me` | Compte › Mes commandes |
| 🔒 `GET /orders/:id` | Compte › détail commande, Admin › Commandes |
| 👑 `GET /orders`, `PATCH /orders/:id/status`, `PATCH /orders/:id/note` | Admin › Commandes |
| `GET /payments/:orderId/status` *(nouvelle)* | Confirmation de commande, page `/commande/suivi` |
| `POST /payments/:orderId/confirm` *(nouvelle)* | Retour de la page carte CamPay (`?reference=`) |
| `POST /payments/:orderId/retry` *(nouvelle)* | Relancer un paiement échoué |
| 👑 `GET /payments/providers` *(nouvelle)* | Admin › Paiement |
| `GET|POST /payments/campay/webhook` *(nouvelle)* | Appelée par CamPay uniquement |
| `GET /reviews/product/:productId`, `GET …/summary`, `POST /reviews` | Fiche produit › Avis |
| 👑 `GET /reviews`, `PATCH /reviews/:id/moderate` | Admin › Avis clients |
| `GET /content`, `GET /content/:slug` | Admin › Contenu, pages CGV / Mentions légales / Confidentialité |
| 👑 `PUT /content/:slug` | Admin › Contenu & traductions |
| 👑 `GET /dashboard/kpis`, `/top-products`, `/alerts` | Admin › Vue d'ensemble |
| 🔒 `GET /notifications`, `PATCH /notifications/:id/read` | En-tête du site (cloche) |
| 👑 `GET /users` *(nouvelle)* | Admin › Clients, Admin › Paramètres |
| 👑👑 `PATCH /users/:id/role` *(nouvelle)* | Admin › Paramètres › Utilisateurs & rôles |
| `GET /settings` *(nouvelle)* | Pied de page (WhatsApp, réseaux, adresse) |
| 👑👑 `PUT /settings` *(nouvelle)* | Admin › Paramètres › Informations boutique |
| `GET /media` *(nouvelle)* | Accueil, « Notre histoire » (visuels de marque) |
| `GET /health` | Supervision (hors frontend) |
| 👑 `GET /metrics` | Supervision Prometheus — jeton d'un compte ADMIN requis |
| `POST /auth/logout`, `POST /auth/logout-all` *(nouvelles)* | Compte › Se déconnecter (révocation de la session côté serveur) |
