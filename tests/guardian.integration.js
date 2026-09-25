import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import { seedAuthorization } from '../src/services/authorization.service.js';
import Guardian from '../src/models/Guardian.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import Student from '../src/models/Student.js';
import User from '../src/models/User.js';

test('guardian management supports linked students and scoped guardian access', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_guardian_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), Student.init(), Guardian.init()]);
  await seedAuthorization();
  const password = 'Guardian-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-guardian@example.test', password, role: 'admin' });
  const guardianUser = await User.create({ name: 'Guardian', email: 'guardian-guardian@example.test', password, role: 'guardian' });
  const otherGuardianUser = await User.create({ name: 'Other Guardian', email: 'other-guardian@example.test', password, role: 'guardian' });
  const studentUser = await User.create({ name: 'Student', email: 'student-guardian@example.test', password, role: 'student' });
  const linkedStudent = await Student.create({
    studentId: 'ST-001', firstName: 'Ada', lastName: 'Student', dateOfBirth: new Date('2015-01-02'),
    admissionDate: new Date('2026-01-10'), gender: 'female', status: 'active',
  });
  const secondStudent = await Student.create({
    studentId: 'ST-002', firstName: 'Grace', lastName: 'Student', dateOfBirth: new Date('2015-01-02'),
    admissionDate: new Date('2026-01-10'), gender: 'female', status: 'active',
  });
  const inactiveStudent = await Student.create({
    studentId: 'ST-003', firstName: 'Inactive', lastName: 'Student', dateOfBirth: new Date('2015-01-02'),
    admissionDate: new Date('2026-01-10'), gender: 'other', status: 'inactive',
  });
  const config = sessionConfig({ SESSION_SECRET: randomBytes(32).toString('hex') });
  server = createApp({ auth: { config, store: createSessionStore(() => {}) }, log: () => {} }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  function client() {
    let cookie = '';
    return async (path, fields) => {
      const body = fields ? new URLSearchParams() : undefined;
      if (fields) {
        for (const [key, value] of Object.entries(fields)) {
          if (Array.isArray(value)) {
            for (const item of value) body.append(key, item);
          } else {
            body.append(key, value);
          }
        }
      }
      const response = await fetch(base + path, {
        redirect: 'manual',
        method: fields ? 'POST' : 'GET',
        headers: { Cookie: cookie, ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body,
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
  const guardianClient = await login(guardianUser);
  const studentClient = await login(studentUser);

  assert.equal((await studentClient('/guardians')).status, 403);
  assert.equal((await guardianClient('/guardians/new')).status, 403);
  const form = await adminClient('/guardians/new');
  assert.match(form.text, /Ada Student/);
  assert.equal((await adminClient('/guardians', {
    _csrf: form.csrf,
    guardianId: 'G-001',
    user: guardianUser.id,
    name: 'Ada Guardian',
    email: 'guardian@example.test',
    phone: '555-1000',
    relationship: 'Mother',
    address: 'Dhaka',
    students: [linkedStudent.id, secondStudent.id],
    status: 'active',
  })).status, 303);
  const guardian = await Guardian.findOne({ guardianId: 'G-001' });
  assert.deepEqual(guardian.students.map(String), [linkedStudent.id, secondStudent.id]);

  const duplicate = await adminClient('/guardians', {
    _csrf: (await adminClient('/guardians/new')).csrf,
    guardianId: 'G-001',
    name: 'Duplicate Guardian',
    phone: '555-2000',
    relationship: 'Father',
    students: linkedStudent.id,
    status: 'active',
  });
  assert.equal(duplicate.status, 422);
  assert.match(duplicate.text, /already exists/);

  const invalidStudent = await adminClient('/guardians', {
    _csrf: (await adminClient('/guardians/new')).csrf,
    guardianId: 'G-002',
    name: 'Invalid Guardian',
    phone: '555-3000',
    relationship: 'Father',
    students: inactiveStudent.id,
    status: 'active',
  });
  assert.equal(invalidStudent.status, 422);
  assert.match(invalidStudent.text, /valid active linked students/);

  for (let index = 2; index <= 12; index += 1) {
    await Guardian.create({
      guardianId: `G-${String(index).padStart(3, '0')}`,
      user: index === 2 ? otherGuardianUser.id : null,
      name: `Guardian ${index}`,
      phone: `555-${index}`,
      relationship: index % 2 ? 'Father' : 'Mother',
      students: [linkedStudent.id],
      status: index === 12 ? 'inactive' : 'active',
    });
  }

  const search = await adminClient('/guardians?q=Ada&status=active&sort=guardianId');
  assert.equal(search.status, 200);
  assert.match(search.text, /Ada Guardian/);
  assert.ok(!search.text.includes('Guardian 12'));
  const pageTwo = await adminClient('/guardians?page=2');
  assert.equal(pageTwo.status, 200);
  assert.match(pageTwo.text, /Page 2 of 2/);

  assert.equal((await guardianClient('/guardians')).status, 200);
  assert.match((await guardianClient('/guardians')).text, /Ada Guardian/);
  assert.equal((await guardianClient(`/guardians/${guardian.id}`)).status, 200);
  assert.equal((await guardianClient(`/guardians/${(await Guardian.findOne({ guardianId: 'G-002' })).id}`)).status, 404);
  const edit = await adminClient(`/guardians/${guardian.id}/edit`);
  assert.equal((await adminClient(`/guardians/${guardian.id}`, {
    _csrf: edit.csrf,
    guardianId: 'G-001',
    user: guardianUser.id,
    name: 'Ada Guardian Updated',
    email: 'guardian@example.test',
    phone: '555-4000',
    relationship: 'Mother',
    students: linkedStudent.id,
    status: 'active',
  })).status, 303);
  assert.equal((await Guardian.findById(guardian.id)).name, 'Ada Guardian Updated');
  const show = await adminClient(`/guardians/${guardian.id}`);
  assert.equal((await adminClient(`/guardians/${guardian.id}/status`, { _csrf: show.csrf, status: 'inactive' })).status, 303);
  assert.equal((await Guardian.findById(guardian.id)).status, 'inactive');
});
