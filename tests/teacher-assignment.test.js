import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import TeacherAssignment from '../src/models/TeacherAssignment.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { teacherAssignmentListParams } from '../src/services/teacher-assignment.service.js';
import { teacherAssignmentFormValues, validateTeacherAssignment } from '../src/validators/teacher-assignment.validator.js';

function authorization(roleName, permissions) {
  const role = defaultRoles.find((item) => item._id === roleName);
  return {
    user: { id: '000000000000000000000123', role: roleName, name: '<script>Ada</script>', status: 'active' },
    role: { id: roleName, name: role.name, status: 'active' },
    permissions: new Set(permissions ?? role.permissions),
  };
}

function render(view, data) {
  return ejs.renderFile(fileURLToPath(new URL(`../src/views/${view}.ejs`, import.meta.url)), data);
}

test('teacher assignment permissions and navigation are configured for scoped roles', () => {
  for (const permission of ['teacher_assignment.view', 'teacher_assignment.create', 'teacher_assignment.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
  }
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('teacher_assignment.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'teacher').permissions.includes('teacher_assignment.view'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/teacher-assignments'));
  assert.ok(getNavigation(authorization('teacher')).some((item) => item.href === '/teacher-assignments'));
  assert.ok(!getNavigation(authorization('student')).some((item) => item.href === '/teacher-assignments'));
});

test('teacher assignment validator normalizes values and rejects invalid relationships', () => {
  const oid = new mongoose.Types.ObjectId().toString();
  const valid = validateTeacherAssignment({
    teacher: ` ${oid} `, academicYear: oid, class: oid, section: oid, subject: oid, status: 'inactive',
  });
  assert.equal(valid.data.teacher, oid);
  assert.equal(valid.data.status, 'inactive');
  assert.deepEqual(valid.errors, {});
  const invalid = validateTeacherAssignment({ teacher: 'bad', academicYear: '', class: 'bad', section: 'bad', subject: 'bad', status: 'missing' });
  assert.deepEqual(Object.keys(invalid.errors), ['teacher', 'academicYear', 'class', 'section', 'subject']);
  assert.equal(invalid.data.status, 'active');
});

test('teacher assignment model accepts valid references and list params are constrained', async () => {
  const oid = () => new mongoose.Types.ObjectId();
  const assignment = new TeacherAssignment({
    teacher: oid(), academicYear: oid(), class: oid(), section: oid(), subject: oid(), status: 'active',
  });
  await assignment.validate();
  assert.deepEqual(teacherAssignmentListParams({ page: '-1', status: 'missing', sort: 'bad' }), {
    page: 1, limit: 10, q: '', status: '', academicYear: '', class: '', section: '', teacher: '', subject: '', sort: 'recent',
  });
  assert.equal(teacherAssignmentListParams({ page: '2', status: 'inactive', sort: 'subject' }).page, 2);
});

test('teacher assignment views escape content and show relationship navigation', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const assignment = {
    _id: id, id, status: 'active',
    teacher: { _id: id, teacherId: '<script>T-1</script>', name: '<script>Ada</script>' },
    academicYear: { _id: id, name: '2026' },
    class: { _id: id, name: 'Grade 8' },
    section: { _id: id, name: 'A' },
    subject: { _id: id, name: '<script>Math</script>', code: 'MTH' },
  };
  const locals = {
    title: 'Teacher assignments', activePage: 'teacher-assignments', currentUser: { name: 'Admin' }, currentRoleName: 'Admin',
    navigation: [], csrfToken: 'test-csrf-token',
  };
  const formOptions = { teachers: [assignment.teacher], academicYears: [assignment.academicYear], classes: [assignment.class], sections: [assignment.section], subjects: [assignment.subject] };
  const index = await render('teacher-assignments/index', {
    ...locals, records: [assignment],
    filters: { page: 1, q: '<script>', status: '', academicYear: '', class: '', section: '', teacher: '', subject: '', sort: 'recent' },
    totalPages: 1, previousUrl: null, nextUrl: null, formOptions, canManage: true, message: null,
  });
  assert.ok(!index.includes('<script>Ada'));
  assert.match(index, /href="\/teacher-assignments\//);
  const form = await render('teacher-assignments/form', {
    ...locals, title: 'Edit teacher assignment', assignment, values: teacherAssignmentFormValues(assignment), errors: {}, message: null, formOptions,
  });
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  assert.match(form, /Choose active records only/);
  const show = await render('teacher-assignments/show', { ...locals, title: 'Teacher assignment', assignment, canManage: true });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Class subject teachers/);
});
