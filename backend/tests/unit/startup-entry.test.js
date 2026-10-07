import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const backendRoot = path.resolve(import.meta.dirname, '../..');

function runEntry(env) {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kemi-entry-'));
  const result = spawnSync(process.execPath, ['app.cjs'], {
    cwd: backendRoot,
    env: { PATH: process.env.PATH, LOG_DIR: logDir, ...env },
    encoding: 'utf8',
    timeout: 20000,
  });
  return { ...result, logDir };
}

describe('point d’entrée Passenger (app.cjs)', () => {
  test('charge le serveur en ES module (await racine compris) sans écouter en mode test', () => {
    const result = runEntry({ NODE_ENV: 'test', DATABASE_URL: process.env.DATABASE_URL, DATABASE_SSL: 'false' });
    expect(result.status).toBe(0);
    expect(result.stderr).not.toMatch(/ERR_REQUIRE|startup_failed/);
  });

  test('une configuration invalide est écrite dans kemishoes-fatal.log (et le processus s’arrête)', () => {
    const result = runEntry({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'trop-court' });
    expect(result.status).not.toBe(0);
    const fatal = fs.readFileSync(path.join(result.logDir, 'kemishoes-fatal.log'), 'utf8');
    expect(fatal).toContain('Configuration invalide');
    expect(fatal).toContain('JWT_ACCESS_SECRET');
  });
});

describe('diagnostic d’installation (scripts/check-install.js)', () => {
  const run = (appRoot) => spawnSync(process.execPath, ['scripts/check-install.js', appRoot], { cwd: backendRoot, encoding: 'utf8', timeout: 20000 });
  const makeApp = (dependencies) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kemi-install-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', dependencies }));
    return dir;
  };

  test('installation complète : code 0', () => {
    const result = run(backendRoot);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('dépendances utilisables');
  });

  test('paquet absent : code 1 et commande de réparation', () => {
    const result = run(makeApp({ 'express-async-errors': '*' }));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('express-async-errors : paquet absent');
    expect(result.stdout).toContain('npm install --omit=dev');
  });

  test('cas du journal : paquet trouvable en CommonJS (index.js) mais sans package.json lisible', () => {
    const dir = makeApp({ 'express-async-errors': '*' });
    fs.mkdirSync(path.join(dir, 'node_modules/express-async-errors'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules/express-async-errors/index.js'), 'module.exports = {};');
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('package.json absent');
    expect(result.stdout).toContain('trouvé seulement en CommonJS');
    expect(result.stdout).toContain('rm -rf node_modules/express-async-errors');
  });

  test('lien node_modules cassé signalé', () => {
    const dir = makeApp({ 'express-async-errors': '*' });
    fs.symlinkSync(path.join(dir, 'inexistant'), path.join(dir, 'node_modules'));
    const result = run(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('lien cassé');
  });
});
