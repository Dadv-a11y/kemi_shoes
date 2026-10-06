// Attribue un rôle à un compte existant (ex. premier membre de l'équipe technique).
// Usage : npm run user:set-role -- <email|+2376XXXXXXXX> <CUSTOMER|PRODUCT_MANAGER|ADMIN|DEV>
import { openDb, closeDb, get, run } from '../src/db/client.js';
import { revokeAllSessions } from '../src/modules/auth/session.service.js';

const ROLES = ['CUSTOMER', 'PRODUCT_MANAGER', 'ADMIN', 'DEV'];
const [identifier, role] = process.argv.slice(2);
if (!identifier || !ROLES.includes(role)) {
  console.error(`Usage : npm run user:set-role -- <email|téléphone E.164> <${ROLES.join('|')}>`);
  process.exit(1);
}

try {
  await openDb();
  const user = await get(`SELECT id, name FROM User WHERE email = ? OR phone = ?`, [identifier, identifier]);
  if (!user) {
    console.error(`Aucun compte trouvé pour ${identifier}. Créez d'abord le compte depuis le site.`);
    process.exitCode = 1;
  } else {
    await run(`UPDATE User SET role = ? WHERE id = ?`, [role, user.id]);
    await revokeAllSessions(user.id); // le rôle est inscrit dans le jeton : reconnexion nécessaire
    console.log(`✔ ${user.name ?? identifier} a maintenant le rôle ${role} (reconnexion nécessaire).`);
  }
} finally {
  await closeDb();
}
