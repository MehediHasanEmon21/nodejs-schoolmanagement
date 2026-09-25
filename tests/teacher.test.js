import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import Teacher from '../src/models/Teacher.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { canAccessTeacher, teacherListParams } from '../src/services/teacher.service.js';
import { validateTeacher, teacherFormValues } from '../src/validators/teacher.validator.js';

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

test('teacher permissions and navigation are linked for permitted roles', () => {
  for (const permission of ['teacher.view', 'teacher.create', 'teacher.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
  }
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('teacher.create'));
  assert.ok(!defaultRoles.find((role) => role._id === 'teacher').permissions.includes('teacher.create'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/teachers'));
  assert.ok(getNavigation(authorization('teacher')).some((item) => item.href === '/teachers'));
});

test('teacher validator normalizes values and rejects invalid input', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const valid = validateTeacher({
    teacherId: ' t-001 ', user: userId, name: '  Ada Lovelace ', email: ' ADA@EXAMPLE.TEST ',
    phone: ' 555 ', joiningDate: '2026-01-10', qualification: ' MSc ',
  });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.values.teacherId, 'T-001');
  assert.equal(valid.values.email, 'ada@example.test');
  assert.equal(valid.data.user, userId);
  const invalid = validateTeacher({ teacherId: '', name: '', email: 'bad', joiningDate: 'bad' });
  assert.equal(invalid.errors.teacherId, 'Enter a teacher ID up to 40 characters.');
  assert.equal(invalid.errors.name, 'Enter a teacher name up to 120 characters.');
  assert.equal(invalid.errors.email, 'Enter a valid email address.');
  assert.equal(invalid.errors.joiningDate, 'Enter a valid joining date.');
});

test('teacher model and access policy enforce core invariants', async () => {
  await assert.rejects(new Teacher({ teacherId: '', name: 'Ada', email: 'ada@example.test' }).validate());
  const userId = new mongoose.Types.ObjectId();
  const teacher = new Teacher({
    teacherId: 'T-001',
    user: userId,
    name: 'Ada Lovelace',
    email: 'ada@example.test',
    joiningDate: new Date('2026-01-10'),
    status: 'active',
  });
  await teacher.validate();
  assert.equal(canAccessTeacher(authorization('admin'), teacher), true);
  assert.equal(canAccessTeacher(authorization('teacher'), teacher), true);
  teacher.status = 'inactive';
  assert.equal(canAccessTeacher(authorization('teacher'), teacher), false);
  assert.equal(canAccessTeacher(authorization('teacher', userId.toString()), teacher), true);
  assert.equal(canAccessTeacher(authorization('student'), teacher), false);
});

test('teacher list params clamp pagination and whitelist filters', () => {
  assert.deepEqual(teacherListParams({ page: '-4', status: 'missing', sort: 'unknown' }), {
    page: 1, limit: 10, q: '', status: '', sort: 'name',
  });
  assert.equal(teacherListParams({ page: '3', status: 'active', sort: 'joiningDate', q: 'Ada' }).page, 3);
  assert.equal(teacherListParams({ page: '3', status: 'active', sort: 'joiningDate', q: 'Ada' }).q, 'Ada');
});

test('teacher views escape content and preserve management controls', async () => {
  const teacher = {
    _id: new mongoose.Types.ObjectId(),
    id: new mongoose.Types.ObjectId().toString(),
    teacherId: '<script>T</script>',
    name: '<script>Ada</script>',
    email: 'ada@example.test',
    phone: '',
    joiningDate: new Date('2026-01-10'),
    qualification: '<script>MSc</script>',
    status: 'active',
    user: null,
  };
  const locals = {
    title: 'Teachers', activePage: 'teachers', currentUser: { name: 'Admin' }, currentRoleName: 'Admin',
    navigation: getNavigation(authorization()), csrfToken: 'test-csrf-token',
  };
  const index = await render('teachers/index', {
    ...locals, records: [teacher], filters: { page: 1, q: '<script>', status: '', sort: 'name' },
    total: 1, totalPages: 1, canManage: true, message: '<script>', previousUrl: null, nextUrl: null,
  });
  assert.ok(!index.includes('<script>'));
  assert.match(index, /href="\/teachers\//);
  const form = await render('teachers/form', {
    ...locals, title: 'Edit teacher', teacher, values: teacherFormValues(teacher), errors: {}, message: null,
    formOptions: { users: [] },
  });
  assert.ok(!form.includes('<script>'));
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  const show = await render('teachers/show', { ...locals, title: 'Ada Lovelace', teacher, canManage: true });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Deactivate/);
});
