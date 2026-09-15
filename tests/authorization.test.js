import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import Role from '../src/models/Role.js';
import Permission from '../src/models/Permission.js';
import { hasRole, hasPermission, isSuperAdmin, ownsResource, canAccessResource } from '../src/services/authorization.service.js';
import { requireRole, requirePermission, requireResource } from '../src/middleware/authorization.js';

function context(role = 'student') {
  return {
    user: { id: new mongoose.Types.ObjectId().toString(), role, status: 'active' },
    role: { id: role, status: 'active' },
    permissions: new Set(['student.view']),
  };
}

test('role and permission models reject malformed definitions', async () => {
  await assert.rejects(new Role({ _id: 'unknown', name: 'Unknown' }).validate());
  await assert.rejects(new Role({ _id: 'teacher', name: 'Teacher', permissions: ['student.view', 'student.view'] }).validate());
  await assert.rejects(new Permission({ _id: '*', description: 'Wildcard' }).validate());
  await assert.rejects(new Permission({ _id: 'student.view', description: 'View', status: 'unknown' }).validate());
  await new Permission({ _id: 'student.view', description: 'View' }).validate();
});

test('authorization denies missing/ineligible identities and requires explicit grants', () => {
  const allowed = context();
  assert.equal(hasRole(allowed, 'student'), true);
  assert.equal(hasRole(allowed, 'teacher'), false);
  assert.equal(hasPermission(allowed, 'student.view'), true);
  assert.equal(hasPermission(allowed, 'student.edit'), false);
  for (const denied of [null, {}, { ...allowed, user: { ...allowed.user, status: 'inactive' } },
    { ...allowed, role: { id: 'student', status: 'inactive' } }, { ...allowed, role: { id: 'super_admin', status: 'active' } }]) {
    assert.equal(hasPermission(denied, 'student.view'), false);
    assert.equal(hasRole(denied, 'student'), false);
    assert.equal(isSuperAdmin(denied), false);
  }
});

test('resource ownership rejects missing and mismatched IDs and supports populated references', () => {
  const { user } = context();
  assert.equal(ownsResource({ user, resource: { user: user.id } }), true);
  assert.equal(ownsResource({ user, resource: { user: { _id: new mongoose.Types.ObjectId(user.id) } } }), true);
  for (const resource of [null, {}, { user: new mongoose.Types.ObjectId() }, { user: { $ne: null } }]) {
    assert.equal(ownsResource({ user, resource }), false);
  }
  assert.equal(ownsResource({ user: null, resource: {} }), false);
});

test('resource access requires permission plus an explicitly successful policy', async () => {
  const allowed = context();
  const resource = { user: allowed.user.id };
  assert.equal(await canAccessResource(allowed, 'student.view', resource, ownsResource), true);
  assert.equal(await canAccessResource(allowed, 'student.edit', resource, ownsResource), false);
  for (const policy of [undefined, async () => false, async () => undefined, async () => 'yes']) {
    assert.equal(await canAccessResource(allowed, 'student.view', resource, policy), false);
  }
  await assert.rejects(canAccessResource(allowed, 'student.view', resource, async () => { throw new Error('lookup failed'); }), /lookup failed/);
});

test('Super Admin resource bypass is opt-in and never bypasses missing resources or permissions', async () => {
  const admin = context('super_admin');
  const resource = { user: new mongoose.Types.ObjectId() };
  assert.equal(isSuperAdmin(admin), true);
  assert.equal(hasRole(admin, 'teacher'), false);
  assert.equal(await canAccessResource(admin, 'student.view', resource, ownsResource), false);
  assert.equal(await canAccessResource(admin, 'student.view', resource, ownsResource, { allowSuperAdmin: true }), true);
  assert.equal(await canAccessResource(admin, 'unknown.view', resource, ownsResource, { allowSuperAdmin: true }), false);
  assert.equal(await canAccessResource(admin, 'student.view', null, ownsResource, { allowSuperAdmin: true }), false);
  assert.equal(await canAccessResource(context('admin'), 'student.view', resource, ownsResource, { allowSuperAdmin: true }), false);
});

test('misconfigured guards fail immediately rather than silently allowing access', () => {
  assert.throws(() => requireRole());
  assert.throws(() => requireRole('unknown'));
  assert.throws(() => requirePermission());
  assert.throws(() => requirePermission('*'));
  assert.throws(() => requireResource('student.view'));
  assert.throws(() => requireResource('student.view', { load() {}, policy() {}, allowSuperAdmin: 'true' }));
});
