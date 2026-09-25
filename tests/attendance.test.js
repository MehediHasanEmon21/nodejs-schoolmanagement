import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import Attendance from '../src/models/Attendance.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { attendanceListParams } from '../src/services/attendance.service.js';
import { attendanceFormValues, validateAttendance } from '../src/validators/attendance.validator.js';

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

test('attendance permissions and navigation are configured for scoped roles', () => {
  for (const permission of ['attendance.view', 'attendance.create', 'attendance.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
  }
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('attendance.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'teacher').permissions.includes('attendance.view'));
  assert.ok(defaultRoles.find((role) => role._id === 'student').permissions.includes('attendance.view'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/attendance'));
  assert.ok(getNavigation(authorization('teacher')).some((item) => item.href === '/attendance'));
});

test('attendance validator normalizes values and collects roster statuses', () => {
  const studentId = new mongoose.Types.ObjectId().toString();
  const oid = new mongoose.Types.ObjectId().toString();
  const valid = validateAttendance({
    academicYear: ` ${oid} `, class: oid, section: oid, date: '2026-09-25',
    [`status_${studentId}`]: 'late', [`note_${studentId}`]: ' Arrived after bell ',
  });
  assert.equal(valid.data.academicYear, oid);
  assert.equal(valid.data.records[studentId].status, 'late');
  assert.equal(valid.data.records[studentId].note, 'Arrived after bell');
  assert.equal(valid.errors.date, undefined);
  const invalid = validateAttendance({ academicYear: 'bad', class: '', section: 'bad', date: 'nope' });
  assert.deepEqual(Object.keys(invalid.errors), ['academicYear', 'class', 'section', 'date']);
});

test('attendance model accepts embedded records and list params are constrained', async () => {
  const oid = () => new mongoose.Types.ObjectId();
  const date = new Date('2026-09-25T15:45:00.000Z');
  const attendance = new Attendance({
    academicYear: oid(), class: oid(), section: oid(), date,
    records: [{ student: oid(), enrollment: oid(), status: 'present' }],
    recordedBy: oid(),
  });
  await attendance.validate();
  assert.equal(attendance.date.toISOString(), '2026-09-25T00:00:00.000Z');
  assert.deepEqual(attendanceListParams({ page: '-1', sort: 'bad', date: 'bad' }), {
    page: 1, limit: 10, academicYear: '', class: '', section: '', date: '', sort: 'date',
  });
  assert.equal(attendanceListParams({ page: '2', sort: 'class', date: '2026-09-25' }).page, 2);
});

test('attendance views escape content and preserve roster controls', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const attendance = {
    _id: id, id, date: new Date('2026-09-25T00:00:00.000Z'),
    academicYear: { _id: id, name: '2026' },
    class: { _id: id, name: '<script>Grade</script>' },
    section: { _id: id, name: 'A' },
    records: [{ student: { _id: id, firstName: '<script>Ada</script>', lastName: 'Lovelace' }, enrollment: { rollNumber: '<script>1</script>' }, status: 'present', note: '<script>note</script>' }],
  };
  const locals = {
    title: 'Attendance', activePage: 'attendance', currentUser: { name: 'Admin' }, currentRoleName: 'Admin',
    navigation: [], csrfToken: 'test-csrf-token',
  };
  const formOptions = { academicYears: [attendance.academicYear], classes: [attendance.class], sections: [attendance.section] };
  const index = await render('attendance/index', {
    ...locals, records: [attendance], filters: { page: 1, academicYear: '', class: '', section: '', date: '', sort: 'date' },
    totalPages: 1, previousUrl: null, nextUrl: null, formOptions, canManage: true, message: null,
  });
  assert.ok(!index.includes('<script>'));
  assert.match(index, /href="\/attendance\//);
  const form = await render('attendance/form', {
    ...locals, attendance: null, values: attendanceFormValues(null, { academicYear: id, class: id, section: id, date: '2026-09-25' }),
    errors: {}, message: null, roster: [{ _id: id, rollNumber: '1', student: { _id: id, firstName: '<script>Ada</script>', lastName: 'Lovelace' } }],
    statuses: ['present', 'absent', 'late', 'excused'], formOptions,
  });
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  assert.match(form, /name="status_/);
  assert.ok(!form.includes('<script>'));
  const show = await render('attendance/show', { ...locals, attendance, canEdit: true });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Class summary/);
});
