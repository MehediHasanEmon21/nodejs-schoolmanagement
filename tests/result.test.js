import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import Mark from '../src/models/Mark.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { calculateResult, calculateSubjectResult } from '../src/services/result.service.js';
import { validateMarkEntry } from '../src/validators/result.validator.js';

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

test('result permissions and navigation are configured for scoped roles', () => {
  for (const permission of ['result.view', 'result.create', 'result.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
  }
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('result.edit'));
  assert.ok(defaultRoles.find((role) => role._id === 'teacher').permissions.includes('result.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'student').permissions.includes('result.view'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/results'));
});

test('mark entry validator normalizes values and rejects malformed marks', () => {
  const oid = new mongoose.Types.ObjectId().toString();
  const valid = validateMarkEntry({ exam: oid, subject: oid, [`marks_${oid}`]: '88.5', [`note_${oid}`]: ' Excellent ' });
  assert.equal(valid.data.marks[oid].number, 88.5);
  assert.equal(valid.data.marks[oid].note, 'Excellent');
  assert.deepEqual(valid.errors, {});
  const invalid = validateMarkEntry({ exam: 'bad', subject: '', [`marks_${oid}`]: 'nope' });
  assert.ok(invalid.errors.exam);
  assert.ok(invalid.errors.subject);
  assert.ok(invalid.errors.marks);
});

test('mark model accepts valid marks and calculation returns grade/result', async () => {
  const oid = () => new mongoose.Types.ObjectId();
  const mark = new Mark({ exam: oid(), subject: oid(), student: oid(), enrollment: oid(), marksObtained: 72, recordedBy: oid() });
  await mark.validate();
  const subject = calculateSubjectResult({ marksObtained: 72 }, { totalMarks: 100, passMarks: 33 });
  assert.equal(subject.grade, 'B');
  assert.equal(subject.passed, true);
  const summary = calculateResult([{ result: subject }, { result: calculateSubjectResult({ marksObtained: 20 }, { totalMarks: 50, passMarks: 25 }) }]);
  assert.equal(summary.passed, false);
  assert.equal(summary.grade, 'F');
});

test('result views escape content and expose result navigation', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const exam = { _id: id, id, name: '<script>Final</script>', academicYear: { _id: id, name: '2026' }, class: { _id: id, name: '<script>Grade</script>' }, subjects: [{ subject: { _id: id, name: 'Math' }, totalMarks: 100, passMarks: 33 }] };
  const student = { _id: id, firstName: '<script>Ada</script>', lastName: 'Lovelace' };
  const locals = { title: 'Results', activePage: 'results', currentUser: { name: 'Admin' }, currentRoleName: 'Admin', navigation: [], csrfToken: 'test-csrf-token' };
  const index = await render('results/index', { ...locals, formOptions: { exams: [exam] }, message: null });
  assert.ok(!index.includes('<script>'));
  assert.match(index, /Class result/);
  const entry = await render('results/entry', {
    ...locals,
    values: { exam: id, subject: id, marks: {} },
    errors: {}, message: null,
    formOptions: { exams: [exam] },
    loaded: { exam, subjectConfig: exam.subjects[0], roster: [{ _id: id, rollNumber: '1', student, mark: { marksObtained: 75, note: '<script>note</script>' } }] },
  });
  assert.match(entry, /name="_csrf" value="test-csrf-token"/);
  assert.match(entry, /name="marks_/);
  assert.ok(!entry.includes('<script>'));
  const result = calculateSubjectResult({ marksObtained: 75 }, exam.subjects[0]);
  const show = await render('results/student', { ...locals, exam, student, rows: [{ subject: exam.subjects[0].subject, mark: { marksObtained: 75 }, result }], summary: calculateResult([{ result }]) });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Pass/);
});
