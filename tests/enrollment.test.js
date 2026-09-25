import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import Enrollment from '../src/models/Enrollment.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { enrollmentListParams } from '../src/services/enrollment.service.js';
import { validateEnrollment, enrollmentFormValues } from '../src/validators/enrollment.validator.js';

function render(view, data) {
  return ejs.renderFile(fileURLToPath(new URL(`../src/views/${view}.ejs`, import.meta.url)), data);
}

function authorization(roleName = 'admin') {
  const role = defaultRoles.find((item) => item._id === roleName);
  return {
    user: { id: new mongoose.Types.ObjectId().toString(), role: roleName, name: 'Ada', status: 'active' },
    role: { id: roleName, name: role.name, status: 'active' },
    permissions: new Set(role.permissions),
  };
}

test('enrollment permissions and navigation are configured for scoped roles', () => {
  for (const permission of ['enrollment.view', 'enrollment.create', 'enrollment.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
  }
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('enrollment.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'teacher').permissions.includes('enrollment.view'));
  assert.ok(defaultRoles.find((role) => role._id === 'student').permissions.includes('enrollment.view'));
  assert.ok(defaultRoles.find((role) => role._id === 'guardian').permissions.includes('enrollment.view'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/enrollments'));
  assert.ok(getNavigation(authorization('student')).some((item) => item.href === '/enrollments'));
});

test('enrollment validator normalizes values and rejects invalid relationships', () => {
  const ids = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId().toString());
  const valid = validateEnrollment({
    student: ids[0], academicYear: ids[1], class: ids[2], section: ids[3],
    rollNumber: '  12 ', enrollmentDate: '2026-01-10',
  });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.values.rollNumber, '12');
  assert.equal(valid.data.enrollmentDate.toISOString().slice(0, 10), '2026-01-10');
  const invalid = validateEnrollment({ student: 'bad', rollNumber: '', enrollmentDate: 'bad' });
  assert.equal(invalid.errors.student, 'Choose a valid student.');
  assert.equal(invalid.errors.academicYear, 'Choose a valid academic year.');
  assert.equal(invalid.errors.class, 'Choose a valid class.');
  assert.equal(invalid.errors.section, 'Choose a valid section.');
  assert.equal(invalid.errors.rollNumber, 'Enter a roll number up to 40 characters.');
});

test('enrollment model accepts valid references and list params are constrained', async () => {
  const ids = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId());
  await new Enrollment({
    student: ids[0], academicYear: ids[1], class: ids[2], section: ids[3],
    rollNumber: '12', enrollmentDate: new Date('2026-01-10'), status: 'active',
  }).validate();
  assert.deepEqual(enrollmentListParams({ page: '-1', status: 'missing', sort: 'bad' }), {
    page: 1, limit: 10, q: '', status: '', academicYear: '', class: '', section: '', sort: 'enrollmentDate',
  });
  assert.equal(enrollmentListParams({ page: '2', status: 'completed', sort: 'rollNumber' }).page, 2);
});

test('enrollment views escape content and show relationship navigation', async () => {
  const id = new mongoose.Types.ObjectId();
  const student = { _id: id, firstName: '<script>Ada</script>', lastName: 'Student', studentId: '<script>ST</script>' };
  const academicYear = { _id: new mongoose.Types.ObjectId(), name: '<script>2026</script>' };
  const schoolClass = { _id: new mongoose.Types.ObjectId(), name: '<script>Grade</script>' };
  const section = { _id: new mongoose.Types.ObjectId(), name: '<script>A</script>', class: schoolClass };
  const enrollment = {
    _id: new mongoose.Types.ObjectId(), id: new mongoose.Types.ObjectId().toString(),
    student, academicYear, class: schoolClass, section, rollNumber: '<script>12</script>',
    enrollmentDate: new Date('2026-01-10'), status: 'active',
  };
  const locals = {
    title: 'Enrollments', activePage: 'enrollments', currentUser: { name: 'Admin' }, currentRoleName: 'Admin',
    navigation: getNavigation(authorization()), csrfToken: 'test-csrf-token',
  };
  const index = await render('enrollments/index', {
    ...locals, records: [enrollment], filters: { page: 1, q: '<script>', status: '', academicYear: '', class: '', section: '', sort: 'enrollmentDate' },
    total: 1, totalPages: 1, formOptions: { academicYears: [academicYear], classes: [schoolClass], sections: [section], students: [student] },
    canManage: true, message: '<script>', previousUrl: null, nextUrl: null,
  });
  assert.ok(!index.includes('<script>'));
  assert.match(index, /href="\/enrollments\//);
  const form = await render('enrollments/form', {
    ...locals, title: 'Edit enrollment', enrollment, values: enrollmentFormValues(enrollment), errors: {}, message: null,
    formOptions: { academicYears: [academicYear], classes: [schoolClass], sections: [section], students: [student] },
  });
  assert.ok(!form.includes('<script>'));
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  const show = await render('enrollments/show', { ...locals, title: 'Enrollment', enrollment, canManage: true });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Enrollment history/);
});
