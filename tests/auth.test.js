import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sessionConfig, createSessionMiddleware } from '../src/config/session.js';
import { validateLogin } from '../src/validators/auth.validator.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import User from '../src/models/User.js';

test('session configuration rejects unsafe secrets and invalid timeouts', () => {
  for (const secret of ['', 'short', 'replace_with_a_generated_secret_that_is_long']) {
    assert.throws(() => sessionConfig({ SESSION_SECRET: secret }));
  }
  const config = sessionConfig({ SESSION_SECRET: 'a'.repeat(64), NODE_ENV: 'production' });
  assert.equal(config.secure, true);
  assert.equal(config.idleMs, 1800000);
  assert.equal(config.absoluteMs, 43200000);
  assert.equal(config.trustProxy, false);
  assert.equal(sessionConfig({ SESSION_SECRET: 'a'.repeat(64), TRUST_PROXY: 'true' }).trustProxy, true);
  assert.equal(sessionConfig({ SESSION_SECRET: 'a'.repeat(64), TRUST_PROXY: '2' }).trustProxy, 2);
  assert.equal(sessionConfig({ SESSION_SECRET: 'a'.repeat(64), TRUST_PROXY: 'loopback, linklocal' }).trustProxy, 'loopback, linklocal');
  assert.throws(() => sessionConfig({ SESSION_SECRET: 'a'.repeat(64), TRUST_PROXY: 'bad value!' }), /Invalid TRUST_PROXY/);
  assert.throws(() => sessionConfig({ SESSION_SECRET: 'a'.repeat(64), SESSION_IDLE_MINUTES: '0' }));
  assert.throws(() => createSessionMiddleware(config));
});

test('login validation normalizes email and rejects structured or oversized credentials', () => {
  assert.deepEqual(validateLogin({ email: ' ADA@EXAMPLE.COM ', password: ' secret ' }), {
    email: 'ada@example.com', password: ' secret ', errors: {},
  });
  for (const body of [{}, { email: { $ne: null }, password: ['secret'] }, { email: 'a@b.com', password: 'x'.repeat(129) }]) {
    assert.ok(Object.keys(validateLogin(body).errors).length);
  }
});

test('Argon2id produces salted hashes and verifies passwords', async () => {
  const password = 'a-long-test-password';
  const started = performance.now();
  const hash = await hashPassword(password);
  const [, algorithm, version, parameters] = hash.split('$');
  assert.equal(algorithm, 'argon2id');
  assert.equal(version, 'v=19');
  assert.deepEqual(Object.fromEntries(parameters.split(',').map((parameter) => parameter.split('='))), {
    m: '65536', t: '3', p: '1',
  });
  assert.equal(await verifyPassword(hash, password), true);
  assert.equal(await verifyPassword(hash, 'wrong-password'), false);
  assert.notEqual(await hashPassword(password), hash);
  assert.throws(() => hashPassword('short'));
  assert.throws(() => hashPassword('x'.repeat(129)));
  console.log(`Argon2id hash and verification benchmark: ${Math.round(performance.now() - started)}ms for four operations.`);
});

test('User validates role/status and does not serialize password hashes', async () => {
  const user = new User({ name: 'Ada', email: 'ADA@example.com', password: 'test-password-123', role: 'invalid' });
  await assert.rejects(user.validate());
  user.role = 'super_admin';
  await user.validate();
  assert.equal(user.email, 'ada@example.com');
  assert.equal(user.toJSON().password, undefined);
  await assert.rejects(User.updateOne({}, { $set: { password: 'plaintext' } }), /document.save/);
  await assert.rejects(User.insertMany([]), /document.save/);
});
