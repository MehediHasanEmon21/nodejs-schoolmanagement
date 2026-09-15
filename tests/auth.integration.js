import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import User from '../src/models/User.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import { verifyPassword } from '../src/utils/password.js';

// Each run owns a randomly named database; never read or modify school records.
test('MongoDB authentication lifecycle, security boundaries and persistence', { skip: !process.env.MONGODB_URI }, async (t) => {
  const dbName = `school_auth_test_${randomBytes(8).toString('hex')}`;
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  const servers = [];
  t.after(async () => {
    // Finish HTTP/session-store writes before dropping the database and closing its shared client.
    await Promise.all(servers.map((server) => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init()]);
  const password = 'Test-only-password-123';
  const user = await User.create({ name: '<script>Ada</script>', email: 'ADA@example.com', password, role: 'super_admin' });
  const stored = await User.findById(user.id).select('+password');
  assert.notEqual(stored.password, password);
  assert.match(stored.password, /^\$argon2id/);
  assert.equal((await User.findById(user.id)).password, undefined);
  await assert.rejects(User.create({ name: 'Duplicate', email: 'ada@EXAMPLE.com', password }), { code: 11000 });
  const before = stored.password;
  stored.name = '<script>Ada</script> changed';
  await stored.save();
  assert.equal((await User.findById(user.id).select('+password')).password, before);
  stored.password = 'Changed-test-password-123';
  await stored.save();
  const changed = await User.findById(user.id).select('+password');
  assert.notEqual(changed.password, before);
  assert.equal(await verifyPassword(changed.password, 'Changed-test-password-123'), true);
  assert.equal(await verifyPassword(changed.password, password), false);
  stored.password = password;
  await stored.save();

  const config = sessionConfig({ SESSION_SECRET: randomBytes(32).toString('hex') });
  async function serve() {
    const store = createSessionStore(() => {});
    const server = createApp({ auth: { config, store }, log: () => {} }).listen(0, '127.0.0.1');
    servers.push(server);
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
  }
  const base = await serve();
  let cookie = '';
  async function request(path, fields, options = {}) {
    const response = await fetch((options.base ?? base) + path, {
      redirect: 'manual', method: fields ? 'POST' : 'GET',
      headers: { Cookie: options.cookie ?? cookie, ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      body: fields ? new URLSearchParams(fields) : undefined,
    });
    if (response.headers.get('set-cookie') && options.cookie === undefined) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  }
  const tokenFrom = (html) => html.match(/name="_csrf" value="([a-f0-9]{64})"/)?.[1];
  assert.equal((await request('/dashboard')).headers.get('location'), '/login');
  let page = await request('/login');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('set-cookie'), /HttpOnly/);
  assert.match(page.headers.get('set-cookie'), /SameSite=Lax/);
  let token = tokenFrom(await page.text());
  assert.ok(token);
  assert.equal((await request('/login', { email: user.email, password })).status, 403);
  assert.equal((await request('/login', { _csrf: token, email: 'bad', password: '' })).status, 422);
  let invalid = await request('/login', { _csrf: token, email: user.email, password: 'wrong' });
  assert.equal(invalid.status, 401);
  assert.match(await invalid.text(), /Invalid email or password/);
  invalid = await request('/login', { _csrf: token, email: 'missing@example.com', password });
  assert.equal(invalid.status, 401);
  assert.match(await invalid.text(), /Invalid email or password/);
  const guestCookie = cookie;
  const success = await request('/login', { _csrf: token, email: ' ADA@EXAMPLE.COM ', password });
  assert.equal(success.status, 303);
  assert.equal(success.headers.get('location'), '/dashboard');
  assert.notEqual(cookie, guestCookie);
  assert.ok((await User.findById(user.id)).lastLoginAt);
  assert.equal((await request('/dashboard', null, { cookie: guestCookie })).status, 302);
  assert.equal((await request('/login')).headers.get('location'), '/dashboard');
  assert.equal((await request('/login', {})).headers.get('location'), '/dashboard');
  page = await request('/dashboard');
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  const html = await page.text();
  assert.ok(!html.includes('<script>Ada'));
  assert.match(html, /&lt;script&gt;Ada/);
  token = tokenFrom(html);
  assert.notEqual(token, tokenFrom(await (await request('/login', null, { cookie: '' })).text()));
  assert.equal((await request('/logout', {})).status, 403);
  assert.equal((await request('/logout')).status, 404);
  // A second app/store instance reads the same persisted session.
  const secondBase = await serve();
  assert.equal((await request('/dashboard', null, { base: secondBase })).status, 200);
  const sessions = mongoose.connection.collection('sessions');
  const records = await sessions.find({}).toArray();
  const authenticated = records.find((record) => JSON.parse(record.session).userId === user.id);
  assert.ok(authenticated, 'sessions must use the same database as the user models');
  assert.ok(authenticated.expires instanceof Date);
  assert.ok(!authenticated.session.includes('password'));
  const logoutCookie = cookie;
  const loggedOut = await request('/logout', { _csrf: token });
  assert.equal(loggedOut.status, 303);
  assert.match(loggedOut.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('/dashboard', null, { cookie: logoutCookie })).status, 302);

  async function signIn() {
    cookie = '';
    const csrf = tokenFrom(await (await request('/login')).text());
    assert.equal((await request('/login', { _csrf: csrf, email: user.email, password })).status, 303);
  }
  await signIn();
  await User.updateOne({ _id: user.id }, { $set: { status: 'inactive' } });
  assert.equal((await request('/dashboard')).status, 302);
  token = tokenFrom(await (await request('/login')).text());
  assert.equal((await request('/login', { _csrf: token, email: user.email, password })).status, 401);
  await User.updateOne({ _id: user.id }, { $set: { status: 'active' } });
  for (const field of ['startedAt', 'lastSeenAt']) {
    await signIn();
    const record = (await sessions.find({}).toArray()).find((entry) => JSON.parse(entry.session).userId === user.id);
    const data = JSON.parse(record.session);
    data[field] = Date.now() - (field === 'startedAt' ? config.absoluteMs : config.idleMs) - 1000;
    await sessions.updateOne({ _id: record._id }, { $set: { session: JSON.stringify(data) } });
    assert.equal((await request('/dashboard')).status, 302, field);
  }
  cookie = '';
  token = tokenFrom(await (await request('/login')).text());
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await request('/login', { _csrf: token, email: 'limited@example.com', password: 'wrong' })).status, 401);
  }
  const limited = await request('/login', { _csrf: token, email: 'limited@example.com', password });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal((await request('/login', { _csrf: token, email: 'limited@example.com', password }, { base: secondBase })).status, 429);
});
