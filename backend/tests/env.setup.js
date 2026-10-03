process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =  'postgresql://postgres:daril2005@localhost:5432/kemi_shoes_test';
process.env.DATABASE_SSL = 'false';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-for-prod-use-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-for-prod-use-only';
process.env.CORS_ORIGINS = 'http://localhost:3000';
// Les tests ne doivent jamais appeler CamPay : on neutralise les identifiants
// éventuellement présents dans .env (dotenv n'écrase pas une variable définie).
for (const key of ['CAMPAY_ACCESS_TOKEN', 'CAMPAY_USERNAME', 'CAMPAY_APP_PASSWORD', 'CAMPAY_WEBHOOK_KEY', 'CAMPAY_MAX_AMOUNT_XAF']) {
  process.env[key] = '';
}
