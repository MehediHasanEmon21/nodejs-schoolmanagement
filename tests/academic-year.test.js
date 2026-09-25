import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import AcademicYear from '../src/models/AcademicYear.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { academicYearFormValues } from '../src/services/academic-year.service.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { validateAcademicYear } from '../src/validators/academic-year.validator.js';

function render(view, data) {
  return ejs.renderFile(fileURLToPath(new URL(`../src/views/${view}.ejs`, import.meta.url)), data);
}

function authorization(roleName = 'admin', permissions) {
  const role = defaultRoles.find((item) => item._id === roleName);
  return {
    user: { id: '000000000000000000000123', role: roleName, name: 'Ada', status: 'active' },
    role: { id: roleName, name: role.name, status: 'active' },
    permissions: new Set(permissions ?? role.permissions),
  };
}

test('academic year permissions are configured for administrators', () => {
  for (const permission of ['academic_year.view', 'academic_year.create', 'academic_year.edit']) {
    assert.ok(defaultPermissions.some(([name]) => name === permission));
    assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes(permission));
  }
  assert.ok(getNavigation(authorization()).some((item) => item.href === '/academic-years'));
  assert.ok(!getNavigation(authorization('student')).some((item) => item.id === 'academic-years'));
});

test('academic year validator normalizes input and rejects invalid date ranges', () => {
  const valid = validateAcademicYear({ name: '  2026   2027 ', startDate: '2026-01-01', endDate: '2026-12-31', isCurrent: 'on' });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.values.name, '2026 2027');
  assert.equal(valid.data.startDate.toISOString().slice(0, 10), '2026-01-01');
  const invalid = validateAcademicYear({ name: '', startDate: '2026-12-31', endDate: '2026-01-01', status: 'inactive', isCurrent: 'on' });
  assert.equal(invalid.errors.name, 'Enter a name up to 80 characters.');
  assert.equal(invalid.errors.endDate, 'End date must be after the start date.');
  assert.equal(invalid.errors.isCurrent, 'Only an active academic year can be current.');
});

test('academic year model enforces required fields and current-year invariants', async () => {
  await assert.rejects(new AcademicYear({ name: 'Broken', startDate: new Date('2026-12-31'), endDate: new Date('2026-01-01') }).validate(),
    /End date must be after the start date/);
  await assert.rejects(new AcademicYear({ name: 'Inactive', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'inactive', isCurrent: true }).validate(),
    /Only an active academic year can be current/);
  await new AcademicYear({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true }).validate();
});

test('academic year views escape content and include protected form actions', async () => {
  const academicYear = {
    id: '507f1f77bcf86cd799439011',
    _id: '507f1f77bcf86cd799439011',
    name: '<script>2026</script>',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'active',
    isCurrent: false,
  };
  const locals = {
    title: 'Academic years',
    activePage: 'academic-years',
    currentUser: { name: 'Ada' },
    currentRoleName: 'Admin',
    navigation: getNavigation(authorization()),
    csrfToken: 'test-csrf-token',
  };
  const index = await render('academic-years/index', { ...locals, academicYears: [academicYear], message: '<script>' });
  assert.ok(!index.includes('<script>'));
  assert.match(index, /href="\/academic-years\/507f1f77bcf86cd799439011"/);
  assert.match(index, /name="_csrf" value="test-csrf-token"/);
  const form = await render('academic-years/form', {
    ...locals,
    title: 'Edit academic year',
    academicYear,
    values: academicYearFormValues(academicYear),
    errors: {},
    message: null,
  });
  assert.ok(!form.includes('<script>'));
  assert.match(form, /method="post" action="\/academic-years\/507f1f77bcf86cd799439011"/);
  const show = await render('academic-years/show', { ...locals, title: academicYear.name, academicYear });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Make current/);
});
