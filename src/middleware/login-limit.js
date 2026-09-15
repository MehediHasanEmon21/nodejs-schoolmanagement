import { createHmac } from 'node:crypto';
import LoginAttempt from '../models/LoginAttempt.js';

// Fixed windows are shared across app instances and restarts; TTL only handles cleanup.
export function loginLimit(secret) {
  return async (request, response, next) => {
    const windowMs = 15 * 60000;
    const bucket = Math.floor(Date.now() / windowMs);
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const keys = [['ip', request.ip, 30], ['email', email, 10]];
    for (const [kind, value, limit] of keys) {
      const key = createHmac('sha256', secret).update(`${kind}:${value}:${bucket}`).digest('hex');
      let attempt;
      try {
        attempt = await LoginAttempt.findOneAndUpdate({ _id: key }, {
          $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) },
        }, { upsert: true, returnDocument: 'after' });
      } catch (error) {
        if (error.code !== 11000) throw error;
        attempt = await LoginAttempt.findOneAndUpdate({ _id: key }, { $inc: { count: 1 } }, { returnDocument: 'after' });
      }
      if (attempt.count > limit) {
        response.set('Retry-After', String(Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000)));
        return next(Object.assign(new Error('Login rate exceeded'), { status: 429 }));
      }
    }
    next();
  };
}
