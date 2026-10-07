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
