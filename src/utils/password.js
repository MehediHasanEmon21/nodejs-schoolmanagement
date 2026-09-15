import argon2 from 'argon2';

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('Password must contain 12 to 128 characters.');
  }
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}

export function verifyPassword(hash, password) {
  return argon2.verify(hash, password);
}
