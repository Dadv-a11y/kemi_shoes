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
| `SMS_PROVIDER` / `WHATSAPP_PROVIDER` | non | Envoi des codes OTP (`backend/src/modules/notifications/sms/README.md`). Défaut en production : `none` → la connexion par téléphone est masquée sur le site. `console` (code affiché dans la console) est réservé au développement et refusé en production |
| `COOKIE_SAMESITE` | non | `lax` (défaut) si le site et l'API partagent le même domaine parent (ex. `kemishoes.com` et `api.kemishoes.com`) ; `none` si l'API est sur un domaine sans rapport (impose HTTPS) |
| `COOKIE_DOMAIN` | non | Domaine des cookies de session (vide = domaine de l'API, recommandé) |
| `COOKIE_SECURE` | non | `true` par défaut en production (cookies uniquement en HTTPS) |
| `AUTH_RATE_LIMIT` | non | Tentatives de connexion / OTP par IP et par 15 min (`10`) |
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

**Sessions en cookies.** Les jetons de connexion sont des cookies `HttpOnly` posés par l'API
(`kemi_at`, envoyé à toute l'API ; `kemi_rt`, limité à `/api/v1/auth`) : le JavaScript du site n'y a
jamais accès. Le site appelle l'API avec `credentials: "include"` ; `CORS_ORIGINS` doit donc contenir
l'origine exacte du site, et les requêtes qui modifient des données depuis une autre origine sont
refusées (protection CSRF).

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

### 2.7 Hébergement mutualisé : cPanel › « Setup Node.js App » (Passenger)

| Réglage | Valeur |
|---|---|
| Version de Node.js | 22 ou plus (24 testé) |
| Mode | `Production` |
| Application root | `apps/kemishoes/api` (dossier du backend) |
| Application URL | le domaine (ou sous-domaine) de l'API |
| **Application startup file** | **`app.cjs`** (et non `src/server.js`) |
| Variables d'environnement | celles du §2.2, dont `LOG_DIR`. Bouton **Save**, puis **Restart** |

- **Pourquoi `app.cjs`** : Passenger charge son fichier de démarrage avec `require()`, impossible pour un projet en ES modules
  qui utilise `await` au niveau racine. `app.cjs` charge `src/server.js` par `import()` et, si le chargement échoue,
  écrit la cause (module manquant, configuration invalide, base injoignable) dans `LOG_DIR/kemishoes-fatal.log`.
- **Ne pas coder de port** : le serveur lit `PORT`, et Passenger redirige l'écoute vers sa propre socket.
- **Dépendances** : `Run NPM Install` depuis l'interface cPanel (le dossier `node_modules` est un lien vers l'environnement virtuel, c'est normal).
- **Droits des fichiers** : dossiers `0755`, fichiers `0644`. Les `0777` / `0666` produits par certains outils d'extraction de zip
  sont refusés par certaines protections d'hébergeur :
  `cd ~/apps/kemishoes/api && find . -path ./node_modules -prune -o -type d -exec chmod 755 {} + && find . -path ./node_modules -prune -o -type f -exec chmod 644 {} +`
- **Message « check availability of application has failed » après `Run NPM Install`** : cPanel appelle l'URL de l'application
  avant puis après l'opération et compare les réponses. Le message veut dire que la réponse « après » était une erreur
  (code 500 = page d'erreur de Passenger, l'application n'a pas démarré). Il faut alors chercher la cause réelle (ci-dessous) ;
  `npm start` en console fonctionne même si Passenger échoue, car l'environnement n'est pas le même.
- **`AH01276: Cannot serve directory …/public_html/<app>/: No matching DirectoryIndex`** (journal d'erreurs cPanel) :
  à ce moment-là Apache servait le dossier comme un dossier ordinaire, **Passenger n'était pas actif sur cette URL**
  (application arrêtée, ou `.htaccess` du dossier sans les lignes `Passenger…`). Vérifier que l'application est « Started »
  dans « Setup Node.js App », et que `public_html/<app>/.htaccess` (fichier caché : activer « Afficher les fichiers cachés »
  dans les paramètres du gestionnaire de fichiers) contient `PassengerAppRoot`, `PassengerAppType node` et `PassengerStartupFile app.cjs`.
- **Où lire la cause d'un démarrage raté** : (1) `LOG_DIR/kemishoes-fatal.log` ; (2) `stderr.log` dans le dossier de l'application ;
  (3) cPanel › Métriques › Erreurs. Si **aucun** de ces fichiers ne contient de ligne datée du démarrage, Passenger n'a pas
  exécuté `app.cjs` : le nom du fichier de démarrage ou le dossier racine de l'application est mal renseigné.
- **`ERR_MODULE_NOT_FOUND : Cannot find package 'xxx' … Did you mean to import "xxx/index.js"`** dans `kemishoes-fatal.log` :
  Node ne trouve pas une dépendance alors que `npm start` fonctionne. Le « Did you mean » signifie que le paquet est
  trouvable en CommonJS mais pas en ES module : installation incomplète (`package.json` du paquet absent ou illisible)
  ou lien `node_modules` incorrect. Diagnostic dans l'environnement virtuel Node.js (commande « source … /activate »
  affichée en haut de la page de l'application) :
  ```bash
  cd ~/apps/kemishoes/api && npm run check:install
  ```
  Le contrôle liste chaque paquet défaillant et les commandes de réparation (`rm -rf node_modules/<paquet>` puis
  `npm install --omit=dev`). Ne supprimez jamais `node_modules` lui-même (c'est un lien vers l'environnement virtuel) :
  utilisez « Run NPM Install » si le lien est cassé.
- **Vérification finale** : `https://<domaine>/health` → `{"status":"ok"}` et `https://<domaine>/` → « KEMI SHOES API — en ligne. ».

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

## 7. Logs et supervision

### 7.1 Principe

| Élément | Où | Rôle |
|---|---|---|
| **Pino** | backend | Une ligne JSON par événement : requêtes HTTP (méthode, route, statut, durée, utilisateur), erreurs avec pile d'appels, requêtes lentes, démarrage/arrêt, audit |
| **pino-roll** | backend | Écrit dans `LOG_DIR/kemishoes.<date>.<n>.log` : nouveau fichier chaque jour ou au-delà de `LOG_MAX_SIZE` |
| Maintenance intégrée | backend | Au démarrage puis toutes les 6 h : compression `.gz` des fichiers passés, suppression au-delà de `LOG_RETENTION_DAYS` (14 j). Aucun cron requis |
| `kemishoes-fatal.log` | backend | Plantages écrits de façon synchrone (configuration invalide, base injoignable, exception non gérée) : visibles même si le processus s'arrête aussitôt |
| Écran **Supervision** | `/fr/supervision` | Réservé au rôle **DEV** : logs (filtres, recherche par référence, suivi en direct, détail avec pile d'appels), santé du serveur, journal d'audit, fichiers (téléchargement, purge) |
| Alertes e-mail | backend | Première erreur 500 envoyée tout de suite, les suivantes regroupées au plus toutes les `ALERT_THROTTLE_MINUTES` |
| Erreurs du frontend | Vercel + navigateurs | Erreurs JavaScript des visiteurs (source « Navigateur ») et erreurs de rendu du serveur Next (source « Serveur Next », via `instrumentation.ts`) remontées dans les mêmes logs |

Chaque réponse de l'API porte un en-tête `X-Request-Id` ; une erreur 500 affiche
« Une erreur interne est survenue (référence 7f3a…) ». Saisir cette référence dans
**Supervision › Logs › Référence** affiche toute la trace de la requête.

### 7.2 Variables

| Variable | Défaut | Description |
|---|---|---|
| `LOG_DIR` | `logs` (dans le dossier de l'application) | **Chemin absolu recommandé, hors de `public_html`**, ex. `/home/<compte>/kemishoes-logs` |
| `LOG_LEVEL` | `info` | `debug` pour un diagnostic ponctuel |
| `LOG_TO_FILE` | `true` | `false` pour n'écrire qu'en console |
| `LOG_MAX_SIZE` / `LOG_RETENTION_DAYS` | `20m` / `14` | Taille maximale d'un fichier, conservation |
| `SLOW_REQUEST_MS` | `1000` | Seuil des requêtes lentes |
| `ALERT_EMAILS` | vide | Destinataires des alertes, séparés par des virgules (vide = e-mails des comptes DEV). Nécessite le SMTP |
| `ALERT_THROTTLE_MINUTES` | `15` | Fenêtre de regroupement des alertes |
| `LOG_INGEST_KEY` | vide | Secret partagé (≥ 16 caractères) avec le frontend pour remonter les erreurs du serveur Next. **Même valeur côté Vercel** (`LOG_INGEST_KEY`, variable serveur, sans `NEXT_PUBLIC_`) |

### 7.3 Hébergement mutualisé (cPanel « Setup Node.js App »)

- Passenger ne conserve pas la sortie console : les fichiers de `LOG_DIR` sont la source de vérité.
- Créez le dossier (`mkdir -p ~/kemishoes-logs`) et renseignez `LOG_DIR` dans les variables de l'application cPanel.
- Gardez **une seule instance** de l'application (réglage par défaut) : plusieurs processus écriraient en même temps dans le même fichier.
- En cas d'échec au démarrage (page Passenger « Web application could not be started »), lisez `kemishoes-fatal.log`
  via le gestionnaire de fichiers cPanel, ou le `stderr.log` de l'application.

### 7.4 Accès de l'équipe technique

```bash
# le compte doit d'abord être créé depuis le site, puis :
npm run user:set-role -- dev@exemple.com DEV
```

Un administrateur peut aussi attribuer le rôle depuis **Admin › Paramètres › Utilisateurs & rôles**.
À la connexion, un compte DEV arrive directement sur `/fr/supervision` (il n'a pas accès au back-office,
et un administrateur n'a pas accès à la supervision).

### 7.5 Plus tard sur un VPS : Grafana + Loki

Les logs sont déjà au format attendu par Loki. Il suffit d'ajouter Promtail, qui lit les mêmes fichiers :

```yaml
# promtail.yml
scrape_configs:
  - job_name: kemishoes
    static_configs:
      - targets: [localhost]
        labels: { job: kemishoes, __path__: /home/<compte>/kemishoes-logs/kemishoes*.log }
    pipeline_stages:
      - json: { expressions: { level: level, source: source, requestId: requestId } }
      - labels: { level: , source: }
```

L'écran Supervision reste utilisable en parallèle ; aucune modification du code n'est nécessaire.

## 8. Mise à jour de l'application

```bash
# API
cd /var/www/kemi_shoes/backend && git pull && npm ci --omit=dev && pm2 restart kemi-api
# Site : rebuild puis redéploiement du dossier standalone
cd frontend && npm ci && npm run build:standalone
rsync -a --delete .next/standalone/ user@serveur:/var/www/kemi_shoes/frontend-standalone/
ssh user@serveur "pm2 restart kemi-web"
```

---

## 9. Vérifications après déploiement

- [ ] `https://api-kemishoes.nexa-digitallab.com/health` répond `{"status":"ok"}`
- [ ] Le catalogue s'affiche (rendu serveur → `BACKEND_API_URL` correcte)
- [ ] Pas d'erreur CORS dans la console navigateur (`CORS_ORIGINS` = domaine exact du site, sans `/` final)
- [ ] Connexion admin, upload d'une image produit, image visible sur la boutique
- [ ] Commande Mobile Money test (§4.2) confirmée automatiquement
- [ ] Emails de confirmation reçus (SMTP)
- [ ] `pm2 status` : `kemi-api` et `kemi-web` en ligne ; `pm2 logs` sans erreur

## 10. Dépannage

| Symptôme | Cause probable |
|----------|----------------|
| Le serveur API s'arrête avec « Configuration invalide » | Variable d'env manquante ou mal formée (le détail est affiché) |
| `Invalid redirect_url` (carte) | `FRONTEND_URL` non public / non https |
| Paiement Mobile Money bloqué en attente | Client n'a pas validé sur son téléphone ; webhook non configuré ; vérifier `pm2 logs kemi-api` (`campay_request_failed`) |
| Montant refusé par CamPay en demo | `CAMPAY_MAX_AMOUNT_XAF` absent (limite 25 XAF) |
| Erreur 500 sans explication | Relever la référence affichée (ou l'en-tête `X-Request-Id`), puis **Supervision › Logs › Référence** : pile d'appels complète. Si l'API ne démarre pas du tout : `kemishoes-fatal.log` dans `LOG_DIR` |
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
| 🛠 `GET /monitoring/logs`, `/logs/files`, `/logs/files/:name`, `/health`, `/audit` ; `DELETE /logs/files/:name` ; `POST /logs/purge` *(nouvelles)* | Supervision (rôle DEV) |
| `POST /monitoring/client-errors` *(nouvelle)* | Remontée des erreurs navigateur et serveur Next |
| `POST /auth/logout`, `POST /auth/logout-all` *(nouvelles)* | Compte › Se déconnecter (révocation de la session côté serveur) |
