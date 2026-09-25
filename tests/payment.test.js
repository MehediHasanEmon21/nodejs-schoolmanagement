import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import mongoose from 'mongoose';
import Payment from '../src/models/Payment.js';
import { defaultPermissions, defaultRoles } from '../src/config/authorization.js';
import { validatePayment } from '../src/validators/payment.validator.js';

function render(view, data) {
  return ejs.renderFile(fileURLToPath(new URL(`../src/views/${view}.ejs`, import.meta.url)), data);
}

test('payment permissions are configured', () => {
  for (const permission of ['payment.view', 'payment.create']) assert.ok(defaultPermissions.some(([name]) => name === permission));
  assert.ok(defaultRoles.find((role) => role._id === 'admin').permissions.includes('payment.create'));
  assert.ok(defaultRoles.find((role) => role._id === 'student').permissions.includes('payment.view'));
});

test('payment validator normalizes values and rejects invalid input', () => {
  const valid = validatePayment({ amount: '500.25', paidAt: '2026-09-25', method: 'mobile_banking', referenceNumber: ' abc-1 ', note: ' Paid ' });
  assert.equal(valid.data.amount, 500.25);
  assert.equal(valid.data.referenceNumber, 'ABC-1');
  assert.deepEqual(valid.errors, {});
  const invalid = validatePayment({ amount: '0', paidAt: 'bad', method: 'missing' });
  assert.ok(invalid.errors.amount);
  assert.ok(invalid.errors.paidAt);
  assert.equal(invalid.data.method, 'cash');
});

test('payment model accepts valid payment records', async () => {
  const oid = () => new mongoose.Types.ObjectId();
  const payment = new Payment({ studentFee: oid(), amount: 250, paidAt: new Date('2026-09-25'), method: 'cash', referenceNumber: 'R-1', recordedBy: oid() });
  await payment.validate();
});

test('payment views escape content and show payment history', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const fee = { _id: id, id, feeType: { name: '<script>Tuition</script>' }, student: { firstName: '<script>Ada</script>', lastName: 'Lovelace' } };
  const summary = { outstanding: 750 };
  const locals = { title: 'Payments', activePage: 'fees', currentUser: { name: 'Admin' }, currentRoleName: 'Admin', navigation: [], csrfToken: 'test-csrf-token' };
  const form = await render('fees/payment-form', { ...locals, fee, summary, values: { amount: '750', paidAt: '2026-09-25', method: 'cash', referenceNumber: '<script>', note: '<script>' }, errors: {}, message: null });
  assert.match(form, /name="_csrf" value="test-csrf-token"/);
  assert.ok(!form.includes('<script>'));
  const history = await render('fees/payments', { ...locals, fee, summary, payments: [{ paidAt: new Date('2026-09-25'), amount: 250, method: 'cash', referenceNumber: '<script>R</script>', recordedBy: { name: '<script>Admin</script>' } }] });
  assert.ok(!history.includes('<script>'));
  assert.match(history, /250.00/);
});
