import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { canViewReports } from '../src/services/report.service.js';
import { dateRange, reportFilters } from '../src/validators/report.validator.js';

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

test('report permission and navigation are admin-only', () => {
  assert.ok(defaultPermissions.some(([name]) => name === 'report.view'));
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('report.view'));
  assert.ok(!defaultRoles.find((role) => role._id === 'teacher').permissions.includes('report.view'));
  assert.equal(canViewReports(authorization('admin')), true);
  assert.equal(canViewReports(authorization('teacher')), false);
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/reports'));
  assert.ok(!getNavigation(authorization('student')).some((item) => item.href === '/reports'));
});

test('report filters normalize ids and dates safely', () => {
  const oid = new mongoose.Types.ObjectId().toString();
  const filters = reportFilters({ q: '  Ada  ', class: oid, section: 'bad', dateFrom: '2026-01-01', dateTo: 'bad' });
  assert.equal(filters.q, 'Ada');
  assert.equal(filters.class, oid);
  assert.equal(filters.section, '');
  assert.equal(filters.dateFrom, '2026-01-01');
  assert.equal(filters.dateTo, '');
  assert.equal(dateRange(filters).$gte.toISOString().slice(0, 10), '2026-01-01');
});

test('report views escape content and expose printable tables', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const locals = { title: 'Reports', activePage: 'reports', currentUser: { name: 'Admin' }, currentRoleName: 'Admin', navigation: [], csrfToken: 'test-csrf-token' };
  const reportOptions = { academicYears: [], classes: [{ _id: id, name: '<script>Grade</script>' }], sections: [], exams: [], feeTypes: [] };
  const index = await render('reports/index', locals);
  assert.match(index, /Student report/);
  const students = await render('reports/students', {
    ...locals,
    filters: { q: '', status: '', class: '', section: '' },
    reportOptions,
    totals: { total: 1, active: 1, inactive: 0 },
    records: [{ firstName: '<script>Ada</script>', lastName: 'Lovelace', studentId: 'S-1', class: reportOptions.classes[0], section: null, status: 'active' }],
  });
  assert.ok(!students.includes('<script>Ada'));
  assert.match(students, /data-print-button/);
  assert.ok(!students.includes('onclick='));
  const fees = await render('reports/fees', {
    ...locals,
    filters: { academicYear: '', feeType: '', status: '' },
    reportOptions,
    totals: { records: 0, amount: 1000, paid: 400, outstanding: 600 },
    records: [],
  });
  assert.match(fees, /outstanding 600.00/);
});
