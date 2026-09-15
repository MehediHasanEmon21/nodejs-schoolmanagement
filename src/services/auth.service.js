import { randomBytes } from 'node:crypto';
import User from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

let dummyHash;
export async function authenticate(email, password) {
  const user = await User.findOne({ email }).select('+password');
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
  const valid = await verifyPassword(user?.password ?? await dummyHash, password);
  if (!valid || !user || user.status !== 'active') return null;
  // Conditional update also prevents a concurrent account deactivation from being ignored.
  return User.findOneAndUpdate({ _id: user.id, status: 'active' }, { $set: { lastLoginAt: new Date() } }, { returnDocument: 'after' });
}
export const sessionAction = (request, method) => new Promise((resolve, reject) => {
  request.session[method]((error) => error ? reject(error) : resolve());
});
