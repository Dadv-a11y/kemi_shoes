import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12; // OWASP recommande >=10 pour bcrypt ; 12 = marge raisonnable sans coût prohibitif.

export async function hashSecret(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifySecret(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}