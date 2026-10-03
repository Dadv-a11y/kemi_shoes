import { openDb, closeDb, run } from '../src/db/client.js';

let databasePromise;

export function setupTestDb() {
  databasePromise ??= openDb();
  beforeEach(async () => {
    await databasePromise;
    await run(`TRUNCATE TABLE AuditLog, OrderStatusEvent, OrderItem, "Order", Review, ProductSize, ProductColor, ProductImage, Product, DeliveryZone, OtpCode, Address, "User", ContentPage, Setting RESTART IDENTITY CASCADE`);
  });
  afterAll(async () => {
    await databasePromise;
    await closeDb();
    databasePromise = undefined;
  });
  return databasePromise;
}

export async function teardownTestDb() {
  await closeDb();
  databasePromise = undefined;
}