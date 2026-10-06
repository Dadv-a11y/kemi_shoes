import { jest } from '@jest/globals';
import { errorHandler, notFound } from '../../src/middleware/errorHandler.js';

function run(err) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  errorHandler(err, { log: { error: jest.fn(), warn: jest.fn() } }, res, () => {});
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

describe('errorHandler', () => {
  test('conserve le statut et le code des erreurs applicatives', () => {
    expect(run(notFound('Absent'))).toEqual({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'Absent' } } });
  });

  test('traduit une violation de clé étrangère PostgreSQL en 409 sans exposer la contrainte', () => {
    const err = Object.assign(new Error('violates foreign key constraint "Order_deliveryzoneid_fkey"'), { code: '23503' });
    const { status, body } = run(err);
    expect(status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).not.toMatch(/fkey/);
  });

  test('traduit un identifiant mal formé (22P02) en 400', () => {
    expect(run(Object.assign(new Error('invalid input syntax'), { code: '22P02' })).status).toBe(400);
  });

  test('traduit un fichier trop lourd (multer) en 400', () => {
    const err = Object.assign(new Error('File too large'), { name: 'MulterError', code: 'LIMIT_FILE_SIZE' });
    expect(run(err)).toMatchObject({ status: 400, body: { error: { code: 'BAD_REQUEST' } } });
  });

  test('ne renvoie jamais un code interne pour une erreur inattendue', () => {
    const { status, body } = run(Object.assign(new Error('boom'), { code: 'ECONNRESET' }));
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
