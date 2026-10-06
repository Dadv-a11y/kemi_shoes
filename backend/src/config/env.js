import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const booleanEnv = z.preprocess((value) => {
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return value;
}, z.boolean());

// Toute variable d'env critique est validée au démarrage — on préfère un crash
// immédiat et lisible à un comportement silencieusement incorrect en prod (OWASP A05).
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().default(5432),
  DATABASE_NAME: z.string().default('kemi_shoes'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default('postgres'),
  DATABASE_SSL: booleanEnv.default(false),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me-please'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me-please'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  OTP_TTL_MINUTES: z.coerce.number().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  // Tentatives de connexion / inscription / OTP par IP et par 15 min.
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: booleanEnv.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('KEMI SHOES <no-reply@kemishoes.com>'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),

  MOBILE_MONEY_API_KEY: z.string().optional(),

  // Envoi des codes OTP (voir modules/notifications/sms/README.md). Vide = défaut
  // selon l'environnement : console en dev, memory en test, none en production.
  SMS_PROVIDER: z.preprocess((value) => (value === '' ? undefined : value), z.enum(['none', 'console', 'memory']).optional()),
  WHATSAPP_PROVIDER: z.preprocess((value) => (value === '' ? undefined : value), z.enum(['none', 'console', 'memory']).optional()),

  // Cookies de session (jetons HttpOnly). COOKIE_DOMAIN : domaine parent commun au
  // frontend et à l'API si nécessaire (ex. .kemishoes.com). SameSite=None impose Secure.
  COOKIE_DOMAIN: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
  COOKIE_SECURE: z.preprocess((value) => (value === '' ? undefined : value), booleanEnv.optional()),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // CamPay (agrégateur Mobile Money MTN / Orange + carte, Cameroun).
  // demo : https://demo.campay.net/api — production : https://www.campay.net/api
  CAMPAY_BASE_URL: z.string().url().default('https://demo.campay.net/api'),
  CAMPAY_APP_ID: z.string().optional(),
  CAMPAY_USERNAME: z.string().optional(),
  CAMPAY_APP_PASSWORD: z.string().optional(),
  CAMPAY_ACCESS_TOKEN: z.string().optional(),
  CAMPAY_WEBHOOK_KEY: z.string().optional(),
  // Le compte demo CamPay plafonne chaque transaction à 25 XAF : on facture
  // au plus ce montant tant que la variable est définie (à retirer après Go Live).
  CAMPAY_MAX_AMOUNT_XAF: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().int().positive().optional()),

  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  LOG_LEVEL: z.string().default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Configuration invalide :', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Défauts dépendant de l'environnement.
const devLike = env.NODE_ENV !== 'production';
env.SMS_PROVIDER ??= env.NODE_ENV === 'test' ? 'memory' : devLike ? 'console' : 'none';
env.WHATSAPP_PROVIDER ??= env.NODE_ENV === 'test' ? 'memory' : 'none';
env.COOKIE_SECURE ??= env.NODE_ENV === 'production' || env.COOKIE_SAMESITE === 'none';

const configErrors = [];
// Les fournisseurs console/memory affichent ou conservent les codes OTP en clair.
if (env.NODE_ENV === 'production') {
  for (const key of ['SMS_PROVIDER', 'WHATSAPP_PROVIDER']) {
    if (['console', 'memory'].includes(env[key])) configErrors.push(`${key}=${env[key]} est réservé au développement.`);
  }
}
if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) configErrors.push('COOKIE_SAMESITE=none exige COOKIE_SECURE=true.');
if (configErrors.length) {
  // eslint-disable-next-line no-console
  console.error('❌ Configuration invalide :', configErrors);
  process.exit(1);
}

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';