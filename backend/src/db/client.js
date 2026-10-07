import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pool;
let ready;

function postgresQuery(sql) {
  let index = 0;
  return sql
    .replace(/\?/g, () => `$${++index}`)
    .replace(/strftime\('%Y-%m-%dT%H:%M:%fZ','now'\)/g, 'CURRENT_TIMESTAMP');
}

function normalizeSql(sql) {
  return postgresQuery(sql).replace(/(?<!")\bUser\b(?!")/g, '"User"');
}

const columnNames = {
  emailverified: 'emailVerified', phoneverified: 'phoneVerified', passwordhash: 'passwordHash',
  providerid: 'providerId', createdat: 'createdAt', updatedat: 'updatedAt', userid: 'userId',
  fullname: 'fullName', isdefault: 'isDefault', codehash: 'codeHash', expiresat: 'expiresAt',
  compareatprice: 'compareAtPrice', colorcustomizable: 'colorCustomizable',
  materialcustomizable: 'materialCustomizable', productid: 'productId', ismain: 'isMain',
  feefcfa: 'feeFcfa', regionorcity: 'regionOrCity', etaminhours: 'etaMinHours', etamaxhours: 'etaMaxHours',
  codavailable: 'codAvailable', paymentmethods: 'paymentMethods', deliveryzoneid: 'deliveryZoneId',
  guestname: 'guestName', guestphone: 'guestPhone', guestemail: 'guestEmail', addresscountry: 'addressCountry',
  addresscity: 'addressCity', addressdistrict: 'addressDistrict', addressstreet: 'addressStreet',
  paymentmethod: 'paymentMethod', paymentstatus: 'paymentStatus', paymentref: 'paymentRef',
  internalnote: 'internalNote', subtotalfcfa: 'subtotalFcfa', deliveryfeefcfa: 'deliveryFeeFcfa',
  totalfcfa: 'totalFcfa', orderid: 'orderId', productnamefr: 'productNameFr', unitpricefcfa: 'unitPriceFcfa',
  customcolor: 'customColor', custommaterial: 'customMaterial', titlefr: 'titleFr', titleen: 'titleEn',
  bodyfr: 'bodyFr', bodyen: 'bodyEn', entityid: 'entityId', entitytype: 'entityType', actorid: 'actorId',
  actorlabel: 'actorLabel', actoremail: 'actorEmail', actorname: 'actorName', created_at: 'createdAt', pendingcustomizationscount: 'pendingCustomizationsCount',
  slugfr: 'slugFr', slugen: 'slugEn', namefr: 'nameFr', nameen: 'nameEn', descriptionfr: 'descriptionFr',
  descriptionen: 'descriptionEn', outofstocksizes: 'outOfStockSizes', productname: 'productName',
  ordercount: 'orderCount', readat: 'readAt', refreshhash: 'refreshHash', previoushash: 'previousHash', rotatedat: 'rotatedAt',
  revokedat: 'revokedAt', lastusedat: 'lastUsedAt', operatorreference: 'operatorReference', amountfcfa: 'amountFcfa', rawpayload: 'rawPayload', imageurl: 'imageUrl', altfr: 'altFr', alten: 'altEn', unitsold: 'unitsSold', revenue: 'revenue', averagebasketfcfa: 'averageBasketFcfa',
};

function normalizeRow(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const normalizedKey = columnNames[key] ?? key;
    const numeric = ['count', 'total', 'orderCount', 'units', 'revenue', 'average', 'previousUnits', 'trendPercent'].includes(normalizedKey);
    return [normalizedKey, numeric && value !== null ? Number(value) : value];
  }));
}

/**
 * Ouvre (ou crée) la base SQLite et applique le schéma.
 * ":memory:" est utilisé en tests pour isoler chaque run.
 */
export async function openDb() {
  if (!ready) {
    const config = env.DATABASE_URL
      ? { connectionString: env.DATABASE_URL }
      : { host: env.DATABASE_HOST, port: env.DATABASE_PORT, database: env.DATABASE_NAME, user: env.DATABASE_USER, password: env.DATABASE_PASSWORD };
    pool = new Pool({ ...config, ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false, max: 10 });
    ready = (async () => {
      const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
      const postgresSchema = schema
        .replace(/PRAGMA[^;]+;/gi, '')
        .replace(/strftime\('%Y-%m-%dT%H:%M:%fZ','now'\)/g, 'CURRENT_TIMESTAMP')
        .replace(/(?<!")\bUser\b(?!")/g, '"User"');
      await pool.query(postgresSchema);
    })().catch(async (error) => {
      await pool.end().catch(() => {});
      pool = undefined;
      ready = undefined;
      throw error;
    });
  }
  await ready;
  return pool;
}

export function getDb() {
  if (!pool) throw new Error('Database not initialised — call openDb() first.');
  return pool;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = undefined;
    ready = undefined;
  }
}

export async function get(sql, params = []) {
  await openDb();
  const result = await getDb().query(normalizeSql(sql), params);
  return normalizeRow(result.rows[0]);
}

export async function all(sql, params = []) {
  await openDb();
  const result = await getDb().query(normalizeSql(sql), params);
  return result.rows.map(normalizeRow);
}

export async function run(sql, params = []) {
  await openDb();
  return getDb().query(normalizeSql(sql), params);
}

/**
 * Exécute plusieurs opérations dans une transaction SQLite.
 * `fn` doit être synchrone.
 */
export async function transaction(fn) {
  await openDb();
  const client = await getDb().connect();
  await client.query('BEGIN');
  try {
    const result = await fn({ query: (sql, params = []) => client.query(normalizeSql(sql), params) });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}