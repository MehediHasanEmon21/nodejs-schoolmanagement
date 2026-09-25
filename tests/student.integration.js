import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import { seedAuthorization } from '../src/services/authorization.service.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Student from '../src/models/Student.js';
import User from '../src/models/User.js';

test('student management supports scoped CRUD, search, filters and pagination', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_student_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), SchoolClass.init(), Section.init(), Student.init()]);
  await seedAuthorization();
  const password = 'Student-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-student@example.test', password, role: 'admin' });
  const teacher = await User.create({ name: 'Teacher', email: 'teacher-student@example.test', password, role: 'teacher' });
  const studentUser = await User.create({ name: 'Student', email: 'student-student@example.test', password, role: 'student' });
  const otherUser = await User.create({ name: 'Other', email: 'other-student@example.test', password, role: 'student' });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  const otherClass = await SchoolClass.create({ name: 'Grade 9' });
  const section = await Section.create({ name: 'Section A', class: schoolClass.id });
  const otherSection = await Section.create({ name: 'Section A', class: otherClass.id });
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
  const teacherClient = await login(teacher);
  const studentClient = await login(studentUser);

  assert.equal((await teacherClient('/students/new')).status, 403);
  const form = await adminClient('/students/new');
  assert.match(form.text, /Grade 8/);
  assert.equal((await adminClient('/students', {
    _csrf: form.csrf,
    studentId: 'ST-001',
    user: studentUser.id,
    firstName: 'Ada',
    lastName: 'Lovelace',
    dateOfBirth: '2015-01-02',
    admissionDate: '2026-01-10',
    gender: 'female',
    phone: '555-1000',
    address: 'Dhaka',
    class: schoolClass.id,
    section: section.id,
    status: 'active',
  })).status, 303);
  const student = await Student.findOne({ studentId: 'ST-001' });
  assert.equal(String(student.user), studentUser.id);

  const duplicate = await adminClient('/students', {
    _csrf: (await adminClient('/students/new')).csrf,
    studentId: 'ST-001',
    firstName: 'Grace',
    lastName: 'Hopper',
    dateOfBirth: '2014-01-02',
    admissionDate: '2026-01-10',
    gender: 'female',
    status: 'active',
  });
  assert.equal(duplicate.status, 422);
  assert.match(duplicate.text, /already exists/);

  const mismatch = await adminClient('/students', {
    _csrf: (await adminClient('/students/new')).csrf,
    studentId: 'ST-002',
    firstName: 'Alan',
    lastName: 'Turing',
    dateOfBirth: '2014-01-02',
    admissionDate: '2026-01-10',
    gender: 'male',
    class: schoolClass.id,
    section: otherSection.id,
    status: 'active',
  });
  assert.equal(mismatch.status, 422);
  assert.match(mismatch.text, /belongs to the selected class/);

  for (let index = 2; index <= 12; index += 1) {
    await Student.create({
      studentId: `ST-${String(index).padStart(3, '0')}`,
      firstName: `Student${index}`,
      lastName: 'Example',
      dateOfBirth: new Date('2015-01-02'),
      admissionDate: new Date('2026-01-10'),
      gender: 'other',
      class: index % 2 ? otherClass.id : schoolClass.id,
      status: index === 12 ? 'inactive' : 'active',
      user: index === 2 ? otherUser.id : null,
    });
  }

  const search = await adminClient('/students?q=Ada&status=active&sort=studentId');
  assert.equal(search.status, 200);
  assert.match(search.text, /Ada/);
  assert.ok(!search.text.includes('Student12'));
  const pageTwo = await adminClient('/students?page=2');
  assert.equal(pageTwo.status, 200);
  assert.match(pageTwo.text, /Page 2 of 2/);
  const classFilter = await adminClient(`/students?class=${schoolClass.id}`);
  assert.equal(classFilter.status, 200);
  assert.match(classFilter.text, /ST-001/);

  assert.equal((await teacherClient(`/students/${student.id}`)).status, 200);
  const edit = await adminClient(`/students/${student.id}/edit`);
  assert.equal((await adminClient(`/students/${student.id}`, {
    _csrf: edit.csrf,
    studentId: 'ST-001',
    user: studentUser.id,
    firstName: 'Ada',
    lastName: 'Byron',
    dateOfBirth: '2015-01-02',
    admissionDate: '2026-01-10',
    gender: 'female',
    class: schoolClass.id,
    section: section.id,
    status: 'active',
  })).status, 303);
  assert.equal((await Student.findById(student.id)).lastName, 'Byron');

  const show = await adminClient(`/students/${student.id}`);
  assert.equal((await adminClient(`/students/${student.id}/status`, { _csrf: show.csrf, status: 'inactive' })).status, 303);
  assert.equal((await Student.findById(student.id)).status, 'inactive');
  assert.equal((await teacherClient(`/students/${student.id}`)).status, 404);
  assert.equal((await studentClient(`/students/${student.id}`)).status, 200);
  assert.equal((await studentClient(`/students/${(await Student.findOne({ studentId: 'ST-002' })).id}`)).status, 404);
});
