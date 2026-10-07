// Vérifie que les dépendances installées sont utilisables par l'application, comme le fera Node
// au démarrage (résolution ES modules). À lancer sur le serveur, dans l'environnement virtuel
// Node.js de cPanel, depuis le dossier de l'API :
//
//   npm run check:install            (ou : node scripts/check-install.js [dossier-de-l-application])
//
// Cas typique détecté : « Cannot find package 'x' … Did you mean to import x/index.js » au
// démarrage sous Passenger = installation incomplète (package.json du paquet absent/illisible)
// ou lien node_modules incorrect. Code de sortie 1 si un paquet pose problème.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const appRoot = path.resolve(process.argv[2] ?? process.cwd());
const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const dependencies = Object.keys(manifest.dependencies ?? {});

/** Résolution façon ES modules : <dossier ou parent>/node_modules/<paquet>/package.json lisible et valide. */
function resolveLikeEsm(name) {
  for (let dir = appRoot; ; dir = path.dirname(dir)) {
    const file = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(path.join(dir, 'node_modules', name))) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { ok: true, file, version: parsed.version };
      } catch (error) {
        return { ok: false, reason: error.code === 'ENOENT' ? 'package.json absent' : error.code === 'EACCES' ? 'package.json illisible (droits)' : 'package.json corrompu', file };
      }
    }
    if (path.dirname(dir) === dir) return { ok: false, reason: 'paquet absent' };
  }
}

/** Résolution façon CommonJS (accepte aussi NODE_PATH et le repli sur index.js). */
function resolveLikeCjs(name) {
  try {
    return createRequire(path.join(appRoot, 'check.js')).resolve(name);
  } catch {
    return null;
  }
}

const nodeModules = path.join(appRoot, 'node_modules');
const lines = [`Node ${process.version} · application : ${appRoot}`];
try {
  const stat = fs.lstatSync(nodeModules);
  if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(nodeModules);
    let real = null;
    try { real = fs.realpathSync(nodeModules); } catch { /* lien cassé */ }
    lines.push(`node_modules : lien vers ${target}${real ? ` (${fs.readdirSync(real).length} entrées)` : ' — CIBLE INTROUVABLE (lien cassé)'}`);
  } else {
    lines.push(`node_modules : dossier (${fs.readdirSync(nodeModules).length} entrées)`);
  }
} catch {
  lines.push('node_modules : ABSENT (lancer « Run NPM Install » dans cPanel)');
}
if (process.env.NODE_PATH) lines.push(`NODE_PATH = ${process.env.NODE_PATH} (ignoré par les ES modules, pris en compte par require())`);
console.log(lines.join('\n'));

const problems = [];
for (const name of dependencies) {
  const esm = resolveLikeEsm(name);
  if (esm.ok) continue;
  const cjs = resolveLikeCjs(name);
  problems.push({ name, reason: esm.reason, cjs });
}

if (!problems.length) {
  console.log(`\n✔ ${dependencies.length} dépendances utilisables.`);
} else {
  console.log(`\n✖ ${problems.length} dépendance(s) sur ${dependencies.length} inutilisable(s) par Node :\n`);
  for (const { name, reason, cjs } of problems) {
    console.log(`  - ${name} : ${reason}${cjs ? ` — trouvé seulement en CommonJS (${cjs}) : installation incomplète ou mauvais lien node_modules` : ''}`);
  }
  console.log(`\nRéparation (dans l'environnement virtuel Node.js, dossier ${appRoot}) :`);
  console.log(`  rm -rf ${problems.map(({ name }) => `node_modules/${name}`).join(' ')}`);
  console.log('  npm install --omit=dev --no-audit --no-fund');
  console.log('  npm run check:install');
  console.log('Si node_modules est un lien cassé ou absent : « Run NPM Install » dans cPanel › Setup Node.js App, puis relancer ce contrôle.');
}

const required = ['NODE_ENV', 'DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CORS_ORIGINS', 'FRONTEND_URL', 'LOG_DIR'];
console.log(`\nVariables d'environnement de CE terminal (Passenger utilise celles de « Setup Node.js App ») :\n  ${required.map((key) => `${process.env[key] ? '✔' : '·'} ${key}`).join('   ')}`);

process.exitCode = problems.length ? 1 : 0;
