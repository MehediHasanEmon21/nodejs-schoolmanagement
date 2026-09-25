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
import Student from '../src/models/Student.js';
import StudentFee from '../src/models/StudentFee.js';
import User from '../src/models/User.js';

test('fee management supports types, assignment, outstanding balances and scoped access', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_fee_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), AcademicYear.init(), Student.init(), Guardian.init(), FeeType.init(), StudentFee.init()]);
  await seedAuthorization();
  const password = 'Fee-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-fee@example.test', password, role: 'admin' });
  const studentUser = await User.create({ name: 'Student', email: 'student-fee@example.test', password, role: 'student' });
  const otherStudentUser = await User.create({ name: 'Other Student', email: 'other-student-fee@example.test', password, role: 'student' });
  const guardianUser = await User.create({ name: 'Guardian', email: 'guardian-fee@example.test', password, role: 'guardian' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const student = await Student.create({ studentId: 'S-F01', user: studentUser.id, firstName: 'Grace', lastName: 'Hopper', dateOfBirth: new Date('2014-01-01'), gender: 'female', admissionDate: new Date('2026-01-05') });
  const otherStudent = await Student.create({ studentId: 'S-F02', user: otherStudentUser.id, firstName: 'Other', lastName: 'Student', dateOfBirth: new Date('2014-01-01'), gender: 'male', admissionDate: new Date('2026-01-05') });
  await Guardian.create({ guardianId: 'G-F01', user: guardianUser.id, name: 'Guardian', relationship: 'Parent', phone: '123', students: [student.id] });
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
  assert.equal((await studentClient('/fees/new')).status, 403);
  const typeForm = await adminClient('/fees/types/new');
  assert.equal((await adminClient('/fees/types', { _csrf: typeForm.csrf, name: 'Tuition Fee', defaultAmount: '1200', description: 'Monthly', status: 'active' })).status, 303);
  const feeType = await FeeType.findOne({ name: 'Tuition Fee' });
  const form = await adminClient('/fees/new');
  assert.match(form.text, /Tuition Fee/);
  assert.equal((await adminClient('/fees', { _csrf: form.csrf, student: student.id, academicYear: academicYear.id, feeType: feeType.id, amount: '1200', paidAmount: '200', dueDate: '2026-09-25', status: 'partial', note: 'September' })).status, 303);
  const fee = await StudentFee.findOne({ student: student.id, feeType: feeType.id });
  const duplicate = await adminClient('/fees', { _csrf: (await adminClient('/fees/new')).csrf, student: student.id, academicYear: academicYear.id, feeType: feeType.id, amount: '1200', paidAmount: '0', dueDate: '2026-09-25', status: 'pending' });
  assert.equal(duplicate.status, 422);
  assert.match(duplicate.text, /already been assigned/);
  const own = await studentClient(`/fees/${fee.id}`);
  assert.equal(own.status, 200);
  assert.match(own.text, /1000.00/);
  assert.equal((await otherStudentClient(`/fees/${fee.id}`)).status, 404);
  const guardian = await guardianClient(`/fees/${fee.id}`);
  assert.equal(guardian.status, 200);
  const edit = await adminClient(`/fees/${fee.id}/edit`);
  assert.equal((await adminClient(`/fees/${fee.id}`, { _csrf: edit.csrf, student: student.id, academicYear: academicYear.id, feeType: feeType.id, amount: '1200', paidAmount: '1200', dueDate: '2026-09-25', status: 'paid' })).status, 303);
  assert.equal((await StudentFee.findById(fee.id)).status, 'paid');
  assert.equal((await adminClient(`/fees?student=${otherStudent.id}`)).status, 200);
});
