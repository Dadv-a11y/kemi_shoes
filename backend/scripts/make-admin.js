// Promeut un compte existant en ADMIN (amorçage du premier administrateur).
// Usage : npm run user:make-admin -- <email|+2376XXXXXXXX>
import { openDb, closeDb, get, run } from '../src/db/client.js';

const identifier = process.argv[2];
if (!identifier) {
  console.error('Usage : npm run user:make-admin -- <email|téléphone E.164>');
  process.exit(1);
}

try {
  await openDb();
  const user = await get(`SELECT id, name FROM User WHERE email = ? OR phone = ?`, [identifier, identifier]);
  if (!user) {
    console.error(`Aucun compte trouvé pour ${identifier}. Créez d'abord le compte depuis le site.`);
    process.exitCode = 1;
  } else {
    await run(`UPDATE User SET role = 'ADMIN' WHERE id = ?`, [user.id]);
    console.log(`✔ ${user.name ?? identifier} est maintenant ADMIN (reconnectez-vous pour obtenir un token à jour).`);
  }
} finally {
  await closeDb();
}
