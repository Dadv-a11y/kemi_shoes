import { openDb, run, closeDb } from '../src/db/client.js';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DB_RESET !== 'true') {
  throw new Error('Refusing to reset production without ALLOW_DB_RESET=true.');
}

try {
  await openDb();
  await run('TRUNCATE TABLE Notification, AuditLog, OrderStatusEvent, OrderItem, "Order", Review, ProductSize, ProductColor, ProductImage, Product, DeliveryZone, ContentPage, Address, OtpCode, "User" RESTART IDENTITY CASCADE');
  console.log('Database reset complete.');
} finally {
  await closeDb();
}