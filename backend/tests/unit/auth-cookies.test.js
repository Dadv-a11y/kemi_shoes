import request from 'supertest';
import { setupTestDb } from '../testDb.js';
import { app } from '../../src/server.js';

setupTestDb();

const cookiesOf = (response) => response.headers['set-cookie'] ?? [];
const cookie = (response, name) => cookiesOf(response).find((value) => value.startsWith(`${name}=`));
// En-tête Cookie tel qu'un navigateur le renverrait (nom=valeur).
const jar = (response) => cookiesOf(response).map((value) => value.split(';')[0]).filter((pair) => !pair.endsWith('=')).join('; ');

async function register(email = 'cookie@example.com') {
  return request(app).post('/api/v1/auth/register').send({ name: 'Cookie', email, password: 'Password123!' });
}

describe('session en cookies HttpOnly', () => {
  test('la connexion pose des cookies HttpOnly et ne renvoie aucun jeton dans le corps', async () => {
    const response = await register();
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('cookie@example.com');
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();
    expect(cookie(response, 'kemi_at')).toMatch(/HttpOnly/);
    expect(cookie(response, 'kemi_at')).toMatch(/SameSite=Lax/);
    expect(cookie(response, 'kemi_rt')).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie(response, 'kemi_rt')).toMatch(/HttpOnly/);
  });

  test('le cookie authentifie les requêtes, le renouvellement fait tourner le refresh token', async () => {
    const login = await register('rotate@example.com');
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', jar(login));
    expect(me.status).toBe(200);

    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', jar(login));
    expect(refreshed.status).toBe(200);
    expect(cookie(refreshed, 'kemi_rt')).not.toBe(cookie(login, 'kemi_rt'));
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', jar(refreshed))).status).toBe(200);
  });

  test('la déconnexion efface les cookies et révoque la session', async () => {
    const login = await register('logout@example.com');
    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', jar(login));
    expect(logout.status).toBe(204);
    expect(cookie(logout, 'kemi_at')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', jar(login))).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', jar(login))).status).toBe(401);
  });

  test('CSRF : une requête avec cookie depuis une origine non autorisée est refusée', async () => {
    const login = await register('csrf@example.com');
    const forged = await request(app).post('/api/v1/auth/logout-all').set('Cookie', jar(login)).set('Origin', 'https://evil.example');
    expect(forged.status).toBe(403);
    const legit = await request(app).post('/api/v1/auth/logout-all').set('Cookie', jar(login)).set('Origin', 'http://localhost:3000');
    expect(legit.status).toBe(204);
  });

  test('les méthodes de connexion exposées reflètent la configuration', async () => {
    const response = await request(app).get('/api/v1/auth/providers');
    // phone : fournisseur « memory » en test ; google/facebook : selon les identifiants du .env local.
    expect(response.body).toMatchObject({ password: true, phone: true });
    expect(typeof response.body.google).toBe('boolean');
    expect(typeof response.body.facebook).toBe('boolean');
  });
});
