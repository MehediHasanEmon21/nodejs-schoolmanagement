import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import Student from '../src/models/Student.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { canAccessStudent, studentListParams } from '../src/services/student.service.js';
import { validateStudent, studentFormValues } from '../src/validators/student.validator.js';
import { defaultRoles } from '../src/config/authorization.js';

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

test('student navigation is linked for permitted roles', () => {
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/students'));
  assert.ok(getNavigation(authorization('teacher')).some((item) => item.href === '/students'));
  assert.ok(getNavigation(authorization('student')).some((item) => item.href === '/students'));
});

test('student validator normalizes profile values and rejects invalid input', () => {
  const classId = new mongoose.Types.ObjectId().toString();
  const sectionId = new mongoose.Types.ObjectId().toString();
  const valid = validateStudent({
    studentId: ' st-001 ', firstName: '  Ada ', lastName: ' Lovelace ', dateOfBirth: '2015-01-02',
    admissionDate: '2026-01-10', gender: 'female', phone: ' 123 ', class: classId, section: sectionId,
  });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.values.studentId, 'ST-001');
  assert.equal(valid.values.firstName, 'Ada');
  assert.equal(valid.data.class, classId);
  const invalid = validateStudent({ studentId: '', firstName: '', lastName: '', dateOfBirth: 'bad', admissionDate: '2026-01-10', gender: 'bad', section: sectionId });
  assert.equal(invalid.errors.studentId, 'Enter a student ID up to 40 characters.');
  assert.equal(invalid.errors.dateOfBirth, 'Enter a valid date of birth.');
  assert.equal(invalid.errors.gender, 'Choose a valid gender.');
  assert.equal(invalid.errors.section, 'Choose a class before choosing a section.');
});

test('student model and access policy enforce core invariants', async () => {
  await assert.rejects(new Student({ studentId: '', firstName: 'Ada', lastName: 'Lovelace' }).validate());
  const userId = new mongoose.Types.ObjectId();
  const student = new Student({
    studentId: 'ST-001',
    user: userId,
    firstName: 'Ada',
    lastName: 'Lovelace',
    dateOfBirth: new Date('2015-01-02'),
    admissionDate: new Date('2026-01-10'),
    gender: 'female',
    status: 'active',
  });
  await student.validate();
  assert.equal(canAccessStudent(authorization('admin'), student), true);
  assert.equal(canAccessStudent(authorization('teacher'), student), true);
  assert.equal(canAccessStudent(authorization('student', userId.toString()), student), true);
  assert.equal(canAccessStudent(authorization('student'), student), false);
  student.status = 'inactive';
  assert.equal(canAccessStudent(authorization('teacher'), student), false);
});

test('student list params clamp pagination and whitelist filters', () => {
  const id = new mongoose.Types.ObjectId().toString();
  assert.deepEqual(studentListParams({ page: '-4', status: 'missing', class: 'bad', sort: 'unknown' }), {
    page: 1, limit: 10, q: '', status: '', class: '', section: '', sort: 'name',
  });
  assert.equal(studentListParams({ page: '3', status: 'active', class: id, sort: 'admissionDate' }).page, 3);
  assert.equal(studentListParams({ section: id }).section, id);
});

test('student views escape content and preserve management controls', async () => {
  const classId = new mongoose.Types.ObjectId();
  const sectionId = new mongoose.Types.ObjectId();
  const student = {
    _id: new mongoose.Types.ObjectId(), id: new mongoose.Types.ObjectId().toString(), studentId: '<script>ST</script>',
    firstName: '<script>Ada</script>', lastName: 'Lovelace', dateOfBirth: new Date('2015-01-02'),
    admissionDate: new Date('2026-01-10'), gender: 'female', phone: '', address: '', status: 'active',
    class: { _id: classId, name: '<script>Grade</script>' }, section: { _id: sectionId, name: 'A' }, user: null,
  };
  const locals = {
    title: 'Students', activePage: 'students', currentUser: { name: 'Admin' }, currentRoleName: 'Admin',
    navigation: getNavigation(authorization()), csrfToken: 'test-csrf-token',
  };
  const index = await render('students/index', {
    ...locals, records: [student], filters: { page: 1, q: '<script>', status: '', class: '', section: '', sort: 'name' },
    total: 1, totalPages: 1, classes: [student.class], canManage: true, message: '<script>', previousUrl: null, nextUrl: null,
  });
  assert.ok(!index.includes('<script>'));
  assert.match(index, /href="\/students\//);
  const form = await render('students/form', {
    ...locals, title: 'Edit student', student, values: studentFormValues(student), errors: {}, message: null,
    formOptions: { classes: [student.class], sections: [{ _id: sectionId, name: 'A', class: student.class }], users: [] },
  });
  assert.ok(!form.includes('<script>'));
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  const show = await render('students/show', { ...locals, title: 'Ada Lovelace', student, canManage: true });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Deactivate/);
});
