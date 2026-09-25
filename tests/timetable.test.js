import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import TimetableEntry from '../src/models/TimetableEntry.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { groupTimetable } from '../src/services/timetable.service.js';
import { timetableFormValues, timetableListParams, validateTimetableEntry } from '../src/validators/timetable.validator.js';

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

test('timetable permissions and navigation are configured for scoped roles', () => {
  for (const permission of ['timetable.view', 'timetable.create', 'timetable.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
  }
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('timetable.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'teacher').permissions.includes('timetable.view'));
  assert.ok(defaultRoles.find((role) => role._id === 'student').permissions.includes('timetable.view'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/timetable'));
  assert.ok(getNavigation(authorization('teacher')).some((item) => item.href === '/timetable'));
});

test('timetable validator normalizes values and rejects invalid times', () => {
  const oid = new mongoose.Types.ObjectId().toString();
  const valid = validateTimetableEntry({
    academicYear: ` ${oid} `, class: oid, section: oid, subject: oid, teacher: oid,
    day: 'wednesday', startTime: '09:00', endTime: '09:45', room: '  Room 2  ', status: 'inactive',
  });
  assert.equal(valid.data.academicYear, oid);
  assert.equal(valid.data.room, 'Room 2');
  assert.equal(valid.data.status, 'inactive');
  assert.deepEqual(valid.errors, {});
  const invalid = validateTimetableEntry({ academicYear: 'bad', class: '', section: 'bad', subject: 'bad', teacher: 'bad', startTime: '25:00', endTime: '08:00' });
  assert.deepEqual(Object.keys(invalid.errors), ['academicYear', 'class', 'section', 'subject', 'teacher', 'startTime']);
  const reversed = validateTimetableEntry({ academicYear: oid, class: oid, section: oid, subject: oid, teacher: oid, startTime: '10:00', endTime: '09:59' });
  assert.equal(reversed.errors.endTime, 'End time must be after start time.');
});

test('timetable model accepts valid entries and list params are constrained', async () => {
  const oid = () => new mongoose.Types.ObjectId();
  const entry = new TimetableEntry({
    academicYear: oid(), class: oid(), section: oid(), subject: oid(), teacher: oid(),
    day: 'monday', startTime: '08:00', endTime: '08:45', room: 'Lab',
  });
  await entry.validate();
  assert.deepEqual(timetableListParams({ academicYear: 'bad', day: 'funday' }), {
    academicYear: '', class: '', section: '', teacher: '', day: '',
  });
  assert.equal(timetableListParams({ day: 'friday' }).day, 'friday');
  assert.equal(groupTimetable([{ day: 'monday', startTime: '09:00' }, { day: 'monday', startTime: '08:00' }])[0].records[0].startTime, '08:00');
});

test('timetable views escape content and show weekly schedule controls', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const entry = {
    _id: id, id, day: 'monday', startTime: '08:00', endTime: '08:45', room: '<script>Lab</script>', status: 'active',
    academicYear: { _id: id, name: '2026' },
    class: { _id: id, name: 'Grade 8' },
    section: { _id: id, name: 'A' },
    subject: { _id: id, name: '<script>Math</script>', code: 'MTH' },
    teacher: { _id: id, teacherId: 'T-1', name: '<script>Ada</script>' },
  };
  const locals = {
    title: 'Timetable', activePage: 'timetable', currentUser: { name: 'Admin' }, currentRoleName: 'Admin',
    navigation: [], csrfToken: 'test-csrf-token',
  };
  const formOptions = { academicYears: [entry.academicYear], classes: [entry.class], sections: [entry.section], subjects: [entry.subject], teachers: [entry.teacher], days: ['monday'] };
  const index = await render('timetable/index', {
    ...locals, records: [entry], grouped: groupTimetable([entry]),
    filters: { academicYear: '', class: '', section: '', teacher: '', day: '' },
    formOptions, canManage: true, message: null,
  });
  assert.ok(!index.includes('<script>Ada'));
  assert.match(index, /Weekly timetable/);
  const form = await render('timetable/form', {
    ...locals, title: 'Edit timetable entry', entry, values: timetableFormValues(entry), errors: {}, message: null, formOptions,
  });
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  assert.match(form, /does not overlap/);
  const show = await render('timetable/show', { ...locals, title: 'Timetable entry', entry, canManage: true, message: null });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Schedule details/);
});
