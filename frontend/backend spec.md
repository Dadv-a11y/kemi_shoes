# KEMI SHOES — Spécifications Back-end

> **Destinataire : agent de code.** Ce document est la source de vérité pour construire le back-end de la plateforme e-commerce KEMI SHOES.
> **Méthode imposée : Test-Driven Development (TDD) + Security by Design.**
> **Version :** 1.0 — 21 septembre 2026 — **Auteur :** Nexa Digital Lab

---

## 0. Règles d'or pour l'agent

1. **Aucun code de production sans test qui échoue d'abord** (Red → Green → Refactor). Chaque commit de feature contient le test ET l'implémentation.
2. **Travaille lot par lot** (section 18). Ne commence pas un lot tant que le précédent n'est pas *Done* (section 19).
3. **Ne jamais faire confiance au client** : prix, totaux, rôles, propriétaire d'une ressource, statut de paiement sont toujours recalculés/vérifiés côté serveur.
4. **Aucun secret dans le code ni dans les logs.** Tout passe par des variables d'environnement validées au démarrage (Zod).
5. **Toute route est protégée par défaut** (deny by default). Une route publique doit être déclarée explicitement dans la table de la section 9.
6. **Toute entrée est validée** (Zod) : body, query, params, headers utiles. Toute sortie passe par un DTO (jamais d'entité Prisma brute renvoyée).
7. **En cas d'ambiguïté**, choisis l'option la plus sûre, documente-la dans `docs/DECISIONS.md` (ADR courts) et continue.
8. **Langue** : code, noms de fichiers, commits en anglais ; messages d'erreur destinés à l'utilisateur final en **français** (avec `code` machine stable en anglais) ; documentation en français.

---

## 1. Contexte, périmètre et hypothèses

**KEMI SHOES** est une boutique en ligne de chaussures ciblant le marché camerounais (devise **XAF / FCFA**, paiement **Mobile Money** prépondérant). Le back-end expose une **API REST JSON** consommée par le front (site web/app) et un **espace d'administration**.

### 1.1 Hypothèses (à contredire si nécessaire — sinon les appliquer)

| # | Hypothèse |
|---|-----------|
| H1 | Stack : **Node.js 22 LTS + TypeScript (strict) + Express 5 + Prisma + PostgreSQL 16 + Redis 7** |
| H2 | Monnaie unique : **XAF**, stockée en **entier** (pas de décimales) |
| H3 | Paiements : **Mobile Money (MTN MoMo / Orange Money)** via un agrégateur (Campay ou CinetPay) derrière une interface `PaymentProvider` + **paiement à la livraison (COD)** |
| H4 | Le checkout **exige un compte client** (pas de checkout invité en v1) ; le **panier invité** est autorisé et fusionné à la connexion |
| H5 | Livraison par **zones/villes** avec tarifs fixes par zone (pas de transporteur externe en v1) |
| H6 | Produits avec **variantes** (pointure × couleur), stock géré **par variante** |
| H7 | Stockage des images : bucket **S3-compatible** (Cloudflare R2 / MinIO en dev) |
| H8 | Emails transactionnels via SMTP/API (Resend ou Nodemailer) ; SMS OTP optionnel (interface `SmsProvider`) |
| H9 | Hébergement : conteneurs Docker sur VPS (Linux) derrière un reverse proxy TLS (Caddy/Nginx) |
| H10 | Langue des contenus : français (champ prêt pour i18n, non implémenté en v1) |

### 1.2 Hors périmètre v1
Marketplace multi-vendeurs, avis avec photos, programme de fidélité, transporteurs tiers, multi-devises, checkout invité.

---

## 2. Principes directeurs

| Principe | Application concrète |
|----------|----------------------|
| **TDD** | Pyramide de tests (section 14), seuils de couverture bloquants en CI |
| **Security by Design** | Menaces modélisées (section 13), OWASP API Top 10 couvert, RBAC deny-by-default |
| **Architecture en couches** | `route → middleware → controller → service → repository → DB` |
| **12-Factor** | Config par env, logs sur stdout (JSON), process stateless, jobs séparés |
| **Idempotence** | Création de commande, paiement et webhooks idempotents |
| **Observabilité** | Logs structurés + métriques Prometheus + traces OpenTelemetry + erreurs Sentry |
| **Simplicité** | Pas de sur-ingénierie : monolithe modulaire, extraction en services seulement si nécessaire |

---

## 3. Stack technique & dépendances

### 3.1 Dépendances de production

| Paquet | Rôle |
|--------|------|
| `express@5` | Framework HTTP (gestion native des erreurs async) |
| `typescript` | (dev) langage — mode `strict` |
| `@prisma/client` | ORM / accès PostgreSQL |
| `zod` | Validation des entrées + validation des variables d'env |
| `argon2` | Hash des mots de passe (argon2id) |
| `jose` | JWT (signature EdDSA/ES256, rotation de clés via `kid`) |
| `cookie-parser` | Lecture des cookies (refresh token) |
| `helmet` | En-têtes de sécurité HTTP |
| `cors` | CORS avec liste blanche stricte |
| `hpp` | Protection contre la pollution de paramètres HTTP |
| `compression` | Compression gzip/brotli |
| `express-rate-limit` + `rate-limit-redis` | Rate limiting distribué |
| `express-slow-down` | Ralentissement progressif (anti brute force) |
| `ioredis` | Client Redis (cache, rate limit, sessions, verrous) |
| `bullmq` | Jobs asynchrones (emails, expirations, webhooks sortants) |
| `pino` + `pino-http` | Logs JSON structurés + logs de requêtes avec `requestId` |
| `prom-client` | Métriques Prometheus (`/metrics`) |
| `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http` | Traces distribuées |
| `@sentry/node` | Capture d'erreurs + performance |
| `multer` | Upload multipart (en mémoire, limites strictes) |
| `sharp` | Traitement d'images (redimensionnement, conversion WebP, suppression EXIF) |
| `file-type` | Détection réelle du type MIME (magic bytes) |
| `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | Stockage objets S3/R2 |
| `nodemailer` (ou `resend`) | Emails transactionnels |
| `otplib` + `qrcode` | 2FA TOTP pour les comptes administrateurs |
| `libphonenumber-js` | Validation/normalisation des numéros (Cameroun +237) |
| `slugify` | Slugs produits/catégories |
| `pdfkit` | Génération des factures PDF |
| `@asteasolutions/zod-to-openapi` + `swagger-ui-express` | Documentation OpenAPI générée depuis les schémas Zod |
| `ulid` (ou `uuid`) | Identifiants publics non devinables / `requestId` |
| `date-fns` | Manipulation de dates |

### 3.2 Dépendances de développement / qualité / sécurité

| Paquet / outil | Rôle |
|----------------|------|
| `vitest`, `@vitest/coverage-v8` | Runner de tests + couverture |
| `supertest` | Tests HTTP d'intégration |
| `@testcontainers/postgresql`, `@testcontainers/redis` | Vraie DB/Redis éphémères pour les tests d'intégration |
| `@faker-js/faker` | Données de test |
| `msw` (ou `nock`) | Mock des APIs externes (paiement, SMS, email) |
| `tsx` | Exécution TS en dev |
| `prisma` | CLI migrations / génération client |
| `eslint`, `typescript-eslint`, `eslint-plugin-security`, `eslint-plugin-import`, `eslint-plugin-n` | Lint + règles de sécurité |
| `prettier` | Formatage |
| `husky`, `lint-staged` | Hooks pre-commit |
| `dependency-cruiser` | Vérifier les règles d'architecture (pas d'import controller → repository, etc.) |
| `knip` | Détection de code/dépendances inutilisés |
| `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` | Mutation testing (modules critiques : auth, rbac, orders, payments) |
| `@types/*` | Typages |
| **Outils CI (hors npm)** | `gitleaks` (secrets), `trivy` (image Docker + deps), `npm audit --omit=dev`, `OWASP ZAP baseline` (DAST en staging), `k6` (tests de charge) |

### 3.3 Commandes d'installation de référence

```bash
npm i express@5 @prisma/client zod argon2 jose cookie-parser helmet cors hpp compression \
  express-rate-limit rate-limit-redis express-slow-down ioredis bullmq pino pino-http prom-client \
  @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http \
  @sentry/node multer sharp file-type @aws-sdk/client-s3 @aws-sdk/s3-request-presigner nodemailer \
  otplib qrcode libphonenumber-js slugify pdfkit @asteasolutions/zod-to-openapi swagger-ui-express ulid date-fns

npm i -D typescript tsx prisma vitest @vitest/coverage-v8 supertest @testcontainers/postgresql \
  @testcontainers/redis @faker-js/faker msw eslint typescript-eslint eslint-plugin-security \
  eslint-plugin-import eslint-plugin-n prettier husky lint-staged dependency-cruiser knip \
  @stryker-mutator/core @stryker-mutator/vitest-runner \
  @types/node @types/express @types/cookie-parser @types/cors @types/compression @types/multer \
  @types/supertest @types/nodemailer @types/pdfkit @types/swagger-ui-express @types/qrcode
```

> Versions : épingler les versions exactes (`--save-exact`) et committer `package-lock.json`. Renovate/Dependabot activé (mises à jour hebdomadaires groupées).

---

## 4. Architecture

### 4.1 Style
**Monolithe modulaire** en couches. Chaque module (`auth`, `catalog`, `cart`, `orders`, …) contient ses propres routes, contrôleurs, services, repositories, schémas Zod et tests. Les modules communiquent via les **services** (jamais en accédant aux repositories d'un autre module).

```
Requête → [requestId] → [logger] → [helmet/cors/hpp] → [rate limit] → [auth: JWT] → [rbac: permission]
        → [validate: Zod] → controller → service → repository (Prisma) → DB
        ← [response mapper (DTO)] ← [error handler global (RFC 7807)]
```

### 4.2 Arborescence des dossiers et fichiers

```
kemi-shoes-api/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # lint, typecheck, tests, coverage, audit, trivy, gitleaks
│       └── deploy.yml                # build image, migrate, deploy, smoke test
├── .husky/
│   └── pre-commit                    # lint-staged + typecheck + tests unitaires rapides
├── docs/
│   ├── DECISIONS.md                  # ADR
│   ├── THREAT_MODEL.md               # modèle de menaces (STRIDE)
│   ├── RUNBOOK.md                    # exploitation, incidents, rollback, restauration
│   └── openapi.json                  # généré (ne pas éditer)
├── monitoring/
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── alert.rules.yml
│   ├── alertmanager/alertmanager.yml
│   ├── grafana/
│   │   ├── provisioning/{datasources,dashboards}/*.yml
│   │   └── dashboards/{api-overview,business,infra,queues}.json
│   ├── loki/loki-config.yml
│   └── promtail/promtail-config.yml
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                       # rôles, permissions, matrice RBAC, super admin initial, zones de livraison
├── scripts/
│   ├── generate-openapi.ts
│   ├── create-admin.ts               # création sécurisée du premier SUPER_ADMIN
│   └── rotate-jwt-keys.ts
├── src/
│   ├── main.ts                       # bootstrap : env → otel → sentry → db → redis → http → graceful shutdown
│   ├── app.ts                        # createApp(deps) — construit Express SANS écouter (testable)
│   ├── worker.ts                     # process séparé pour BullMQ
│   ├── config/
│   │   ├── env.ts                    # schéma Zod des variables d'env (fail fast)
│   │   ├── constants.ts
│   │   ├── cors.ts
│   │   ├── rate-limits.ts            # toutes les politiques de rate limiting (section 11)
│   │   └── permissions.ts            # liste typée des permissions (source unique)
│   ├── infra/
│   │   ├── db/prisma.ts              # client Prisma singleton + extension métriques
│   │   ├── cache/redis.ts
│   │   ├── queue/{queues.ts,connection.ts}
│   │   ├── storage/s3.ts             # StorageProvider
│   │   ├── mail/{mailer.ts,templates/*.hbs|tsx}
│   │   ├── sms/sms.provider.ts
│   │   ├── payments/
│   │   │   ├── payment.provider.ts   # interface PaymentProvider
│   │   │   ├── campay.provider.ts
│   │   │   ├── cinetpay.provider.ts
│   │   │   └── fake.provider.ts      # utilisé en test/dev
│   │   └── observability/
│   │       ├── logger.ts             # pino + redaction
│   │       ├── metrics.ts            # prom-client registry + métriques métier
│   │       ├── tracing.ts            # OpenTelemetry
│   │       └── sentry.ts
│   ├── shared/
│   │   ├── errors/{app-error.ts,error-codes.ts,error-handler.ts}
│   │   ├── http/{response.ts,pagination.ts,problem.ts}
│   │   ├── middlewares/
│   │   │   ├── request-id.ts
│   │   │   ├── http-logger.ts
│   │   │   ├── security-headers.ts
│   │   │   ├── rate-limit.ts         # factory basée sur config/rate-limits.ts
│   │   │   ├── authenticate.ts       # vérifie JWT → req.auth
│   │   │   ├── authorize.ts          # requirePermission('product:create')
│   │   │   ├── require-2fa.ts
│   │   │   ├── validate.ts           # validate({ body, query, params })
│   │   │   ├── idempotency.ts        # header Idempotency-Key
│   │   │   ├── upload.ts             # multer + contrôles fichiers
│   │   │   ├── not-found.ts
│   │   │   └── metrics.ts            # histogramme durée/route
│   │   ├── utils/{crypto.ts,money.ts,slug.ts,phone.ts,dates.ts}
│   │   └── types/{express.d.ts,common.ts}
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── token.service.ts      # access/refresh, rotation, détection de réutilisation
│   │   │   ├── password.service.ts   # argon2id, politique de mot de passe
│   │   │   ├── twofa.service.ts
│   │   │   ├── auth.repository.ts
│   │   │   ├── auth.schemas.ts       # Zod
│   │   │   ├── auth.dto.ts
│   │   │   └── __tests__/{unit,integration}/
│   │   ├── users/                    # profil, adresses, admin users
│   │   ├── rbac/                     # rôles, permissions, cache des permissions, gestion des rôles
│   │   ├── catalog/                  # products, variants, images, categories, brands, collections, search
│   │   ├── inventory/                # stock, mouvements, réservations
│   │   ├── cart/
│   │   ├── wishlist/
│   │   ├── shipping/                 # zones, tarifs
│   │   ├── coupons/
│   │   ├── checkout/                 # devis (quote)
│   │   ├── orders/                   # machine d'états, factures
│   │   ├── payments/                 # initiation, statut, remboursements, webhooks
│   │   ├── reviews/
│   │   ├── newsletter/
│   │   ├── contact/
│   │   ├── admin/                    # stats, audit-logs, settings
│   │   ├── health/                   # /health/live, /health/ready, /metrics
│   │   └── audit/                    # service d'audit (écriture des actions sensibles)
│   ├── jobs/
│   │   ├── processors/{email.job.ts,order-expiration.job.ts,stock-release.job.ts,cleanup-tokens.job.ts,low-stock-alert.job.ts,webhook-retry.job.ts}
│   │   └── schedulers.ts             # tâches répétées (cron BullMQ)
│   └── routes.ts                     # monte tous les routers sous /api/v1
├── tests/
│   ├── setup/{global-setup.ts,test-env.ts,containers.ts}
│   ├── factories/                    # user, product, variant, order… (builders)
│   ├── helpers/{auth.helper.ts,db.helper.ts,request.helper.ts}
│   ├── security/                     # tests transverses (IDOR, injections, JWT, headers, mass assignment)
│   ├── contract/                     # conformité OpenAPI
│   ├── e2e/                          # parcours complets (achat, remboursement…)
│   └── load/                         # scripts k6
├── Dockerfile
├── docker-compose.yml                # api, worker, postgres, redis, minio, mailpit (dev)
├── docker-compose.monitoring.yml     # prometheus, grafana, loki, promtail, alertmanager, exporters
├── .dockerignore  .gitignore  .nvmrc  .env.example  .env.test
├── .gitleaks.toml
├── eslint.config.mjs  .prettierrc  .dependency-cruiser.cjs  knip.json
├── tsconfig.json  tsconfig.build.json
├── vitest.config.ts  vitest.integration.config.ts  stryker.config.mjs
└── package.json
```

### 4.3 Règles de dépendances (vérifiées par `dependency-cruiser` en CI)

- `routes → controller → service → repository` uniquement dans ce sens.
- Un **controller** ne contient aucune logique métier ni aucun appel Prisma : il parse la requête validée, appelle un service, mappe vers un DTO, répond.
- Un **service** ne connaît pas `req`/`res`. Il lève des `AppError` typées.
- Un **repository** est le seul à importer Prisma. Il ne contient pas de règles métier.
- Un module ne peut importer que les **services publics** d'un autre module (via `index.ts`).
- `infra/*` implémente des interfaces déclarées côté module (inversion de dépendance) → tests avec fakes.

### 4.4 Conventions API

- **Préfixe et version** : `/api/v1`. Format JSON, `Content-Type: application/json`.
- **Succès** : `{ "data": <objet|liste>, "meta": { "page", "limit", "total", "totalPages" } }` (`meta` seulement pour les listes).
- **Erreurs (RFC 7807, `application/problem+json`)** :

```json
{
  "type": "https://api.kemishoes.com/errors/validation",
  "title": "Données invalides",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "Certains champs sont invalides.",
  "requestId": "01J...",
  "errors": [{ "field": "email", "message": "Adresse email invalide", "code": "invalid_string" }]
}
```

- **Codes HTTP** : `200, 201, 204, 400, 401, 403, 404, 409, 410, 413, 415, 422, 423, 429, 500, 502, 503`.
- **Pagination** : `?page=1&limit=20` (limite max 50 ; 100 en admin). Tri : `?sort=-createdAt`. Tri autorisé via **liste blanche** par ressource.
- **Idempotence** : header `Idempotency-Key` (ULID/UUID) **obligatoire** sur `POST /orders` et `POST /payments/initiate`. Réponse rejouée à l'identique pendant 24 h (stockée en DB/Redis, clé + hash du body).
- **Identifiants exposés** : `id` public = ULID/UUID (jamais d'entier séquentiel). Numéro de commande lisible : `KS-YYMMDD-XXXXXX` (partie aléatoire, non séquentielle).
- **Dates** : ISO 8601 UTC. **Montants** : entiers XAF (`priceXaf`).
- **Headers de réponse** : `X-Request-Id`, `RateLimit-*` (draft standard), `Cache-Control: no-store` sur toutes les routes authentifiées.

---

## 5. Fichiers de configuration (contenu attendu)

### 5.1 `package.json` — scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "dev:worker": "tsx watch src/worker.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js",
    "start:worker": "node dist/worker.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "arch:check": "depcruise src --config .dependency-cruiser.cjs",
    "deadcode": "knip",
    "test": "vitest run --config vitest.config.ts",
    "test:watch": "vitest --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:security": "vitest run tests/security --config vitest.integration.config.ts",
    "test:e2e": "vitest run tests/e2e --config vitest.integration.config.ts",
    "test:cov": "vitest run --coverage",
    "test:mutation": "stryker run",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "openapi": "tsx scripts/generate-openapi.ts",
    "audit": "npm audit --omit=dev --audit-level=high",
    "ci": "npm run lint && npm run typecheck && npm run arch:check && npm run test:cov && npm run test:integration && npm run audit"
  }
}
```

### 5.2 `tsconfig.json`
`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `target: ES2023`, `module: NodeNext`, `moduleResolution: NodeNext`, `esModuleInterop: true`, `skipLibCheck: true`, `sourceMap: true`, alias `@/* → src/*`.

### 5.3 `src/config/env.ts` — validation fail-fast

```ts
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z.string().transform(s => s.split(',').map(x => x.trim())),
  TRUST_PROXY: z.coerce.number().default(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ISSUER: z.string(),
  JWT_AUDIENCE: z.string(),
  JWT_PRIVATE_KEY_PEM: z.string().min(100),   // EdDSA / ES256
  JWT_PUBLIC_KEYS_JSON: z.string(),           // { kid: pem } pour rotation
  JWT_ACTIVE_KID: z.string(),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  COOKIE_DOMAIN: z.string().optional(),
  // ... (voir tableau 5.4)
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && env.CORS_ALLOWED_ORIGINS.includes('*')) {
    ctx.addIssue({ code: 'custom', message: 'CORS wildcard interdit en production' });
  }
});
export const env = schema.parse(process.env); // crash au démarrage si invalide
```

### 5.4 `.env.example` — variables

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NODE_ENV` | Environnement | `production` |
| `PORT` | Port HTTP | `3000` |
| `APP_URL` / `FRONTEND_URL` | URLs publiques | `https://api.kemishoes.com` |
| `CORS_ALLOWED_ORIGINS` | Origines autorisées (CSV) | `https://kemishoes.com,https://admin.kemishoes.com` |
| `TRUST_PROXY` | Nb de proxys de confiance | `1` |
| `DATABASE_URL` | PostgreSQL (utilisateur applicatif à privilèges minimaux) | `postgresql://app:***@db:5432/kemi` |
| `DATABASE_MIGRATION_URL` | Utilisateur dédié aux migrations | idem |
| `REDIS_URL` | Redis | `redis://:***@redis:6379` |
| `JWT_*` | Clés, `kid`, TTL | voir 5.3 |
| `COOKIE_DOMAIN`, `COOKIE_SECURE` | Cookies refresh | `.kemishoes.com`, `true` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `CDN_BASE_URL` | Stockage images | — |
| `SMTP_URL` ou `RESEND_API_KEY`, `MAIL_FROM` | Emails | `no-reply@kemishoes.com` |
| `PAYMENT_PROVIDER` | `campay` \| `cinetpay` \| `fake` | `campay` |
| `PAYMENT_API_KEY`, `PAYMENT_API_SECRET`, `PAYMENT_WEBHOOK_SECRET` | Agrégateur paiement | — |
| `PAYMENT_WEBHOOK_IP_ALLOWLIST` | IPs autorisées (CSV, optionnel) | — |
| `SMS_PROVIDER`, `SMS_API_KEY` | SMS OTP (optionnel) | — |
| `ORDER_PAYMENT_TTL_MIN` | Durée de réservation avant expiration | `30` |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` | Sentry | — |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | Traces | `kemi-shoes-api` |
| `LOG_LEVEL` | `info` en prod | `info` |
| `METRICS_BASIC_AUTH_USER`, `METRICS_BASIC_AUTH_PASS` | Protection `/metrics` | — |
| `ADMIN_BOOTSTRAP_EMAIL` | Création du 1er SUPER_ADMIN (via script) | — |

> `.env.example` ne contient **jamais** de vraie valeur. `.env*` (sauf `.example`) dans `.gitignore`.

### 5.5 `Dockerfile` (multi-stage, durci)
- Étape `deps` (`npm ci`), `build` (`tsc` + `prisma generate`), `runtime` (image `node:22-alpine` ou distroless).
- Utilisateur **non-root** (`USER node`), `NODE_ENV=production`, `HEALTHCHECK` sur `/api/v1/health/live`, système de fichiers en lecture seule si possible, pas de devDependencies, `tini` comme init (signaux/graceful shutdown).

### 5.6 `docker-compose.yml` (dev/test local)
Services : `api`, `worker`, `postgres:16`, `redis:7`, `minio` (S3), `mailpit` (SMTP de test). Volumes nommés, healthchecks, ports liés à `127.0.0.1`.

### 5.7 `eslint.config.mjs`
`typescript-eslint` strict + `eslint-plugin-security` + règles : `no-floating-promises`, `no-misused-promises`, `no-explicit-any` (error), `eqeqeq`, `no-eval`, `no-console` (utiliser le logger), `import/no-cycle`, interdiction d'importer `@prisma/client` hors `repository`/`infra`.

### 5.8 `vitest.config.ts`
- Unitaires : environnement `node`, `include: src/**/*.unit.test.ts`, mocks des repositories.
- Intégration : `vitest.integration.config.ts` avec `globalSetup` qui lance Postgres+Redis via Testcontainers, applique `prisma migrate deploy`, exécute en `pool: 'forks'` avec isolation (schéma ou transaction par test).
- **Seuils de couverture (bloquants)** : global ≥ **85 %** lignes/branches ; modules `auth`, `rbac`, `orders`, `payments`, `inventory` ≥ **95 %**.

### 5.9 `.github/workflows/ci.yml`
Jobs : `lint+typecheck+arch` → `unit` → `integration (services postgres/redis)` → `security tests` → `coverage gate` → `npm audit` → `gitleaks` → `docker build + trivy scan` → (main) `deploy`. Cache npm. Échec si vulnérabilité `HIGH/CRITICAL` non résolue.

### 5.10 Hooks Git
`.husky/pre-commit` : `lint-staged` (eslint + prettier) puis `npm run typecheck`. `pre-push` : `npm test`. `commit-msg` : Conventional Commits.

---

## 6. Modèle de données (Prisma / PostgreSQL)

> Tous les modèles : `id` (ULID/UUID), `createdAt`, `updatedAt`. Montants en `Int` (XAF). Suppression logique (`deletedAt`) pour produits, catégories, marques. Index sur toutes les clés étrangères et champs filtrés/triés.

### 6.1 Identité & RBAC

| Table | Colonnes principales | Contraintes / notes |
|-------|----------------------|---------------------|
| `users` | `email` (unique, lower), `emailVerifiedAt`, `phone` (unique nullable, E.164), `passwordHash`, `firstName`, `lastName`, `status` (`ACTIVE`,`SUSPENDED`,`DELETED`), `failedLoginCount`, `lockedUntil`, `lastLoginAt`, `twoFactorSecretEnc`, `twoFactorEnabled`, `tokenVersion` | `tokenVersion` incrémenté pour invalider tous les JWT |
| `roles` | `name` (unique), `description`, `isSystem` | Rôles système non supprimables |
| `permissions` | `key` (unique, ex. `product:create`), `resource`, `action`, `description` | Source : `config/permissions.ts` (synchronisé par le seed) |
| `role_permissions` | `roleId`, `permissionId` | PK composite |
| `user_roles` | `userId`, `roleId`, `assignedBy`, `assignedAt` | PK composite ; un client a au minimum `CUSTOMER` |
| `sessions` (refresh tokens) | `userId`, `familyId`, `tokenHash` (SHA-256), `userAgent`, `ipHash`, `expiresAt`, `revokedAt`, `replacedById`, `lastUsedAt` | Rotation + détection de réutilisation par `familyId` |
| `one_time_tokens` | `userId`, `type` (`EMAIL_VERIFY`,`PASSWORD_RESET`,`OTP_PHONE`), `tokenHash`, `expiresAt`, `usedAt`, `attempts` | Usage unique, expiration courte |
| `addresses` | `userId`, `label`, `recipientName`, `phone`, `city`, `district`, `street`, `landmark`, `isDefault` | Ownership vérifié à chaque accès |

### 6.2 Catalogue & stock

| Table | Colonnes principales |
|-------|----------------------|
| `brands` | `name`, `slug` (unique), `logoUrl`, `deletedAt` |
| `categories` | `name`, `slug` (unique), `parentId`, `position`, `deletedAt` |
| `collections` | `name`, `slug`, `description`, `isActive`, (`collection_products` N-N) |
| `products` | `name`, `slug` (unique), `description`, `brandId`, `categoryId`, `gender` (`MEN`,`WOMEN`,`KIDS`,`UNISEX`), `basePriceXaf`, `compareAtPriceXaf?`, `status` (`DRAFT`,`PUBLISHED`,`ARCHIVED`), `seoTitle`, `seoDescription`, `deletedAt`, `searchVector` (tsvector + index GIN) |
| `product_variants` | `productId`, `sku` (unique), `size` (ex. 40, 41…), `color`, `priceXaf?` (surcharge), `stockOnHand`, `stockReserved`, `lowStockThreshold`, `isActive` — **CHECK** `stockOnHand >= 0`, `stockReserved >= 0`, `stockReserved <= stockOnHand`, **UNIQUE** (`productId`,`size`,`color`) |
| `product_images` | `productId`, `variantId?`, `url`, `alt`, `position`, `width`, `height` |
| `inventory_movements` | `variantId`, `type` (`RESTOCK`,`SALE`,`RESERVE`,`RELEASE`,`ADJUSTMENT`,`RETURN`), `quantity`, `reason`, `orderId?`, `actorId?` (append-only) |

### 6.3 Achat

| Table | Colonnes principales |
|-------|----------------------|
| `carts` | `userId?`, `guestTokenHash?`, `couponId?`, `expiresAt` |
| `cart_items` | `cartId`, `variantId`, `quantity` (1..10) — UNIQUE (`cartId`,`variantId`) |
| `wishlist_items` | `userId`, `productId` — UNIQUE |
| `shipping_zones` | `name`, `cities[]`, `isActive` |
| `shipping_rates` | `zoneId`, `name`, `priceXaf`, `freeAboveXaf?`, `etaMinDays`, `etaMaxDays` |
| `coupons` | `code` (unique, upper), `type` (`PERCENT`,`FIXED`,`FREE_SHIPPING`), `value`, `minSubtotalXaf`, `maxDiscountXaf?`, `startsAt`, `endsAt`, `usageLimit`, `perUserLimit`, `usedCount`, `isActive` |
| `coupon_redemptions` | `couponId`, `userId`, `orderId` — UNIQUE (`couponId`,`orderId`) |
| `orders` | `number` (unique), `userId`, `status`, `subtotalXaf`, `discountXaf`, `shippingXaf`, `totalXaf`, `couponCode?`, `shippingAddress` (JSON **snapshot**), `paymentMethod`, `expiresAt`, `placedAt`, `paidAt?`, `cancelledAt?`, `idempotencyKey` (unique par user) |
| `order_items` | `orderId`, `variantId`, `productName`, `sku`, `size`, `color`, `unitPriceXaf` (**snapshot**), `quantity`, `lineTotalXaf` |
| `order_status_history` | `orderId`, `from`, `to`, `actorId?`, `reason?`, `at` (append-only) |
| `payments` | `orderId`, `provider`, `method` (`MTN_MOMO`,`ORANGE_MONEY`,`COD`), `amountXaf`, `status` (`INITIATED`,`PENDING`,`SUCCEEDED`,`FAILED`,`CANCELLED`,`REFUNDED`,`PARTIALLY_REFUNDED`), `providerRef` (unique), `payerPhoneMasked`, `failureReason?`, `rawResponse` (JSON, sans donnée sensible) |
| `refunds` | `paymentId`, `orderId`, `amountXaf`, `reason`, `status`, `providerRef?`, `actorId` |
| `shipments` | `orderId`, `carrier?`, `trackingNumber?`, `status`, `shippedAt`, `deliveredAt` |
| `reviews` | `productId`, `userId`, `orderItemId` (achat vérifié), `rating` 1..5, `title`, `body`, `status` (`PENDING`,`APPROVED`,`REJECTED`) — UNIQUE (`userId`,`productId`) |

### 6.4 Transverse

| Table | Colonnes principales |
|-------|----------------------|
| `idempotency_keys` | `key`, `userId?`, `route`, `requestHash`, `responseStatus`, `responseBody`, `expiresAt` — UNIQUE (`key`,`userId`,`route`) |
| `webhook_events` | `provider`, `eventId`, `signatureValid`, `payload`, `processedAt?`, `status` — UNIQUE (`provider`,`eventId`) (anti-rejeu) |
| `audit_logs` | `actorId?`, `actorRole`, `action`, `resource`, `resourceId`, `before` (JSON), `after` (JSON), `ipHash`, `userAgent`, `requestId`, `at` (append-only) |
| `newsletter_subscribers` | `email` (unique), `status`, `confirmedAt`, `unsubscribeTokenHash` |
| `contact_messages` | `name`, `email`, `subject`, `message`, `status`, `ipHash` |
| `settings` | `key` (unique), `value` (JSON) — ex. seuil franco de port, durée d'expiration, mode maintenance |

---

## 7. RBAC — rôles, permissions, matrice

### 7.1 Rôles

| Rôle | Description |
|------|-------------|
| `CUSTOMER` | Client connecté (rôle par défaut à l'inscription) |
| `SUPPORT` | Service client : lecture commandes/clients, notes, modération avis, annulation |
| `MANAGER` | Gestion catalogue, stock, commandes, coupons, livraison |
| `ADMIN` | Administration complète sauf gestion fine des rôles ; remboursements ; audit |
| `SUPER_ADMIN` | Tous droits, gestion des rôles/permissions, paramètres critiques |

### 7.2 Matrice permissions × rôles

Légende : ✅ autorisé · 🔒 seulement sur **ses propres** ressources (`own`) · ❌ interdit

| Permission | Description | CUSTOMER | SUPPORT | MANAGER | ADMIN | SUPER_ADMIN |
|------------|-------------|:-:|:-:|:-:|:-:|:-:|
| `product:read` | Lire le catalogue (public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `product:create` | Créer un produit | ❌ | ❌ | ✅ | ✅ | ✅ |
| `product:update` | Modifier produit/variantes/images | ❌ | ❌ | ✅ | ✅ | ✅ |
| `product:publish` | Publier / dépublier | ❌ | ❌ | ✅ | ✅ | ✅ |
| `product:delete` | Archiver / supprimer (soft) | ❌ | ❌ | ❌ | ✅ | ✅ |
| `taxonomy:manage` | Catégories, marques, collections | ❌ | ❌ | ✅ | ✅ | ✅ |
| `inventory:read` | Consulter le stock et les mouvements | ❌ | ✅ | ✅ | ✅ | ✅ |
| `inventory:adjust` | Ajuster le stock | ❌ | ❌ | ✅ | ✅ | ✅ |
| `cart:manage` | Gérer son panier | 🔒 | ❌ | ❌ | ❌ | ❌ |
| `wishlist:manage` | Gérer sa wishlist | 🔒 | ❌ | ❌ | ❌ | ❌ |
| `order:create` | Passer commande | ✅ | ❌ | ❌ | ❌ | ❌ |
| `order:read:own` | Lire ses commandes | 🔒 | ❌ | ❌ | ❌ | ❌ |
| `order:cancel:own` | Annuler sa commande (si `PENDING_*`) | 🔒 | ❌ | ❌ | ❌ | ❌ |
| `order:read` | Lire toutes les commandes | ❌ | ✅ | ✅ | ✅ | ✅ |
| `order:update_status` | Changer le statut (préparation, expédition, livraison) | ❌ | ❌ | ✅ | ✅ | ✅ |
| `order:cancel` | Annuler n'importe quelle commande | ❌ | ✅ | ✅ | ✅ | ✅ |
| `order:note` | Ajouter une note interne | ❌ | ✅ | ✅ | ✅ | ✅ |
| `payment:read` | Lire les paiements | ❌ | ✅ | ✅ | ✅ | ✅ |
| `payment:refund` | Rembourser | ❌ | ❌ | ❌ | ✅ | ✅ |
| `shipping:manage` | Zones et tarifs de livraison | ❌ | ❌ | ✅ | ✅ | ✅ |
| `coupon:read` | Lire les coupons | ❌ | ✅ | ✅ | ✅ | ✅ |
| `coupon:manage` | Créer/modifier/désactiver coupons | ❌ | ❌ | ✅ | ✅ | ✅ |
| `review:create` | Publier un avis (achat vérifié) | ✅ | ❌ | ❌ | ❌ | ❌ |
| `review:moderate` | Modérer les avis | ❌ | ✅ | ✅ | ✅ | ✅ |
| `user:read` | Lire les comptes clients | ❌ | ✅ | ❌ | ✅ | ✅ |
| `user:suspend` | Suspendre/réactiver un compte | ❌ | ❌ | ❌ | ✅ | ✅ |
| `user:assign_role` | Attribuer des rôles ≤ MANAGER | ❌ | ❌ | ❌ | ✅ | ✅ |
| `role:manage` | Créer rôles, modifier la matrice, attribuer ADMIN/SUPER_ADMIN | ❌ | ❌ | ❌ | ❌ | ✅ |
| `stats:read` | Tableaux de bord et statistiques | ❌ | ❌ | ✅ | ✅ | ✅ |
| `audit:read` | Consulter le journal d'audit | ❌ | ❌ | ❌ | ✅ | ✅ |
| `settings:manage` | Paramètres de la boutique | ❌ | ❌ | ❌ | ✅ | ✅ |
| `newsletter:read` | Lister/exporter les abonnés | ❌ | ❌ | ✅ | ✅ | ✅ |
| `contact:read` | Lire les messages de contact | ❌ | ✅ | ✅ | ✅ | ✅ |

### 7.3 Règles RBAC impératives

1. **Deny by default** : `authorize('x:y')` sur toute route protégée ; absence de permission ⇒ `403 FORBIDDEN`.
2. Les permissions d'un utilisateur = union des permissions de ses rôles, **cachées dans Redis** (TTL 5 min, invalidées à chaque changement de rôle/matrice) ; le JWT ne transporte que `sub`, `roles`, `tokenVersion`, jamais la liste complète des permissions.
3. Les permissions `🔒 own` sont contrôlées **dans le service** (`resource.userId === auth.userId`) → sinon **404** (et non 403) pour ne pas révéler l'existence de la ressource (anti-IDOR).
4. **Pas d'auto-élévation** : on ne peut pas modifier ses propres rôles ; on ne peut pas attribuer un rôle supérieur ou égal au sien (sauf `SUPER_ADMIN`).
5. Toujours **au moins un** `SUPER_ADMIN` actif (impossible de supprimer/rétrograder le dernier).
6. Rôles `MANAGER`, `ADMIN`, `SUPER_ADMIN` ⇒ **2FA TOTP obligatoire** (`require-2fa` sur toutes les routes `/admin/*`).
7. Toute modification RBAC et toute action admin sensible est écrite dans `audit_logs`.
8. Tests obligatoires : **un test par cellule ❌ critique** (matrice testée de façon paramétrée) + tests IDOR.

---

## 8. Authentification & sessions

| Élément | Spécification |
|---------|---------------|
| Hash mot de passe | **argon2id** (mémoire ≥ 19 MiB, t=2, p=1 ; à ajuster au serveur), pepper optionnel via env |
| Politique mot de passe | ≥ 10 caractères, refus des mots de passe courants (liste top 10 000) et de ceux contenant l'email |
| Access token | JWT signé **EdDSA/ES256** (`jose`), durée **15 min**, claims : `sub`, `roles`, `tv` (tokenVersion), `iss`, `aud`, `jti`, `kid` en header ; vérification stricte de `alg`, `iss`, `aud`, `exp` |
| Refresh token | Valeur **opaque aléatoire 256 bits**, stockée **hachée (SHA-256)**, cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, durée 30 j |
| Rotation | Chaque `/auth/refresh` émet un nouveau refresh et révoque l'ancien. **Réutilisation d'un refresh révoqué ⇒ révocation de toute la famille** + alerte de sécurité |
| Vérification email | Lien à usage unique (token haché, 24 h) — compte utilisable mais commande impossible tant que non vérifié |
| Reset mot de passe | Token à usage unique (30 min), invalide toutes les sessions, réponse **générique** (pas d'énumération d'emails) |
| Anti brute force | Rate limit par IP **et** par email ; après 5 échecs ⇒ verrouillage progressif (`lockedUntil`, 15 min puis doublé) ; comparaison en temps constant ; hash factice si utilisateur inconnu |
| 2FA | TOTP (`otplib`) obligatoire pour rôles admin ; secret chiffré au repos (AES-256-GCM, clé en env) ; 10 codes de secours hachés |
| Sessions | Liste/révocation des sessions actives (`/auth/sessions`) |
| Déconnexion globale | `tokenVersion++` + révocation de tous les refresh |
| CSRF | Refresh via cookie `SameSite=Strict` + vérification de l'en-tête `Origin` sur `/auth/*` ; access token en header `Authorization: Bearer` (non concerné par CSRF) |

---

## 9. Routes API

> Préfixe : `/api/v1`. **Auth** : `Public` = aucune ; `Auth` = JWT requis ; permission = `authorize()`. **RL** = politique de rate limiting (section 11). Toutes les routes `/admin/*` exigent JWT + 2FA + permission.
> Chaque ligne = une route + sa méthode de contrôleur. **Chaque route doit avoir ses tests (happy path, 401, 403, 404, 422, 429 le cas échéant).**

### 9.1 Santé & monitoring

| Méthode | Route | Auth | Controller.méthode | Description | RL |
|---------|-------|------|--------------------|-------------|----|
| GET | `/health/live` | Public | `HealthController.live` | Process vivant (sans dépendances) | `health` |
| GET | `/health/ready` | Public (réseau interne) | `HealthController.ready` | DB + Redis + queue joignables | `health` |
| GET | `/metrics` | Basic auth **ou** réseau interne uniquement | `MetricsController.expose` | Métriques Prometheus | `internal` |
| GET | `/docs` | Public en dev/staging ; `settings:manage` en prod (ou désactivé) | `DocsController.serve` | Swagger UI | `default` |

### 9.2 Auth (`AuthController`)

| Méthode | Route | Auth | Méthode contrôleur | Description | RL |
|---------|-------|------|--------------------|-------------|----|
| POST | `/auth/register` | Public | `register` | Inscription (rôle `CUSTOMER`) + email de vérification | `auth.register` |
| POST | `/auth/login` | Public | `login` | Retourne access token + pose cookie refresh ; 2FA si requis | `auth.login` |
| POST | `/auth/2fa/challenge` | Public (token temporaire) | `verifyTwoFactor` | Valide le code TOTP à la connexion | `auth.otp` |
| POST | `/auth/refresh` | Cookie | `refresh` | Rotation du refresh token | `auth.refresh` |
| POST | `/auth/logout` | Auth | `logout` | Révoque la session courante | `default` |
| POST | `/auth/logout-all` | Auth | `logoutAll` | Révoque toutes les sessions | `default` |
| POST | `/auth/verify-email` | Public | `verifyEmail` | Consomme le token de vérification | `auth.otp` |
| POST | `/auth/resend-verification` | Auth | `resendVerification` | Renvoie l'email | `auth.mail` |
| POST | `/auth/forgot-password` | Public | `forgotPassword` | Envoie le lien (réponse générique) | `auth.mail` |
| POST | `/auth/reset-password` | Public | `resetPassword` | Réinitialise via token | `auth.otp` |
| POST | `/auth/change-password` | Auth | `changePassword` | Ancien + nouveau mot de passe | `auth.sensitive` |
| POST | `/auth/2fa/setup` | Auth (admin) | `setupTwoFactor` | Génère secret + QR | `auth.sensitive` |
| POST | `/auth/2fa/verify` | Auth (admin) | `enableTwoFactor` | Active la 2FA + codes de secours | `auth.otp` |
| POST | `/auth/2fa/disable` | Auth + re-auth | `disableTwoFactor` | Désactive (interdit pour rôles admin) | `auth.sensitive` |
| GET | `/auth/sessions` | Auth | `listSessions` | Sessions actives | `default` |
| DELETE | `/auth/sessions/:id` | Auth (own) | `revokeSession` | Révoque une session | `default` |

### 9.3 Utilisateurs & adresses (`UserController`, `AddressController`)

| Méthode | Route | Auth / permission | Méthode contrôleur | Description | RL |
|---------|-------|-------------------|--------------------|-------------|----|
| GET | `/users/me` | Auth | `UserController.getMe` | Profil | `default` |
| PATCH | `/users/me` | Auth | `updateMe` | Nom, téléphone (whitelist de champs) | `default` |
| DELETE | `/users/me` | Auth + re-auth | `deleteMe` | Suppression/anonymisation du compte | `auth.sensitive` |
| GET | `/users/me/export` | Auth | `exportMyData` | Export des données personnelles (JSON) | `export` |
| GET | `/users/me/addresses` | Auth | `AddressController.list` | Mes adresses | `default` |
| POST | `/users/me/addresses` | Auth | `create` | Ajouter (max 10) | `default` |
| PATCH | `/users/me/addresses/:id` | Auth (own) | `update` | Modifier | `default` |
| DELETE | `/users/me/addresses/:id` | Auth (own) | `remove` | Supprimer | `default` |
| PUT | `/users/me/addresses/:id/default` | Auth (own) | `setDefault` | Adresse par défaut | `default` |
| GET | `/admin/users` | `user:read` | `AdminUserController.list` | Liste + filtres (email, statut, rôle) | `admin` |
| GET | `/admin/users/:id` | `user:read` | `getById` | Détail | `admin` |
| PATCH | `/admin/users/:id/status` | `user:suspend` | `updateStatus` | Suspendre/réactiver (+ révocation sessions) | `admin` |
| PUT | `/admin/users/:id/roles` | `user:assign_role` | `setRoles` | Attribuer des rôles (règles 7.3) | `admin.sensitive` |

### 9.4 RBAC (`RbacController`) — SUPER_ADMIN

| Méthode | Route | Permission | Méthode contrôleur | Description | RL |
|---------|-------|-----------|--------------------|-------------|----|
| GET | `/admin/rbac/roles` | `role:manage` | `listRoles` | Rôles + permissions | `admin` |
| POST | `/admin/rbac/roles` | `role:manage` | `createRole` | Créer un rôle personnalisé | `admin.sensitive` |
| PATCH | `/admin/rbac/roles/:id` | `role:manage` | `updateRole` | Modifier (rôles système protégés) | `admin.sensitive` |
| DELETE | `/admin/rbac/roles/:id` | `role:manage` | `deleteRole` | Supprimer (si non système et non utilisé) | `admin.sensitive` |
| PUT | `/admin/rbac/roles/:id/permissions` | `role:manage` | `setRolePermissions` | Définir les permissions du rôle | `admin.sensitive` |
| GET | `/admin/rbac/permissions` | `role:manage` | `listPermissions` | Catalogue des permissions | `admin` |

### 9.5 Catalogue public (`ProductController`, `CategoryController`, `BrandController`, `CollectionController`, `SearchController`)

| Méthode | Route | Auth | Méthode contrôleur | Description | RL |
|---------|-------|------|--------------------|-------------|----|
| GET | `/products` | Public | `ProductController.list` | Filtres : `q`, `category`, `brand`, `gender`, `size`, `color`, `priceMin`, `priceMax`, `inStock`, `sort`, `page`, `limit` (uniquement produits `PUBLISHED`) | `catalog` |
| GET | `/products/:slug` | Public | `getBySlug` | Détail + variantes + images + note moyenne | `catalog` |
| GET | `/products/:slug/related` | Public | `related` | Produits similaires | `catalog` |
| GET | `/categories` | Public | `CategoryController.tree` | Arbre des catégories | `catalog` |
| GET | `/categories/:slug` | Public | `getBySlug` | Détail | `catalog` |
| GET | `/brands` | Public | `BrandController.list` | Marques | `catalog` |
| GET | `/collections` | Public | `CollectionController.list` | Collections actives | `catalog` |
| GET | `/collections/:slug` | Public | `getBySlug` | Détail + produits | `catalog` |
| GET | `/search/suggestions` | Public | `SearchController.suggest` | Autocomplétion (`q` ≥ 2 car.) | `search` |

### 9.4 Catalogue admin (`AdminProductController`, …)

| Méthode | Route | Permission | Méthode contrôleur | Description | RL |
|---------|-------|-----------|--------------------|-------------|----|
| GET | `/admin/products` | `product:update` | `list` | Tous statuts | `admin` |
| POST | `/admin/products` | `product:create` | `create` | Création (brouillon) | `admin` |
| GET | `/admin/products/:id` | `product:update` | `getById` | Détail complet | `admin` |
| PATCH | `/admin/products/:id` | `product:update` | `update` | Mise à jour (whitelist) | `admin` |
| DELETE | `/admin/products/:id` | `product:delete` | `remove` | Archivage (soft delete) | `admin` |
| POST | `/admin/products/:id/publish` | `product:publish` | `publish` | Publie (exige ≥1 variante active + ≥1 image) | `admin` |
| POST | `/admin/products/:id/unpublish` | `product:publish` | `unpublish` | Dépublie | `admin` |
| POST | `/admin/products/:id/variants` | `product:update` | `AdminVariantController.create` | Ajoute une variante | `admin` |
| PATCH | `/admin/variants/:id` | `product:update` | `update` | Modifie SKU/prix/statut | `admin` |
| DELETE | `/admin/variants/:id` | `product:update` | `remove` | Désactive/supprime (si jamais commandée) | `admin` |
| POST | `/admin/products/:id/images` | `product:update` | `AdminImageController.upload` | Upload (multipart, max 8 images/req) | `upload` |
| PATCH | `/admin/products/:id/images/order` | `product:update` | `reorder` | Ordre des images | `admin` |
| DELETE | `/admin/images/:id` | `product:update` | `remove` | Supprime image (DB + objet S3) | `admin` |
| GET/POST/PATCH/DELETE | `/admin/categories[/:id]` | `taxonomy:manage` | `AdminCategoryController.list/create/update/remove` | CRUD catégories | `admin` |
| GET/POST/PATCH/DELETE | `/admin/brands[/:id]` | `taxonomy:manage` | `AdminBrandController.*` | CRUD marques | `admin` |
| GET/POST/PATCH/DELETE | `/admin/collections[/:id]` | `taxonomy:manage` | `AdminCollectionController.*` | CRUD collections (+ `PUT /:id/products`) | `admin` |

### 9.5 Stock (`InventoryController`)

| Méthode | Route | Permission | Méthode contrôleur | Description | RL |
|---------|-------|-----------|--------------------|-------------|----|
| GET | `/admin/inventory` | `inventory:read` | `list` | Stock par variante, filtre `lowStock=true` | `admin` |
| PATCH | `/admin/variants/:id/stock` | `inventory:adjust` | `adjust` | `{ delta, reason }` (raison obligatoire) → mouvement + audit | `admin` |
| GET | `/admin/inventory/movements` | `inventory:read` | `movements` | Historique (filtres variante/type/date) | `admin` |

### 9.6 Panier & wishlist (`CartController`, `WishlistController`)

> Panier invité : cookie `cart_token` (aléatoire 256 bits, `HttpOnly`, haché en base). Panier connecté : lié à l'utilisateur.

| Méthode | Route | Auth | Méthode contrôleur | Description | RL |
|---------|-------|------|--------------------|-------------|----|
| GET | `/cart` | Public (invité ou Auth) | `get` | Panier recalculé (prix + stock actuels) | `cart` |
| POST | `/cart/items` | Public/Auth | `addItem` | `{ variantId, quantity }` (vérifie stock et max 10) | `cart` |
| PATCH | `/cart/items/:itemId` | Public/Auth (own) | `updateItem` | Modifie la quantité | `cart` |
| DELETE | `/cart/items/:itemId` | Public/Auth (own) | `removeItem` | Retire | `cart` |
| DELETE | `/cart` | Public/Auth | `clear` | Vide | `cart` |
| POST | `/cart/merge` | Auth | `merge` | Fusionne le panier invité dans celui du compte | `cart` |
| POST | `/cart/coupon` | Public/Auth | `applyCoupon` | Applique un code | `coupon` |
| DELETE | `/cart/coupon` | Public/Auth | `removeCoupon` | Retire le code | `cart` |
| GET | `/wishlist` | Auth | `WishlistController.list` | Favoris | `default` |
| PUT | `/wishlist/:productId` | Auth | `add` | Ajoute (idempotent) | `default` |
| DELETE | `/wishlist/:productId` | Auth | `remove` | Retire | `default` |

### 9.7 Livraison & coupons

| Méthode | Route | Auth / permission | Méthode contrôleur | Description | RL |
|---------|-------|-------------------|--------------------|-------------|----|
| GET | `/shipping/rates` | Public | `ShippingController.rates` | `?city=` → tarifs et délais | `catalog` |
| GET/POST/PATCH/DELETE | `/admin/shipping/zones[/:id]` | `shipping:manage` | `AdminShippingController.*` | CRUD zones | `admin` |
| GET/POST/PATCH/DELETE | `/admin/shipping/rates[/:id]` | `shipping:manage` | `AdminShippingController.*` | CRUD tarifs | `admin` |
| POST | `/coupons/validate` | Auth | `CouponController.validate` | Vérifie un code pour le panier courant | `coupon` |
| GET | `/admin/coupons` | `coupon:read` | `AdminCouponController.list` | Liste | `admin` |
| POST | `/admin/coupons` | `coupon:manage` | `create` | Crée | `admin` |
| PATCH | `/admin/coupons/:id` | `coupon:manage` | `update` | Modifie / désactive | `admin` |
| DELETE | `/admin/coupons/:id` | `coupon:manage` | `remove` | Désactive (soft) | `admin` |

### 9.8 Checkout & commandes (`CheckoutController`, `OrderController`, `AdminOrderController`)

| Méthode | Route | Auth / permission | Méthode contrôleur | Description | RL |
|---------|-------|-------------------|--------------------|-------------|----|
| POST | `/checkout/quote` | Auth | `CheckoutController.quote` | Devis : sous-total, remise, livraison, total (serveur) | `checkout` |
| POST | `/orders` | Auth + `Idempotency-Key` | `OrderController.create` | Crée la commande, **réserve le stock** (transaction atomique), fige prix/adresse | `order.create` |
| GET | `/orders` | Auth (own) | `listMine` | Mes commandes (pagination) | `default` |
| GET | `/orders/:id` | Auth (own) | `getMine` | Détail (404 si pas propriétaire) | `default` |
| POST | `/orders/:id/cancel` | Auth (own) | `cancelMine` | Annule si statut le permet ; libère le stock | `order.create` |
| GET | `/orders/:id/invoice` | Auth (own) | `invoice` | Facture PDF (si payée) | `export` |
| GET | `/admin/orders` | `order:read` | `AdminOrderController.list` | Filtres : statut, dates, ville, numéro, email | `admin` |
| GET | `/admin/orders/:id` | `order:read` | `getById` | Détail + historique + paiements | `admin` |
| PATCH | `/admin/orders/:id/status` | `order:update_status` | `updateStatus` | Transition validée par la machine d'états | `admin` |
| POST | `/admin/orders/:id/cancel` | `order:cancel` | `cancel` | Annulation admin (+ remboursement si payée) | `admin.sensitive` |
| POST | `/admin/orders/:id/notes` | `order:note` | `addNote` | Note interne | `admin` |
| POST | `/admin/orders/:id/shipment` | `order:update_status` | `createShipment` | Expédition (transporteur/suivi) | `admin` |

### 9.9 Paiements (`PaymentController`, `WebhookController`)

| Méthode | Route | Auth / permission | Méthode contrôleur | Description | RL |
|---------|-------|-------------------|--------------------|-------------|----|
| POST | `/payments/initiate` | Auth + `Idempotency-Key` | `PaymentController.initiate` | `{ orderId, method, phone }` → demande de paiement Mobile Money | `payment` |
| GET | `/payments/:id/status` | Auth (own) | `getStatus` | Statut (interroge le provider si `PENDING`) | `payment.status` |
| POST | `/webhooks/payments/:provider` | **Signature HMAC** (pas de JWT) | `WebhookController.handle` | Notification du provider (anti-rejeu, idempotent) | `webhook` |
| GET | `/admin/payments` | `payment:read` | `AdminPaymentController.list` | Liste + filtres | `admin` |
| POST | `/admin/payments/:id/refund` | `payment:refund` | `refund` | Remboursement total/partiel | `admin.sensitive` |

### 9.10 Avis, newsletter, contact

| Méthode | Route | Auth / permission | Méthode contrôleur | Description | RL |
|---------|-------|-------------------|--------------------|-------------|----|
| GET | `/products/:slug/reviews` | Public | `ReviewController.listByProduct` | Avis approuvés + agrégat | `catalog` |
| POST | `/products/:slug/reviews` | Auth + `review:create` | `create` | Achat livré vérifié, 1 avis/produit, statut `PENDING` | `review` |
| PATCH | `/reviews/:id` | Auth (own) | `updateMine` | Modifie (repasse `PENDING`) | `review` |
| DELETE | `/reviews/:id` | Auth (own) | `removeMine` | Supprime | `review` |
| GET | `/admin/reviews` | `review:moderate` | `AdminReviewController.list` | File de modération | `admin` |
| PATCH | `/admin/reviews/:id/status` | `review:moderate` | `updateStatus` | Approuver/rejeter | `admin` |
| POST | `/newsletter/subscribe` | Public | `NewsletterController.subscribe` | Double opt-in | `newsletter` |
| GET | `/newsletter/confirm` | Public | `confirm` | Lien de confirmation (token) | `newsletter` |
| GET | `/newsletter/unsubscribe` | Public | `unsubscribe` | Désinscription (token) | `newsletter` |
| POST | `/contact` | Public | `ContactController.submit` | Message + honeypot + captcha optionnel | `contact` |
| GET | `/admin/contact-messages` | `contact:read` | `AdminContactController.list` | Messages | `admin` |
| GET | `/admin/newsletter/subscribers` | `newsletter:read` | `AdminNewsletterController.list` | Abonnés (export CSV protégé contre l'injection de formules) | `admin` |

### 9.11 Administration (`AdminStatsController`, `AuditController`, `SettingsController`)

| Méthode | Route | Permission | Méthode contrôleur | Description | RL |
|---------|-------|-----------|--------------------|-------------|----|
| GET | `/admin/stats/overview` | `stats:read` | `overview` | CA, commandes, panier moyen, nouveaux clients (période) | `admin` |
| GET | `/admin/stats/sales` | `stats:read` | `sales` | Série temporelle des ventes | `admin` |
| GET | `/admin/stats/top-products` | `stats:read` | `topProducts` | Meilleures ventes | `admin` |
| GET | `/admin/audit-logs` | `audit:read` | `AuditController.list` | Journal d'audit (filtres acteur/action/date) | `admin` |
| GET | `/admin/settings` | `settings:manage` | `SettingsController.get` | Paramètres | `admin` |
| PATCH | `/admin/settings` | `settings:manage` | `update` | Modifier (audité) | `admin.sensitive` |

### 9.12 Contrat d'un contrôleur (pattern imposé)

```ts
// src/modules/orders/order.controller.ts
export const createOrderController = (deps: { orderService: OrderService }) => ({
  create: async (req: Request, res: Response) => {
    const { body } = req.validated as { body: CreateOrderInput }; // Zod déjà appliqué par middleware
    const order = await deps.orderService.create({
      userId: req.auth!.userId,            // jamais depuis le body
      idempotencyKey: req.idempotencyKey!,
      input: body,
      requestId: req.id,
    });
    res.status(201).json({ data: toOrderDto(order) });
  },
});
```
Routes déclarées avec l'ordre des middlewares : `rateLimit → authenticate → authorize → validate → idempotency → controller`.

---

## 10. Validation & DTO

- Chaque route a un schéma Zod `{ params, query, body }` **strict** (`.strict()` : les champs inconnus sont rejetés → anti mass-assignment).
- Types dérivés (`z.infer`) partagés entre validation, service et tests. OpenAPI généré depuis ces schémas (`npm run openapi`) et **validé en CI** (contract tests).
- Normalisation : emails en minuscules/trim, téléphones en E.164 (+237…), chaînes trimées, longueurs maximales explicites (nom ≤ 120, description ≤ 5 000, etc.).
- Requêtes de liste : `limit` borné, `sort` en liste blanche, `q` ≤ 100 caractères.

---

## 11. Rate limiting — politiques

> Implémentation : `express-rate-limit` + `rate-limit-redis` (compteurs partagés entre instances) ; `express-slow-down` pour les endpoints d'auth. Clé = IP (via `trust proxy` correctement configuré) et/ou identifiant utilisateur/email haché. Réponse **429** au format RFC 7807 + headers `RateLimit-*` et `Retry-After`. Toutes les valeurs sont centralisées dans `src/config/rate-limits.ts`, testées (un test par politique) et exposées en métrique `rate_limited_total{limiter}`.

| Politique (`RL`) | Portée / clé | Limite | Fenêtre | Remarques |
|------------------|--------------|--------|---------|-----------|
| `default` | IP + user | 120 req | 1 min | Filet global |
| `global.burst` | IP | 300 req | 1 min | Plafond absolu toutes routes |
| `catalog` | IP | 200 req | 1 min | Lecture catalogue |
| `search` | IP | 60 req | 1 min | Autocomplétion |
| `cart` | IP + guestToken/user | 60 req | 1 min | |
| `coupon` | user (ou IP) | 10 req | 10 min | Anti-devinette de codes ; blocage 30 min après 10 échecs |
| `checkout` | user | 20 req | 10 min | Devis |
| `order.create` | user | 10 req | 10 min | + max 3 commandes `PENDING_PAYMENT` simultanées par utilisateur |
| `payment` | user | 5 req | 10 min | Initiation de paiement |
| `payment.status` | user | 60 req | 5 min | Polling du statut |
| `webhook` | IP provider | 300 req | 1 min | + signature obligatoire |
| `auth.register` | IP | 5 req | 1 h | |
| `auth.login` | IP **et** email | 5 req / 10 req | 15 min | Slow-down dès la 3ᵉ tentative ; verrouillage compte (section 8) |
| `auth.refresh` | IP + session | 30 req | 15 min | |
| `auth.otp` | IP + token | 5 req | 10 min | Vérif email/reset/2FA |
| `auth.mail` | IP **et** email | 3 req | 1 h | Forgot password / renvoi vérification |
| `auth.sensitive` | user | 5 req | 15 min | Changement mot de passe, 2FA, suppression compte |
| `review` | user | 10 req | 1 h | |
| `newsletter` | IP | 5 req | 1 h | |
| `contact` | IP | 5 req | 1 h | + honeypot |
| `upload` | user | 30 req | 1 h | + limites fichiers (section 13) |
| `export` | user | 5 req | 1 h | Facture PDF / export données |
| `admin` | user | 300 req | 1 min | |
| `admin.sensitive` | user | 30 req | 10 min | Rôles, remboursements, paramètres |
| `health` | IP | 60 req | 1 min | |
| `internal` | IP allowlist | illimité | — | `/metrics` |

**Comportement en cas de panne Redis** : *fail-closed* pour `auth.*` et `payment*` (429/503), *fail-open* avec alerte pour le catalogue.

---

## 12. Règles métier critiques

### 12.1 Machine d'états des commandes

```
PENDING_PAYMENT ──paiement OK──▶ PAID ──▶ PROCESSING ──▶ SHIPPED ──▶ DELIVERED ──▶ COMPLETED
      │  ├─ échec/expiration ──▶ EXPIRED / PAYMENT_FAILED
      │  └─ annulation ────────▶ CANCELLED
PENDING_CONFIRMATION (COD) ──confirmation──▶ PROCESSING ──▶ SHIPPED ──▶ DELIVERED (paiement encaissé) ──▶ COMPLETED
PAID | PROCESSING ──annulation admin──▶ CANCELLED (+ remboursement)
DELIVERED | COMPLETED ──remboursement──▶ REFUNDED | PARTIALLY_REFUNDED
```
- Transitions **uniquement** via `OrderStateMachine.transition(order, to, actor)` ; toute transition illégale ⇒ `409 INVALID_STATE_TRANSITION`.
- Chaque transition écrit `order_status_history` + audit + déclenche les effets (emails, libération/consommation de stock).

### 12.2 Stock (anti sur-vente)
1. **Réservation atomique** à la création de commande, dans **une transaction** :
   `UPDATE product_variants SET stockReserved = stockReserved + :q WHERE id = :id AND (stockOnHand - stockReserved) >= :q` → si 0 ligne modifiée ⇒ `409 OUT_OF_STOCK`.
2. **Paiement confirmé** ⇒ conversion réservation → vente (`stockOnHand -= q`, `stockReserved -= q`, mouvement `SALE`).
3. **Expiration / échec / annulation** ⇒ libération (`stockReserved -= q`, mouvement `RELEASE`).
4. Job `order-expiration` (chaque minute) expire les commandes `PENDING_PAYMENT` dépassant `ORDER_PAYMENT_TTL_MIN` (défaut 30 min) et libère le stock (idempotent, verrou Redis).
5. Test de concurrence obligatoire : N requêtes parallèles sur un stock de 1 ⇒ exactement 1 succès.

### 12.3 Calcul des prix
- Serveur = seule source de vérité : `subtotal = Σ (prix variante × quantité)`, remise coupon, livraison (zone/ville), `total`. Prix **figés** dans `order_items`.
- Coupon : validité (dates, `usageLimit`, `perUserLimit`, `minSubtotal`, plafond) vérifiée **dans la transaction de commande** (verrou) pour éviter la sur-utilisation.
- Arrondis : entiers XAF ; pourcentage arrondi à l'inférieur ; total ≥ 0.

### 12.4 Paiement
- Interface `PaymentProvider { initiate, getStatus, refund, verifyWebhook }` ; `FakeProvider` pour les tests.
- **Le webhook n'est jamais une preuve suffisante** : après vérification de signature + anti-rejeu (`webhook_events`), le service **re-interroge le provider** (`getStatus`) puis met à jour le paiement/la commande dans une transaction.
- Montant payé doit égaler `order.totalXaf` (sinon `PAYMENT_AMOUNT_MISMATCH` + alerte).
- Paiement idempotent : même `Idempotency-Key` ⇒ même résultat ; une commande ne peut avoir qu'un paiement `SUCCEEDED`.
- COD : commande `PENDING_CONFIRMATION`, confirmation par SUPPORT/MANAGER (appel client), plafond de montant COD configurable, encaissement enregistré à la livraison.
- Remboursement : total ou partiel, jamais supérieur au montant restant, permission `payment:refund`, audité.

### 12.5 Avis
- Uniquement si l'utilisateur a une commande `DELIVERED/COMPLETED` contenant le produit ; 1 avis / produit / utilisateur ; contenu échappé/nettoyé ; modération avant publication.

### 12.6 Données personnelles
- Suppression de compte = **anonymisation** (email/nom/téléphone remplacés, adresses supprimées), commandes conservées (obligations comptables) sans données directes.
- Minimisation : jamais de numéro de Mobile Money complet en clair dans les logs (masqué `6•• ••• •12`).

---

## 13. Security by Design

### 13.1 Modèle de menaces (à rédiger dans `docs/THREAT_MODEL.md` avant le lot 1, STRIDE)
Actifs : comptes clients, données de commande/adresses, intégrité des prix/stocks, flux de paiement, accès admin, secrets. Acteurs : visiteur anonyme, client malveillant, bot/scraper, admin compromis, provider de paiement usurpé, insider. Le document doit lister menace → contrôle → test qui la couvre.

### 13.2 Couverture OWASP API Security Top 10 (2023)

| Risque | Contrôles obligatoires | Test |
|--------|------------------------|------|
| API1 Broken Object Level Authorization | Vérification d'ownership dans chaque service ; 404 pour ressource d'autrui ; ULID non séquentiels | `tests/security/idor.test.ts` (paramétré sur toutes les routes `:id` `own`) |
| API2 Broken Authentication | Section 8 (argon2id, rotation refresh, lockout, 2FA admin, réponses génériques) | tests auth + JWT altéré/expiré/`alg=none`/mauvais `aud` |
| API3 Broken Object Property Level Authorization | DTO de sortie explicites, Zod `.strict()` à l'entrée, aucun champ sensible (`passwordHash`, etc.) exposé | test mass-assignment (`role`, `userId`, `priceXaf`, `status` dans le body) |
| API4 Unrestricted Resource Consumption | Rate limits (section 11), limites de body (100 KB JSON), pagination bornée, timeouts, limites d'upload, quotas jobs | tests 429 + payloads volumineux (413) |
| API5 Broken Function Level Authorization | RBAC deny-by-default, matrice testée cellule par cellule | test paramétré matrice 7.2 |
| API6 Unrestricted Access to Sensitive Business Flows | Idempotence, limites de commandes en attente, anti-abus coupons, verrouillage stock, captcha optionnel sur inscription/contact | tests métier abusifs |
| API7 SSRF | Aucune requête sortante vers une URL fournie par l'utilisateur ; allowlist des hôtes providers | test |
| API8 Security Misconfiguration | Helmet, CORS strict, `x-powered-by` désactivé, erreurs sans stack en prod, `/docs` et `/metrics` protégés, conteneur non-root | test headers + config prod |
| API9 Improper Inventory Management | OpenAPI = inventaire unique ; routes non documentées interdites (test de diff) ; versionnement `/v1` | contract test |
| API10 Unsafe Consumption of APIs | Validation stricte des réponses/webhooks des providers (Zod), timeouts, retries bornés, circuit breaker | tests avec `msw` |

### 13.3 Contrôles transverses

**HTTP**
- `helmet` (CSP `default-src 'none'` pour l'API, HSTS 1 an + preload, `noSniff`, `frameguard deny`, `referrerPolicy no-referrer`).
- CORS : liste blanche exacte depuis l'env, `credentials: true` uniquement pour ces origines, méthodes/headers explicites.
- `app.set('trust proxy', N)`, `hpp`, body parser limité (`100kb`), timeout de requête 30 s, `keepAliveTimeout` > timeout du proxy.
- Toute réponse d'erreur passe par le handler global : **jamais** de stack trace ni de message SQL vers le client.

**Données**
- Prisma uniquement (requêtes paramétrées). `$queryRaw` autorisé seulement avec `Prisma.sql` et revue ; recherche full-text via `tsvector`.
- Utilisateur DB applicatif **sans** droits DDL ; utilisateur de migration distinct ; connexions TLS en prod.
- Chiffrement au repos des secrets applicatifs (secret 2FA : AES-256-GCM). Hash en base pour tokens (refresh, reset, guest cart).
- Tables `audit_logs`, `inventory_movements`, `order_status_history` **append-only** (aucun UPDATE/DELETE côté application).
- Sauvegardes chiffrées quotidiennes (`pg_dump`) + copie hors-site, **test de restauration mensuel** documenté dans le RUNBOOK.

**Uploads**
- Types autorisés : JPEG, PNG, WebP (détection **magic bytes** via `file-type`, pas le `Content-Type` ni l'extension) ; 5 Mo max/fichier ; 8 fichiers max ; dimensions max 6000 px.
- Ré-encodage systématique avec `sharp` (supprime EXIF/métadonnées et payloads embarqués), noms aléatoires (ULID), bucket **privé** + CDN/URL signée, jamais de chemin fourni par le client.

**Secrets & supply chain**
- `gitleaks` en pre-commit et CI ; aucun secret en clair dans l'image Docker (`trivy`).
- `npm audit`, Dependabot/Renovate, versions exactes, `npm ci`, lockfile obligatoire ; scripts `postinstall` des dépendances examinés (`--ignore-scripts` en CI puis `npm rebuild` ciblé).
- SBOM généré (`cyclonedx-npm`) et archivé à chaque release.

**Logs & confidentialité**
- `pino` avec **redaction** : `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.token`, `*.refreshToken`, `*.phone` (masqué), `*.email` (masqué partiellement).
- IP stockées **hachées** (HMAC + sel) dans sessions/audit ; conservation des logs 30–90 jours.

**Anti-abus**
- Réponses génériques sur auth/forgot-password ; délai constant ; honeypot sur formulaires publics ; détection de comportements (trop d'échecs de coupon, de paiement) → métriques + alertes.

### 13.4 Tests de sécurité automatisés (`tests/security/`)
IDOR sur toutes les routes `own` · matrice RBAC complète · JWT (`alg=none`, signature invalide, expiré, mauvais `iss/aud`, `tv` obsolète) · réutilisation d'un refresh révoqué ⇒ famille révoquée · injections (SQL/NoSQL/XSS/HTML dans nom, avis, message de contact) · mass assignment · enumeration (login/forgot/register renvoient des réponses indiscernables) · webhook (signature invalide, rejeu, montant incohérent) · upload (faux JPEG, polyglotte, SVG, taille, extension double) · en-têtes de sécurité · 429 sur chaque politique · CORS (origine non autorisée refusée) · CSV injection sur exports.

---

## 14. Stratégie TDD

### 14.1 Cycle imposé
1. **Lister** les comportements attendus du lot (tests « todo » `it.todo`).
2. **Red** : écrire un test qui échoue (message clair).
3. **Green** : code minimal pour passer.
4. **Refactor** : nettoyer en gardant les tests verts ; `lint`, `typecheck`, `arch:check` verts.
5. Commit atomique (`test:` puis `feat:` ou un seul commit `feat:` contenant les deux).

### 14.2 Pyramide

| Niveau | Outils | Cible | Part |
|--------|--------|-------|------|
| **Unitaires** | Vitest, mocks/fakes des repositories et providers | services, machine d'états, calcul de prix, utils, politiques de rate limit | ~60 % |
| **Intégration** | Vitest + Supertest + Testcontainers (vrais Postgres/Redis) + `msw` | routes ↔ DB, transactions, concurrence stock, RBAC réel, webhooks | ~30 % |
| **Contrat** | OpenAPI généré vs réponses réelles | schémas de réponse | transverse |
| **E2E** | Parcours complets | inscription → panier → commande → paiement (FakeProvider) → livraison → avis ; remboursement ; expiration | ~5 % |
| **Sécurité** | section 13.4 | | transverse |
| **Charge** | k6 (staging) | catalogue, checkout, pic de webhooks | avant mise en prod |
| **Mutation** | Stryker | `auth`, `rbac`, `orders`, `payments`, `inventory` (score ≥ 70 %) | périodique |

### 14.3 Conventions de tests
- Nommage : `describe('POST /orders')` → `it('returns 409 OUT_OF_STOCK when ...')`. Un test = un comportement.
- **Isolation** : chaque test d'intégration démarre d'un état propre (truncate ou transaction rollback) ; pas d'ordre implicite entre tests.
- **Factories** (`tests/factories`) plutôt que fixtures figées ; horloge contrôlée (`vi.useFakeTimers`) pour expirations/TTL ; aléa contrôlé.
- Aucun appel réseau réel : providers de paiement/SMS/email = fakes ou `msw`.
- **Chaque route** est couverte par : succès · non authentifié (401) · interdit (403) · ressource d'autrui/inexistante (404) · validation (422) · conflit (409 si applicable) · rate limit (429).
- Exemple de test de concurrence stock :

```ts
it('vends exactement une paire quand le stock est 1 et 10 commandes arrivent en parallèle', async () => {
  const variant = await factories.variant({ stockOnHand: 1 });
  const users = await Promise.all(Array.from({ length: 10 }, () => factories.customerWithCart(variant.id)));
  const results = await Promise.all(users.map(u => api.as(u).post('/api/v1/orders').set('Idempotency-Key', ulid()).send(validOrderBody())));
  expect(results.filter(r => r.status === 201)).toHaveLength(1);
  expect(results.filter(r => r.status === 409)).toHaveLength(9);
  expect((await db.variant(variant.id)).stockReserved).toBe(1);
});
```

### 14.4 Seuils bloquants (CI)
Couverture ≥ 85 % global, ≥ 95 % sur modules critiques ; 0 test `skip` sans ticket ; 0 vulnérabilité HIGH/CRITICAL ; lint sans warning ; règles d'architecture respectées ; OpenAPI à jour (diff = échec).

---

## 15. Jobs asynchrones (BullMQ — process `worker.ts`)

| Job | Déclencheur | Rôle | Reprise / idempotence |
|-----|-------------|------|------------------------|
| `email.send` | Événements (inscription, commande, expédition, reset…) | Envoi emails via templates | 5 tentatives, backoff exponentiel, DLQ |
| `order.expire` | Répétée (1 min) | Expire les commandes impayées + libère le stock | Verrou Redis, idempotent |
| `payment.reconcile` | Répétée (5 min) | Interroge le provider pour les paiements `PENDING` > 10 min | Idempotent |
| `webhook.retry` | Échec de traitement | Rejoue les `webhook_events` non traités | Anti-rejeu |
| `tokens.cleanup` | Quotidien | Purge tokens/sessions/idempotency expirés | |
| `stock.low_alert` | Sur mouvement + quotidien | Alerte stock bas (email admin) | |
| `cart.cleanup` | Quotidien | Supprime paniers invités expirés | |
| `report.daily` | Quotidien | Résumé des ventes (email admin, optionnel) | |

Chaque job : logs structurés avec `jobId`, métriques (`jobs_processed_total`, `job_duration_seconds`, `jobs_failed_total`), alerte si DLQ > 0.

---

## 16. Observabilité & monitoring en production

### 16.1 Les 4 piliers

| Pilier | Outils | Contenu |
|--------|--------|---------|
| **Logs** | `pino` (JSON, stdout) → Promtail → **Loki** → Grafana | `requestId`, `userId` (si connu), `route`, `status`, `durationMs`, niveau ; redaction PII |
| **Métriques** | `prom-client` → **Prometheus** → Grafana ; exporters : `node_exporter`, `postgres_exporter`, `redis_exporter`, `blackbox_exporter` | Techniques + métier (16.3) |
| **Traces** | OpenTelemetry (HTTP, Prisma, Redis, BullMQ) → OTLP → Tempo/Jaeger (ou SaaS) | Latence par étape, corrélation via `traceId` dans les logs |
| **Erreurs** | **Sentry** (ou GlitchTip auto-hébergé) | Exceptions non gérées, release + `requestId`, PII scrubbing, source maps |

### 16.2 Endpoints d'exploitation
- `/health/live` : renvoie 200 tant que le process répond (utilisé par Docker/orchestrateur).
- `/health/ready` : 200 seulement si Postgres (`SELECT 1`), Redis (`PING`) et la queue sont OK ; sinon 503 (retire l'instance du load balancer). Ne divulgue aucun détail sensible.
- `/metrics` : exposé **uniquement** sur le réseau interne ou derrière Basic Auth ; jamais public.
- **Graceful shutdown** : sur `SIGTERM` → arrêt d'acceptation, fin des requêtes en cours (timeout 25 s), fermeture Prisma/Redis/BullMQ, exit 0.

### 16.3 Métriques à exposer

**Techniques** : `http_requests_total{method,route,status}`, `http_request_duration_seconds` (histogramme, `route` = **pattern** `/orders/:id` et non l'URL réelle pour éviter l'explosion de cardinalité), `http_requests_in_flight`, métriques process/event-loop (`collectDefaultMetrics`), `prisma_query_duration_seconds`, `db_pool_*`, `redis_command_duration_seconds`, `rate_limited_total{limiter}`, `queue_waiting_jobs{queue}`, `jobs_failed_total{queue}`, `job_duration_seconds{queue}`.

**Métier** : `orders_created_total`, `orders_paid_total`, `orders_expired_total`, `orders_cancelled_total`, `order_value_xaf` (histogramme), `payments_total{provider,status}`, `payment_provider_latency_seconds{provider}`, `webhooks_received_total{provider,status}`, `stock_conflicts_total` (OUT_OF_STOCK), `low_stock_variants` (gauge), `login_failures_total`, `account_lockouts_total`, `refresh_token_reuse_detected_total`, `coupon_failures_total`, `signups_total`.

### 16.4 Alertes (Alertmanager → email/Slack/WhatsApp/Telegram)

| Alerte | Condition | Sévérité |
|--------|-----------|----------|
| API down | `up == 0` ou blackbox probe KO > 2 min | **critique** |
| Taux d'erreurs 5xx | > 2 % sur 5 min | critique |
| Latence dégradée | p95 > 800 ms sur 10 min | avertissement |
| Saturation | CPU > 85 % 10 min · mémoire > 90 % · event-loop lag p99 > 200 ms · disque > 80 % | avertissement |
| Postgres | connexions > 80 % · réplication/backup en échec · requêtes lentes | critique |
| Redis | mémoire > 85 % · indisponible | critique |
| Paiements | taux d'échec > 30 % sur 15 min · webhooks non reçus alors que paiements `PENDING` s'accumulent · `PAYMENT_AMOUNT_MISMATCH` > 0 | **critique** |
| Sécurité | pic de `login_failures_total` · `refresh_token_reuse_detected_total` > 0 · pics de 401/403/429 · signature webhook invalide | avertissement/critique |
| Jobs | file en attente > seuil · DLQ > 0 · `order.expire` non exécuté depuis 5 min | avertissement |
| Business | 0 commande en 6 h en journée (heuristique) · stock bas | info |
| Certificat TLS | expiration < 14 jours | avertissement |

### 16.5 Dashboards Grafana (provisionnés en code)
`api-overview` (RED : rate/errors/duration par route) · `business` (commandes, CA, conversion paiement, top produits) · `infra` (CPU/mémoire/disque/Postgres/Redis) · `queues` (BullMQ) · `security` (échecs de login, 429, réutilisation de tokens).

### 16.6 SLO proposés
Disponibilité **99,5 %/mois** · p95 lecture catalogue **< 400 ms** · p95 écritures (commande) **< 1 s** · taux d'erreur 5xx **< 0,5 %** · RPO **≤ 24 h** (sauvegarde) / RTO **≤ 2 h**.

### 16.7 Profil « léger » (si budget/serveur limité)
Sentry SaaS (offre gratuite) + Uptime Kuma (sondes externes) + Prometheus + Grafana (sans Loki/Tempo : logs via `docker logs` + rotation, ou Grafana Cloud free). Le code d'instrumentation reste identique ; seuls les composants déployés changent (`docker-compose.monitoring.yml` avec profils `light` et `full`).

---

## 17. Déploiement & exploitation

- **Pipeline** : PR → CI complète → merge `main` → build image (tag = SHA + version) → scan `trivy` → déploiement staging → smoke tests + OWASP ZAP baseline → déploiement production (approbation manuelle).
- **Migrations** : `prisma migrate deploy` exécuté **avant** le démarrage de la nouvelle version ; migrations **rétro-compatibles** (expand → migrate → contract).
- **Environnements** : `development`, `test`, `staging` (données factices, mêmes contrôles), `production`.
- **Rollback** : image précédente conservée ; procédure dans `RUNBOOK.md`.
- **Reverse proxy** : TLS 1.2+/1.3, HSTS, limites de taille, timeouts, compression, en-têtes `X-Forwarded-*` ; seul le proxy est exposé (API et DB en réseau privé).
- **Pare-feu** : ports 80/443 seulement ; SSH par clé, fail2ban ; Postgres/Redis non exposés.
- **Rotation** : clés JWT (`kid`, chevauchement 24 h), secrets providers, mots de passe DB — procédure scriptée.
- **Runbook** : incident paiement, incident stock, compromission de compte admin, fuite de secret, restauration de sauvegarde, mode maintenance (`settings.maintenanceMode`).

---

## 18. Plan de réalisation par lots (ordre imposé)

| Lot | Contenu | Livrables clés |
|-----|---------|----------------|
| **0 — Fondations** | Scaffolding, tooling (lint, prettier, husky, dependency-cruiser, knip), CI, Docker/compose, `env.ts`, logger, error handler RFC 7807, request-id, helmet/cors/hpp, health endpoints, Testcontainers, premier test de bout en bout (`GET /health/live`), OpenAPI de base, `THREAT_MODEL.md` | Pipeline CI verte, app démarrable, 1er test |
| **1 — Identité & RBAC** | Schéma users/roles/permissions/sessions/tokens, seed RBAC, register/login/refresh/logout/verify/reset/change-password, 2FA admin, `authenticate`/`authorize`/`require-2fa`, users/me, adresses, admin users, gestion des rôles, audit service | Matrice RBAC testée, tests JWT & IDOR |
| **2 — Catalogue & médias** | Marques, catégories, collections, produits, variantes, images (S3 + sharp), recherche full-text, endpoints publics + admin | Catalogue publiable, upload sécurisé |
| **3 — Stock, panier, wishlist** | Inventaire + mouvements, réservations, panier invité/connecté + fusion, wishlist | Test de concurrence stock |
| **4 — Livraison, coupons, checkout, commandes** | Zones/tarifs, coupons, devis, création de commande idempotente, machine d'états, annulation, factures PDF | Parcours commande sans paiement réel |
| **5 — Paiements & jobs** | `PaymentProvider` + Fake + provider réel, initiation, statut, webhooks sécurisés, réconciliation, remboursements, COD, jobs BullMQ (expiration, emails…) | Parcours E2E complet avec FakeProvider |
| **6 — Avis, newsletter, contact, admin** | Avis (achat vérifié + modération), newsletter double opt-in, contact, stats, audit logs, settings | |
| **7 — Observabilité & durcissement** | Métriques Prometheus (technique + métier), tracing OTel, Sentry, stack monitoring compose, dashboards, alertes, tests de charge k6, mutation testing, ZAP baseline, revue sécurité finale, `RUNBOOK.md`, doc OpenAPI finale | Go-live checklist (section 19) |

> À la fin de **chaque lot** : `npm run ci` vert, couverture respectée, OpenAPI régénéré, `DECISIONS.md` à jour, résumé du lot (routes livrées, tests ajoutés, écarts éventuels).

---

## 19. Definition of Done & checklist Go-Live

### 19.1 Definition of Done (par fonctionnalité)
- [ ] Tests écrits **avant** le code (historique git le montre) et verts
- [ ] Cas 401/403/404/422/409/429 testés
- [ ] Ownership/RBAC vérifiés et testés
- [ ] Entrées validées (Zod strict), sorties via DTO
- [ ] Logs sans donnée sensible ; métriques/erreurs instrumentées si pertinent
- [ ] Documentation OpenAPI à jour
- [ ] Lint, typecheck, arch:check, couverture OK
- [ ] Action sensible ⇒ entrée dans `audit_logs`

### 19.2 Checklist Go-Live
- [ ] `npm audit` / `trivy` sans HIGH/CRITICAL ; `gitleaks` propre
- [ ] Secrets uniquement en variables d'environnement/secret manager ; clés JWT de production générées
- [ ] TLS + HSTS ; CORS restreint aux domaines de production
- [ ] `/docs` désactivé ou protégé ; `/metrics` non public
- [ ] Premier `SUPER_ADMIN` créé via `scripts/create-admin.ts` avec 2FA activée
- [ ] Sauvegardes automatiques **et restauration testée**
- [ ] Monitoring actif : dashboards visibles, alertes testées (envoi réel), sondes externes configurées
- [ ] Test de charge k6 passé (objectifs SLO)
- [ ] Paiement testé en **sandbox** puis en réel avec petit montant ; webhook vérifié en conditions réelles
- [ ] Runbook relu par l'équipe ; procédure de rollback validée
- [ ] Conformité : CGV, politique de confidentialité, mentions légales, consentement newsletter

---

## 20. Points ouverts (à trancher avec le porteur du projet)

1. Agrégateur Mobile Money définitif (Campay vs CinetPay) et frais associés.
2. Checkout invité en v2 ? (impacte tracking de commande et anti-abus).
3. COD : villes éligibles et plafond de montant.
4. Grille de livraison exacte (zones/villes/tarifs, franco de port).
5. Politique de retour/échange (délai, frais) → impact sur remboursements et statuts.
6. Hébergement final (VPS/région) et fournisseur SMTP/S3.
7. Canal d'alerte préféré (email, Telegram, WhatsApp, Slack).
8. Besoin d'une internationalisation des contenus (FR/EN) dès la v1.

