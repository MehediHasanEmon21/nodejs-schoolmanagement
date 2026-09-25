import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import { seedAuthorization } from '../src/services/authorization.service.js';
import AcademicYear from '../src/models/AcademicYear.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import User from '../src/models/User.js';

test('academic year management routes enforce authorization and current-year rules', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_academic_year_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), AcademicYear.init()]);
  await seedAuthorization();
  const password = 'Academic-year-test-only-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-academic@example.test', password, role: 'admin' });
  const student = await User.create({ name: 'Student', email: 'student-academic@example.test', password, role: 'student' });

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

  const adminClient = client();
  const adminLogin = await adminClient('/login');
  assert.equal((await adminClient('/login', { _csrf: adminLogin.csrf, email: admin.email, password })).status, 303);
  const studentClient = client();
  const studentLogin = await studentClient('/login');
  assert.equal((await studentClient('/login', { _csrf: studentLogin.csrf, email: student.email, password })).status, 303);

  assert.equal((await studentClient('/academic-years')).status, 403);
  assert.equal((await adminClient('/academic-years')).status, 200);
  const form = await adminClient('/academic-years/new');
  assert.equal(form.status, 200);
  assert.equal((await adminClient('/academic-years', {
    _csrf: form.csrf,
    name: '2026-2027',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active',
    isCurrent: 'on',
  })).status, 303);
  const first = await AcademicYear.findOne({ name: '2026-2027' });
  assert.equal(first.isCurrent, true);

  const secondForm = await adminClient('/academic-years/new');
  assert.equal((await adminClient('/academic-years', {
    _csrf: secondForm.csrf,
    name: '2027-2028',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    status: 'active',
    isCurrent: 'on',
  })).status, 303);
  assert.equal(await AcademicYear.countDocuments({ isCurrent: true }), 1);
  assert.equal((await AcademicYear.findById(first.id)).isCurrent, false);

  const duplicateForm = await adminClient('/academic-years/new');
  const duplicate = await adminClient('/academic-years', {
    _csrf: duplicateForm.csrf,
    name: '2027-2028',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    status: 'active',
    isCurrent: 'on',
  });
  assert.equal(duplicate.status, 422);
  assert.match(duplicate.text, /already exists/);
  assert.equal(await AcademicYear.countDocuments({ isCurrent: true }), 1);
  assert.equal((await AcademicYear.findOne({ isCurrent: true })).name, '2027-2028');

  const invalidEdit = await adminClient(`/academic-years/${first.id}/edit`);
  assert.equal((await adminClient(`/academic-years/${first.id}`, {
    _csrf: invalidEdit.csrf,
    name: 'Closed year',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'inactive',
    isCurrent: 'on',
  })).status, 422);
});
