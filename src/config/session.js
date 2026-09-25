import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';

export const cookieName = 'school.sid';

function trustProxy(value) {
  if (value === undefined || value === null || value === '' || value === false) return false;
  if (value === true) return true;
  const raw = String(value).trim();
  if (!raw) return false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    if (hops >= 1 && hops <= 10) return hops;
  }
  const parts = raw.split(',').map((item) => item.trim()).filter(Boolean);
  if (parts.length && parts.every((item) => /^[a-z0-9.:/_-]+$/i.test(item))) return parts.join(', ');
  throw new Error('Invalid TRUST_PROXY.');
}

export function sessionConfig(env = process.env) {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32 || /change_me|replace_with|placeholder/i.test(secret)) {
    throw new Error('SESSION_SECRET must be a generated secret of at least 32 characters.');
  }
  const minutes = (key, fallback) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > 10080) throw new Error(`Invalid ${key}.`);
    return value * 60000;
  };
  return { secret, idleMs: minutes('SESSION_IDLE_MINUTES', 30), absoluteMs: minutes('SESSION_ABSOLUTE_MINUTES', 720),
    secure: env.NODE_ENV === 'production', trustProxy: trustProxy(env.TRUST_PROXY) };
}
export function cookieOptions(config) {
  return { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secure };
}
export function createSessionMiddleware(config, store) {
  if (!store) throw new Error('A persistent session store is required.');
  return session({ name: cookieName, secret: config.secret, store, resave: false, saveUninitialized: false,
    rolling: true, cookie: { ...cookieOptions(config), maxAge: config.idleMs } });
}
export function createSessionStore(log) {
  const store = MongoStore.create({ client: mongoose.connection.getClient(), dbName: mongoose.connection.name,
    collectionName: 'sessions', autoRemove: 'native' });
  store.on('error', () => log('session.store_error'));
  return store;
}
