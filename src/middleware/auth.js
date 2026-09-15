import { randomBytes, timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import { cookieName, cookieOptions } from '../config/session.js';
import { sessionAction } from '../services/auth.service.js';

export function loadAuthentication(config) {
  return async (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    const now = Date.now();
    const session = request.session;
    if (session.userId) {
      const expired = !Number.isFinite(session.startedAt) || !Number.isFinite(session.lastSeenAt) ||
        now - session.startedAt >= config.absoluteMs || now - session.lastSeenAt >= config.idleMs;
      const user = expired ? null : await User.findById(session.userId);
      if (!user || user.status !== 'active') {
        await sessionAction(request, 'regenerate');
        response.clearCookie(cookieName, cookieOptions(config));
      } else {
        session.csrfToken ??= randomBytes(32).toString('hex');
        response.locals.csrfToken = session.csrfToken;
        request.user = user;
        response.locals.currentUser = user;
        session.lastSeenAt = now;
        session.cookie.maxAge = Math.min(config.idleMs, config.absoluteMs - (now - session.startedAt));
      }
    }
    next();
  };
}
export function csrfToken(request, response, next) {
  request.session.csrfToken ??= randomBytes(32).toString('hex');
  response.locals.csrfToken = request.session.csrfToken;
  next();
}
export function verifyCsrf(request, response, next) {
  const actual = request.body?._csrf;
  const expected = request.session.csrfToken;
  if (typeof actual !== 'string' || typeof expected !== 'string' || actual.length !== 64 ||
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    return next(Object.assign(new Error('Invalid CSRF token'), { status: 403 }));
  }
  next();
}
export function requireAuth(request, response, next) {
  if (!request.user) return response.redirect(302, '/login');
  next();
}
export function requireGuest(request, response, next) {
  if (request.user) return response.redirect(302, '/dashboard');
  next();
}
