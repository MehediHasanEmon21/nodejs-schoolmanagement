import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import { requireRole, requirePermission, requireResource } from '../src/middleware/authorization.js';
import { verifyCsrf } from '../src/middleware/auth.js';
import { seedAuthorization, ownsResource } from '../src/services/authorization.service.js';
import { defaultRoles, defaultPermissions } from '../src/config/authorization.js';
import User from '../src/models/User.js';
import Role from '../src/models/Role.js';
import Permission from '../src/models/Permission.js';
import LoginAttempt from '../src/models/LoginAttempt.js';

test('MongoDB roles, permissions and resource authorization', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_authorization_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init()]);
  await seedAuthorization();
  const password = 'Authorization-test-only-123';
  const users = {};
  for (const role of defaultRoles) {
    users[role._id] = await User.create({ name: role.name, email: `${role._id}@example.test`, password, role: role._id });
  }
  users.otherStudent = await User.create({ name: 'Other student', email: 'other@example.test', password });

  await t.test('stable role references, unique IDs and non-destructive initialization', async () => {
    assert.equal(await Role.countDocuments(), 5);
    assert.equal(await Permission.countDocuments(), defaultPermissions.length);
    const populated = await User.findById(users.teacher.id).populate({ path: 'role', populate: { path: 'permissions' } });
    assert.equal(populated.role.id, 'teacher');
    assert.ok(populated.role.permissions.some((permission) => permission.id === 'attendance.edit'));
    await assert.rejects(Role.create({ _id: 'student', name: 'Duplicate' }), { code: 11000 });
    await assert.rejects(Permission.create({ _id: 'student.view', description: 'Duplicate' }), { code: 11000 });
    await Role.updateOne({ _id: 'guardian' }, { $set: { permissions: ['dashboard.view'], status: 'inactive' } });
    await Permission.updateOne({ _id: 'fee.view' }, { $set: { status: 'inactive' } });
    const before = await Role.findById('guardian').lean();
    await seedAuthorization();
    assert.deepEqual(await Role.findById('guardian').lean(), before);
    assert.equal((await Permission.findById('fee.view')).status, 'inactive');
    assert.ok(before.createdAt instanceof Date);
    await Role.updateOne({ _id: 'guardian' }, { $set: { permissions: defaultRoles.find((role) => role._id === 'guardian').permissions, status: 'active' } });
    await Permission.updateOne({ _id: 'fee.view' }, { $set: { status: 'active' } });
  });

  // Only this test app mounts these resource endpoints. School modules arrive in their own phases.
  const router = express.Router();
  const ok = (request, response) => response.json({ allowed: true });
  router.get('/test/admin', requireRole('admin', 'super_admin'), ok);
  router.get('/test/role-management', requireRole('super_admin'), ok);
  router.get('/test/teacher', requireRole('teacher'), ok);
  router.get('/test/edit', requirePermission('student.view', 'student.edit'), ok);
  router.get('/test/unknown', requirePermission('unknown.view'), ok);
  const load = async (request) => {
    const id = request.params.id ?? request.body?.id;
    if (!mongoose.isObjectIdOrHexString(id)) return null;
    const user = await User.findById(id);
    return user ? { user: user._id, name: user.name, status: user.status } : null;
  };
  const record = (request, response) => response.json({ name: request.resource.name });
  router.get('/test/records/:id', requireResource('student.view', { load, policy: ownsResource }), record);
  router.post('/test/records', verifyCsrf, requireResource('student.view', { load, policy: ownsResource }), record);
  router.get('/test/bypass/:id', requireResource('student.view', { load, policy: ownsResource, allowSuperAdmin: true }), record);
  // Relationship fixtures exercise asynchronous policies without implementing future academic models.
  const assignments = new Map([[users.teacher.id, users.student.id], [users.guardian.id, users.student.id]]);
  const assigned = async ({ user, resource }) => assignments.get(user.id) === String(resource.user);
  router.get('/test/assigned/:id', requireResource('student.view', { load, policy: assigned }), record);
  router.get('/test/invariant/:id', requireResource('student.view', { load, policy: ownsResource, allowSuperAdmin: true }),
    (request, response) => response.sendStatus(request.resource.status === 'active' ? 200 : 422));

  const config = sessionConfig({ SESSION_SECRET: randomBytes(32).toString('hex') });
  server = createApp({ router, auth: { config, store: createSessionStore(() => {}) }, log: () => {} }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const clients = {};
  function client() {
    let cookie = '';
    return async (path, fields) => {
      const response = await fetch(base + path, {
        redirect: 'manual', method: fields ? 'POST' : 'GET',
        headers: { Cookie: cookie, ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: fields ? new URLSearchParams(fields) : undefined,
      });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      const text = await response.text();
      return { status: response.status, location: response.headers.get('location'), text,
        csrf: text.match(/name="_csrf" value="([a-f0-9]{64})"/)?.[1] };
    };
  }
  for (const [role, user] of Object.entries(users)) {
    const request = client();
    const login = await request('/login');
    assert.equal((await request('/login', { _csrf: login.csrf, email: user.email, password })).status, 303);
    clients[role] = request;
  }

  await t.test('role and permission guards reject direct URLs and ignore submitted privileges', async () => {
    const guest = client();
    for (const path of ['/dashboard', '/test/admin', '/test/edit', `/test/records/${users.student.id}`]) {
      assert.equal((await guest(path)).location, '/login');
    }
    for (const role of Object.keys(users)) {
      const dashboard = await clients[role]('/dashboard');
      assert.equal(dashboard.status, 200, role);
      assert.match(dashboard.text, /School overview/);
      assert.match(dashboard.text, /href="\/dashboard"/);
      if (['student', 'guardian', 'otherStudent'].includes(role)) {
        assert.ok(!dashboard.text.includes('>Teachers<'));
        assert.ok(!dashboard.text.includes('>Attendance<'));
      }
      const administrator = ['admin', 'super_admin'].includes(role);
      assert.equal((await clients[role]('/test/admin')).status, administrator ? 200 : 403, role);
      assert.equal((await clients[role]('/test/role-management')).status, role === 'super_admin' ? 200 : 403, role);
      assert.equal((await clients[role]('/test/edit')).status, administrator ? 200 : 403, role);
      assert.equal((await clients[role]('/test/teacher')).status, role === 'teacher' ? 200 : 403, role);
      assert.equal((await clients[role]('/test/unknown')).status, 403, role);
    }
    const denied = await clients.student('/test/admin?role=super_admin&permission=student.edit');
    assert.equal(denied.status, 403);
    assert.match(denied.text, /Access denied/);
    assert.ok(!denied.text.includes('password'));
  });

  await t.test('ownership denies other users, missing IDs and forged body ownership', async () => {
    const own = `/test/records/${users.student.id}`;
    assert.equal((await clients.student(own)).status, 200);
    const other = await clients.student(`/test/records/${users.otherStudent.id}`);
    const missing = await clients.student(`/test/records/${new mongoose.Types.ObjectId()}`);
    assert.equal(other.status, 404);
    assert.equal(missing.status, 404);
    assert.match(other.text, /Page not found/);
    assert.ok(!other.text.includes(users.otherStudent.name));
    assert.equal((await clients.student('/test/records/invalid')).status, 404);
    const page = await clients.student('/dashboard');
    assert.equal((await clients.student('/test/records', { _csrf: page.csrf, id: users.otherStudent.id,
      user: users.student.id, role: 'super_admin' })).status, 404);
    assert.equal((await clients.student('/test/records', { _csrf: page.csrf, id: users.student.id })).status, 200);
    assert.equal((await clients.student('/test/records', { id: users.student.id })).status, 403);
  });

  await t.test('asynchronous relationship checks deny unassigned teachers and unlinked guardians', async () => {
    for (const role of ['teacher', 'guardian']) {
      assert.equal((await clients[role](`/test/assigned/${users.student.id}`)).status, 200);
      assert.equal((await clients[role](`/test/assigned/${users.otherStudent.id}`)).status, 404);
      assignments.delete(users[role].id);
      assert.equal((await clients[role](`/test/assigned/${users.student.id}`)).status, 404);
    }
  });

  await t.test('Super Admin bypass is explicit; Admin and business invariants remain restricted', async () => {
    assert.equal((await clients.super_admin(`/test/records/${users.student.id}`)).status, 404);
    assert.equal((await clients.super_admin(`/test/bypass/${users.student.id}`)).status, 200);
    assert.equal((await clients.admin(`/test/bypass/${users.student.id}`)).status, 404);
    assert.equal((await clients.super_admin(`/test/bypass/${new mongoose.Types.ObjectId()}`)).status, 404);
    await User.updateOne({ _id: users.otherStudent.id }, { $set: { status: 'inactive' } });
    assert.equal((await clients.super_admin(`/test/invariant/${users.otherStudent.id}`)).status, 422);
  });

  await t.test('live role changes and permission revocations take effect in existing sessions', async () => {
    await Role.updateOne({ _id: 'admin' }, { $pull: { permissions: 'student.edit' } });
    assert.equal((await clients.admin('/test/edit')).status, 403);
    assert.equal((await clients.super_admin('/test/edit')).status, 200);
    await Permission.updateOne({ _id: 'student.edit' }, { $set: { status: 'inactive' } });
    assert.equal((await clients.super_admin('/test/edit')).status, 403);
    await Permission.deleteOne({ _id: 'student.view' });
    assert.equal((await clients.student(`/test/records/${users.student.id}`)).status, 403);
    assert.equal((await clients.super_admin(`/test/bypass/${users.student.id}`)).status, 403);
    await User.updateOne({ _id: users.admin.id }, { $set: { role: 'student' } });
    assert.equal((await clients.admin('/test/admin')).status, 403);
    await Role.updateOne({ _id: 'teacher' }, { $pull: { permissions: 'dashboard.view' } });
    const restrictedDashboard = await clients.teacher('/dashboard');
    assert.equal(restrictedDashboard.status, 403);
    assert.ok(!restrictedDashboard.text.includes('href="/dashboard"'));
    assert.ok(!restrictedDashboard.text.includes('>Teachers<'));
    await Role.updateOne({ _id: 'super_admin' }, { $set: { status: 'inactive' } });
    assert.equal((await clients.super_admin('/dashboard')).status, 403);
    assert.equal((await clients.super_admin('/test/admin')).status, 403);
    await Role.deleteOne({ _id: 'student' });
    assert.equal((await clients.student('/dashboard')).status, 403);
    // A role restriction still allows logout; disabling the user destroys authentication.
    const denied = await clients.student('/dashboard');
    assert.equal((await clients.student('/logout', { _csrf: denied.csrf })).status, 303);
    await User.updateOne({ _id: users.guardian.id }, { $set: { status: 'inactive' } });
    assert.equal((await clients.guardian('/dashboard')).location, '/login');
    const sessions = await mongoose.connection.collection('sessions').find({}).toArray();
    for (const session of sessions) {
      assert.equal(JSON.parse(session.session).permissions, undefined);
      assert.equal(JSON.parse(session.session).role, undefined);
    }
  });
});
