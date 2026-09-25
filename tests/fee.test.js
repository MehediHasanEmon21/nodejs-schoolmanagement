import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import FeeType from '../src/models/FeeType.js';
import StudentFee from '../src/models/StudentFee.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { getNavigation } from '../src/services/dashboard.service.js';
import { feeListParams, feeSummary } from '../src/services/fee.service.js';
import { studentFeeFormValues, validateFeeType, validateStudentFee } from '../src/validators/fee.validator.js';

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

test('fee permissions and navigation are configured for scoped roles', () => {
  for (const permission of ['fee.view', 'fee.create', 'fee.edit']) assert.ok(defaultPermissions.some(([name]) => name === permission));
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('fee.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'student').permissions.includes('fee.view'));
  assert.ok(getNavigation(authorization('admin')).some((item) => item.href === '/fees'));
});

test('fee validators normalize fee types and student assignments', () => {
  const oid = new mongoose.Types.ObjectId().toString();
  const type = validateFeeType({ name: ' Tuition  Fee ', defaultAmount: '1200.50', description: ' Monthly ', status: 'active' });
  assert.equal(type.data.name, 'Tuition Fee');
  assert.equal(type.data.defaultAmount, 1200.50);
  const fee = validateStudentFee({
    student: oid, academicYear: oid, feeType: oid, amount: '1000', paidAmount: '250', dueDate: '2026-09-25', status: 'partial',
  });
  assert.equal(fee.data.amount, 1000);
  assert.equal(fee.data.paidAmount, 250);
  assert.deepEqual(fee.errors, {});
  const invalid = validateStudentFee({ student: 'bad', amount: '10', paidAmount: '20', dueDate: 'bad' });
  assert.ok(invalid.errors.student);
  assert.ok(invalid.errors.academicYear);
  assert.ok(invalid.errors.feeType);
  assert.ok(invalid.errors.paidAmount);
  assert.ok(invalid.errors.dueDate);
});

test('fee models and outstanding calculation work', async () => {
  const oid = () => new mongoose.Types.ObjectId();
  await new FeeType({ name: 'Exam Fee', defaultAmount: 500 }).validate();
  const fee = new StudentFee({ student: oid(), academicYear: oid(), feeType: oid(), amount: 1000, paidAmount: 400, dueDate: new Date('2026-09-25'), assignedBy: oid() });
  await fee.validate();
  assert.equal(feeSummary(fee).outstanding, 600);
  assert.deepEqual(feeListParams({ page: '-1', status: 'bad', sort: 'bad' }), {
    page: 1, limit: 10, status: '', academicYear: '', feeType: '', student: '', sort: 'dueDate',
  });
});

test('fee views escape content and show outstanding amounts', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const fee = {
    _id: id, id, amount: 1000, paidAmount: 250, dueDate: new Date('2026-09-25'), status: 'partial', note: '<script>note</script>',
    student: { _id: id, studentId: 'S-1', firstName: '<script>Ada</script>', lastName: 'Lovelace' },
    academicYear: { _id: id, name: '2026' },
    feeType: { _id: id, name: '<script>Tuition</script>' },
    summary: { outstanding: 750, overdue: false },
  };
  const locals = { title: 'Fees', activePage: 'fees', currentUser: { name: 'Admin' }, currentRoleName: 'Admin', navigation: [], csrfToken: 'test-csrf-token' };
  const formOptions = { students: [fee.student], academicYears: [fee.academicYear], feeTypes: [fee.feeType] };
  const index = await render('fees/index', { ...locals, records: [fee], filters: { page: 1, status: '', academicYear: '', feeType: '', student: '', sort: 'dueDate' }, totalPages: 1, previousUrl: null, nextUrl: null, formOptions, canManage: true, message: null });
  assert.ok(!index.includes('<script>'));
  assert.match(index, /750.00/);
  const form = await render('fees/form', { ...locals, fee: null, values: studentFeeFormValues(fee), errors: {}, message: null, formOptions });
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  assert.ok(!form.includes('<script>'));
  const show = await render('fees/show', { ...locals, fee, summary: feeSummary(fee), canManage: true });
  assert.ok(!show.includes('<script>'));
  assert.match(show, /Outstanding/);
});
