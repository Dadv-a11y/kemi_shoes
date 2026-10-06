import dotenv from 'dotenv';

dotenv.config({ quiet: true });

process.env.NODE_ENV = 'test';
// Base de test lue depuis TEST_DATABASE_URL (.env) : aucun mot de passe en dur dans le dépôt.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kemi_shoes_test';
process.env.DATABASE_SSL = 'false';
// Dossier de logs isolé pour les tests de supervision (fichiers d'exemple écrits par les tests).
process.env.LOG_DIR = `${process.env.TMPDIR || '/tmp'}/kemi-test-logs-${process.pid}`;
process.env.ALERT_EMAILS = '';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-for-prod-use-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-for-prod-use-only';
process.env.CORS_ORIGINS = 'http://localhost:3000';
// Les tests ne doivent jamais appeler CamPay : on neutralise les identifiants
// éventuellement présents dans .env (dotenv n'écrase pas une variable définie).
for (const key of ['CAMPAY_ACCESS_TOKEN', 'CAMPAY_USERNAME', 'CAMPAY_APP_PASSWORD', 'CAMPAY_WEBHOOK_KEY', 'CAMPAY_MAX_AMOUNT_XAF']) {
  process.env[key] = '';
}
