import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import { seedAuthorization } from '../src/services/authorization.service.js';
import AcademicYear from '../src/models/AcademicYear.js';
import FeeType from '../src/models/FeeType.js';
import Guardian from '../src/models/Guardian.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import Payment from '../src/models/Payment.js';
import Student from '../src/models/Student.js';
import StudentFee from '../src/models/StudentFee.js';
import User from '../src/models/User.js';

test('payments support partial payments, history and overpayment prevention', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_payment_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), AcademicYear.init(), Student.init(), Guardian.init(), FeeType.init(), StudentFee.init(), Payment.init()]);
  await seedAuthorization();
  const password = 'Payment-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-payment@example.test', password, role: 'admin' });
  const studentUser = await User.create({ name: 'Student', email: 'student-payment@example.test', password, role: 'student' });
  const otherStudentUser = await User.create({ name: 'Other Student', email: 'other-payment@example.test', password, role: 'student' });
  const guardianUser = await User.create({ name: 'Guardian', email: 'guardian-payment@example.test', password, role: 'guardian' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const student = await Student.create({ studentId: 'S-P01', user: studentUser.id, firstName: 'Grace', lastName: 'Hopper', dateOfBirth: new Date('2014-01-01'), gender: 'female', admissionDate: new Date('2026-01-05') });
  await Student.create({ studentId: 'S-P02', user: otherStudentUser.id, firstName: 'Other', lastName: 'Student', dateOfBirth: new Date('2014-01-01'), gender: 'male', admissionDate: new Date('2026-01-05') });
  await Guardian.create({ guardianId: 'G-P01', user: guardianUser.id, name: 'Guardian', relationship: 'Parent', phone: '123', students: [student.id] });
  const feeType = await FeeType.create({ name: 'Tuition Fee', defaultAmount: 1000 });
  const fee = await StudentFee.create({ student: student.id, academicYear: academicYear.id, feeType: feeType.id, amount: 1000, paidAmount: 0, dueDate: new Date('2026-09-25'), assignedBy: admin.id });
  const config = sessionConfig({ SESSION_SECRET: randomBytes(32).toString('hex') });
  server = createApp({ auth: { config, store: createSessionStore(() => {}) }, log: () => {} }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  function client() {
    let cookie = '';
    return async (path, fields) => {
      const response = await fetch(base + path, {
        redirect: 'manual',
        method: fields ? 'POST' : 'GET',
        headers: { Cookie: cookie, ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: fields ? new URLSearchParams(fields) : undefined,
      });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      const text = await response.text();
      return { status: response.status, location: response.headers.get('location'), text,
        csrf: text.match(/name="_csrf" value="([a-f0-9]{64})"/)?.[1] };
    };
  }

  async function login(user) {
    const request = client();
    const page = await request('/login');
    assert.equal((await request('/login', { _csrf: page.csrf, email: user.email, password })).status, 303);
    return request;
  }

  const adminClient = await login(admin);
  const studentClient = await login(studentUser);
  const otherStudentClient = await login(otherStudentUser);
  const guardianClient = await login(guardianUser);
  assert.equal((await studentClient(`/fees/${fee.id}/payments/new`)).status, 403);
  const form = await adminClient(`/fees/${fee.id}/payments/new`);
  assert.equal((await adminClient(`/fees/${fee.id}/payments`, { _csrf: form.csrf, amount: '400', paidAt: '2026-09-25', method: 'cash', referenceNumber: 'PAY-1' })).status, 303);
  let updated = await StudentFee.findById(fee.id);
  assert.equal(updated.paidAmount, 400);
  assert.equal(updated.status, 'partial');
  const overpay = await adminClient(`/fees/${fee.id}/payments`, { _csrf: (await adminClient(`/fees/${fee.id}/payments/new`)).csrf, amount: '700', paidAt: '2026-09-26', method: 'cash', referenceNumber: 'PAY-2' });
  assert.equal(overpay.status, 422);
  assert.match(overpay.text, /cannot exceed/);
  assert.equal((await adminClient(`/fees/${fee.id}/payments`, { _csrf: (await adminClient(`/fees/${fee.id}/payments/new`)).csrf, amount: '600', paidAt: '2026-09-26', method: 'bank_transfer', referenceNumber: 'PAY-2' })).status, 303);
  updated = await StudentFee.findById(fee.id);
  assert.equal(updated.paidAmount, 1000);
  assert.equal(updated.status, 'paid');
  assert.equal((await studentClient(`/fees/${fee.id}/payments`)).status, 200);
  assert.equal((await guardianClient(`/fees/${fee.id}/payments`)).status, 200);
  assert.equal((await otherStudentClient(`/fees/${fee.id}/payments`)).status, 404);
});
