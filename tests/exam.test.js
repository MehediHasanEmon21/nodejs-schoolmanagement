import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import Exam from '../src/models/Exam.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { examListParams } from '../src/services/exam.service.js';
import { examFormValues, validateExam } from '../src/validators/exam.validator.js';

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

test('exam permissions and navigation are configured for scoped roles', () => {
  for (const permission of ['exam.view', 'exam.create', 'exam.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
  }
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('exam.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'teacher').permissions.includes('exam.view'));
  assert.ok(defaultRoles.find((role) => role._id === 'student').permissions.includes('exam.view'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/exams'));
});

test('exam validator normalizes subject setup and rejects invalid schedules', () => {
  const oid = new mongoose.Types.ObjectId().toString();
  const valid = validateExam({
    academicYear: oid, class: oid, name: ' Midterm  Exam ', startDate: '2026-06-01', endDate: '2026-06-10', status: 'scheduled',
    subjects: [oid], totalMarks: ['100'], passMarks: ['33'], examDate: ['2026-06-05'],
  });
  assert.equal(valid.data.name, 'Midterm Exam');
  assert.equal(valid.data.subjects[0].totalMarks, 100);
  assert.deepEqual(valid.errors, {});
  const invalid = validateExam({
    academicYear: 'bad', class: '', name: '', startDate: '2026-06-10', endDate: '2026-06-01',
    subjects: [oid, oid], totalMarks: ['20', '10'], passMarks: ['21', '5'], examDate: ['2026-07-01', 'bad'],
  });
  assert.ok(invalid.errors.academicYear);
  assert.ok(invalid.errors.class);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.endDate);
  assert.ok(invalid.errors.subjects);
});

test('exam model accepts subject mark rules and list params are constrained', async () => {
  const oid = () => new mongoose.Types.ObjectId();
  const exam = new Exam({
    academicYear: oid(), class: oid(), name: 'Final', startDate: new Date('2026-10-01'), endDate: new Date('2026-10-10'),
    subjects: [{ subject: oid(), totalMarks: 100, passMarks: 33, examDate: new Date('2026-10-03') }],
    status: 'scheduled',
  });
  await exam.validate();
  assert.deepEqual(examListParams({ page: '-1', status: 'missing', sort: 'bad' }), {
    page: 1, limit: 10, status: '', academicYear: '', class: '', sort: 'startDate',
  });
  assert.equal(examListParams({ page: '2', status: 'draft', sort: 'name' }).page, 2);
});

test('exam views escape content and preserve subject setup controls', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const exam = {
    _id: id, id, name: '<script>Midterm</script>', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-10'), status: 'scheduled',
    academicYear: { _id: id, name: '2026' },
    class: { _id: id, name: '<script>Grade</script>' },
    subjects: [{ subject: { _id: id, name: '<script>Math</script>', code: 'MTH' }, totalMarks: 100, passMarks: 33, examDate: new Date('2026-06-05') }],
  };
  const locals = {
    title: 'Exams', activePage: 'exams', currentUser: { name: 'Admin' }, currentRoleName: 'Admin',
    navigation: [], csrfToken: 'test-csrf-token',
  };
  const formOptions = { academicYears: [exam.academicYear], classes: [exam.class], subjects: [exam.subjects[0].subject] };
  const index = await render('exams/index', {
    ...locals, records: [exam], filters: { page: 1, status: '', academicYear: '', class: '', sort: 'startDate' },
    totalPages: 1, previousUrl: null, nextUrl: null, formOptions, canManage: true, message: null,
  });
  assert.ok(!index.includes('<script>'));
  assert.match(index, /href="\/exams\//);
  const form = await render('exams/form', {
    ...locals, exam, values: examFormValues(exam), errors: {}, message: null, formOptions,
  });
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  assert.match(form, /name="totalMarks"/);
  assert.ok(!form.includes('<script>'));
  const show = await render('exams/show', { ...locals, exam, canManage: true });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Subject setup/);
});
