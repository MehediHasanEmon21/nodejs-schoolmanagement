import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import Guardian from '../src/models/Guardian.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { canAccessGuardian, guardianListParams } from '../src/services/guardian.service.js';
import { validateGuardian, guardianFormValues } from '../src/validators/guardian.validator.js';

function render(view, data) {
  return ejs.renderFile(fileURLToPath(new URL(`../src/views/${view}.ejs`, import.meta.url)), data);
}

function authorization(roleName = 'admin', userId = new mongoose.Types.ObjectId().toString()) {
  const role = defaultRoles.find((item) => item._id === roleName);
  return {
    user: { id: userId, _id: userId, role: roleName, name: 'Ada', status: 'active' },
    role: { id: roleName, name: role.name, status: 'active' },
    permissions: new Set(role.permissions),
  };
}

test('guardian permissions and navigation are available to admin and guardians', () => {
  for (const permission of ['guardian.view', 'guardian.create', 'guardian.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
  }
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('guardian.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'guardian').permissions.includes('guardian.view'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/guardians'));
  assert.ok(getNavigation(authorization('guardian')).some((item) => item.href === '/guardians'));
  assert.ok(!getNavigation(authorization('student')).some((item) => item.href === '/guardians'));
});

test('guardian validator normalizes values and requires linked students', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const studentId = new mongoose.Types.ObjectId().toString();
  const valid = validateGuardian({
    guardianId: ' g-001 ', user: userId, name: '  Ada Guardian ', email: ' ADA@EXAMPLE.TEST ',
    phone: ' 555 ', relationship: ' Mother ', students: [studentId, studentId], address: ' Dhaka ',
  });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.values.guardianId, 'G-001');
  assert.equal(valid.values.email, 'ada@example.test');
  assert.deepEqual(valid.values.students, [studentId]);
  const invalid = validateGuardian({ guardianId: '', name: '', phone: '', relationship: '', email: 'bad' });
  assert.equal(invalid.errors.guardianId, 'Enter a guardian ID up to 40 characters.');
  assert.equal(invalid.errors.email, 'Enter a valid email address.');
  assert.equal(invalid.errors.students, 'Choose at least one linked student.');
});

test('guardian model and access policy enforce relationship invariants', async () => {
  const studentId = new mongoose.Types.ObjectId();
  await assert.rejects(new Guardian({ guardianId: '', name: 'Ada', phone: '555', relationship: 'Mother', students: [studentId] }).validate());
  await assert.rejects(new Guardian({ guardianId: 'G-001', name: 'Ada', phone: '555', relationship: 'Mother', students: [studentId, studentId] }).validate(),
    /Student links must be unique/);
  const userId = new mongoose.Types.ObjectId();
  const guardian = new Guardian({ guardianId: 'G-001', user: userId, name: 'Ada', phone: '555', relationship: 'Mother', students: [studentId] });
  await guardian.validate();
  assert.equal(canAccessGuardian(authorization('admin'), guardian), true);
  assert.equal(canAccessGuardian(authorization('guardian', userId.toString()), guardian), true);
  assert.equal(canAccessGuardian(authorization('guardian'), guardian), false);
  assert.equal(canAccessGuardian(authorization('student'), guardian), false);
});

test('guardian list params clamp pagination and whitelist filters', () => {
  assert.deepEqual(guardianListParams({ page: '-4', status: 'missing', sort: 'unknown' }), {
    page: 1, limit: 10, q: '', status: '', sort: 'name',
  });
  assert.equal(guardianListParams({ page: '3', status: 'active', sort: 'relationship', q: 'Mother' }).page, 3);
  assert.equal(guardianListParams({ page: '3', status: 'active', sort: 'relationship', q: 'Mother' }).q, 'Mother');
});

test('guardian views escape content and preserve linked student controls', async () => {
  const student = {
    _id: new mongoose.Types.ObjectId(),
    id: new mongoose.Types.ObjectId().toString(),
    studentId: '<script>ST</script>',
    firstName: '<script>Ada</script>',
    lastName: 'Student',
  };
  const guardian = {
    _id: new mongoose.Types.ObjectId(),
    id: new mongoose.Types.ObjectId().toString(),
    guardianId: '<script>G</script>',
    name: '<script>Guardian</script>',
    email: '',
    phone: '555',
    relationship: '<script>Mother</script>',
    address: '<script>Dhaka</script>',
    students: [student],
    status: 'active',
    user: null,
  };
  const locals = {
    title: 'Guardians', activePage: 'guardians', currentUser: { name: 'Admin' }, currentRoleName: 'Admin',
    navigation: getNavigation(authorization()), csrfToken: 'test-csrf-token',
  };
  const index = await render('guardians/index', {
    ...locals, records: [guardian], filters: { page: 1, q: '<script>', status: '', sort: 'name' },
    total: 1, totalPages: 1, canManage: true, message: '<script>', previousUrl: null, nextUrl: null,
  });
  assert.ok(!index.includes('<script>'));
  assert.match(index, /href="\/guardians\//);
  const form = await render('guardians/form', {
    ...locals, title: 'Edit guardian', guardian, values: guardianFormValues(guardian), errors: {}, message: null,
    formOptions: { users: [], students: [student] },
  });
  assert.ok(!form.includes('<script>'));
  assert.match(form, /checked/);
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  const show = await render('guardians/show', { ...locals, title: 'Guardian', guardian, canManage: true });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Deactivate/);
});
