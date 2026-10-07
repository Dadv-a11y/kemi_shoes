'use strict';
/**
 * Point d'entrée pour Passenger (cPanel › « Setup Node.js App ») :
 * renseigner « Application startup file » = app.cjs.
 *
 * Pourquoi un fichier CommonJS : le projet est en ES modules ("type": "module") et
 * Passenger charge son fichier de démarrage avec require(). Ici, import() charge
 * src/server.js (qui utilise await au niveau racine, donc non « requirable »).
 *
 * Si le chargement échoue (module manquant, configuration invalide, base injoignable),
 * la cause est écrite dans LOG_DIR/kemishoes-fatal.log (visible dans Supervision ›
 * Fichiers de log) au lieu de n'apparaître que dans une page d'erreur 500 générique.
 */
const fs = require('node:fs');
const path = require('node:path');

try {
  // Même source de configuration que src/config/env.js (n'écrase jamais l'environnement existant).
  require('dotenv').config({ quiet: true });
} catch {
  /* dotenv absent : l'import ci-dessous échouera et sera journalisé */
}

function recordStartupFailure(error) {
  const line = JSON.stringify({
    level: 'fatal',
    time: new Date().toISOString(),
    service: 'kemi-shoes-backend',
    pid: process.pid,
    msg: 'startup_failed',
    node: process.version,
    cwd: process.cwd(),
    err: { type: error?.name, code: error?.code, message: error?.message, stack: error?.stack },
  });
  try {
    const dir = path.resolve(process.env.LOG_DIR || 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'kemishoes-fatal.log'), `${line}\n`);
  } catch {
    /* disque indisponible : il reste la sortie d'erreur */
  }
  console.error(line);
}

import('./src/server.js').catch((error) => {
  recordStartupFailure(error);
  process.exit(1);
});
