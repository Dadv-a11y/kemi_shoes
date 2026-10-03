import { requireAuth, optionalAuth, requireRole } from '../../src/middleware/auth.js';
import { signAccessToken } from '../../src/utils/tokens.js';

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('requireAuth', () => {
  test('rejette avec 401 si aucun header Authorization', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  test('rejette avec 401 si le token est invalide', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  test('attache req.user et appelle next() sans erreur si le token est valide', () => {
    const token = signAccessToken({ id: 'user-1', role: 'ADMIN' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'user-1', role: 'ADMIN' });
  });
});

describe('optionalAuth', () => {
  test('continue en tant qu’invité (pas d’erreur, pas de req.user) sans token', () => {
    const req = { headers: {} };
    const next = jest.fn();
    optionalAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  test('attache req.user si un token valide est fourni', () => {
    const token = signAccessToken({ id: 'user-2', role: 'CUSTOMER' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    optionalAuth(req, mockRes(), next);
    expect(req.user).toEqual({ id: 'user-2', role: 'CUSTOMER' });
  });

  test('un token invalide ne bloque pas la requête (reste invité)', () => {
    const req = { headers: { authorization: 'Bearer garbage' } };
    const next = jest.fn();
    optionalAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });
});

describe('requireRole', () => {
  test('laisse passer si le rôle correspond', () => {
    const req = { user: { id: 'u1', role: 'ADMIN' } };
    const next = jest.fn();
    requireRole('ADMIN', 'PRODUCT_MANAGER')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  test('renvoie 403 si le rôle ne correspond pas', () => {
    const req = { user: { id: 'u1', role: 'CUSTOMER' } };
    const next = jest.fn();
    requireRole('ADMIN')(req, mockRes(), next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  test('renvoie 401 si req.user est absent (fail-closed)', () => {
    const req = {};
    const next = jest.fn();
    requireRole('ADMIN')(req, mockRes(), next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });
});