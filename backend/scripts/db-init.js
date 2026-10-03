import { openDb, closeDb } from '../src/db/client.js';

try {
  await openDb();
  console.log('PostgreSQL schema initialized.');
} finally {
  await closeDb();
}