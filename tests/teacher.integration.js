import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import { seedAuthorization } from '../src/services/authorization.service.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import Teacher from '../src/models/Teacher.js';
import User from '../src/models/User.js';

test('teacher management supports scoped CRUD, search, filters and pagination', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_teacher_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), Teacher.init()]);
  await seedAuthorization();
  const password = 'Teacher-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-teacher@example.test', password, role: 'admin' });
  const teacherUser = await User.create({ name: 'Teacher', email: 'teacher-teacher@example.test', password, role: 'teacher' });
  const otherTeacherUser = await User.create({ name: 'Other Teacher', email: 'other-teacher@example.test', password, role: 'teacher' });
  const student = await User.create({ name: 'Student', email: 'student-teacher@example.test', password, role: 'student' });
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
  const teacherClient = await login(teacherUser);
  const studentClient = await login(student);

  assert.equal((await studentClient('/teachers')).status, 403);
  assert.equal((await teacherClient('/teachers/new')).status, 403);
  const form = await adminClient('/teachers/new');
  assert.match(form.text, /teacher-teacher@example.test/);
  assert.equal((await adminClient('/teachers', {
    _csrf: form.csrf,
    teacherId: 'T-001',
    user: teacherUser.id,
    name: 'Ada Lovelace',
    email: 'ada@example.test',
    phone: '555-1000',
    joiningDate: '2026-01-10',
    qualification: 'MSc',
    status: 'active',
  })).status, 303);
  const teacher = await Teacher.findOne({ teacherId: 'T-001' });
  assert.equal(String(teacher.user), teacherUser.id);

  const duplicate = await adminClient('/teachers', {
    _csrf: (await adminClient('/teachers/new')).csrf,
    teacherId: 'T-001',
    name: 'Grace Hopper',
    email: 'grace@example.test',
    joiningDate: '2026-01-10',
    status: 'active',
  });
  assert.equal(duplicate.status, 422);
  assert.match(duplicate.text, /already exists/);

  const invalidUser = await adminClient('/teachers', {
    _csrf: (await adminClient('/teachers/new')).csrf,
    teacherId: 'T-002',
    user: student.id,
    name: 'Alan Turing',
    email: 'alan@example.test',
    joiningDate: '2026-01-10',
    status: 'active',
  });
  assert.equal(invalidUser.status, 422);
  assert.match(invalidUser.text, /valid active teacher user/);

  for (let index = 2; index <= 12; index += 1) {
    await Teacher.create({
      teacherId: `T-${String(index).padStart(3, '0')}`,
      user: index === 2 ? otherTeacherUser.id : null,
      name: `Teacher ${index}`,
      email: `teacher${index}@example.test`,
      joiningDate: new Date('2026-01-10'),
      qualification: index % 2 ? 'Science' : 'Mathematics',
      status: index === 12 ? 'inactive' : 'active',
    });
  }

  const search = await adminClient('/teachers?q=Ada&status=active&sort=teacherId');
  assert.equal(search.status, 200);
  assert.match(search.text, /Ada/);
  assert.ok(!search.text.includes('teacher12@example.test'));
  const pageTwo = await adminClient('/teachers?page=2');
  assert.equal(pageTwo.status, 200);
  assert.match(pageTwo.text, /Page 2 of 2/);

  assert.equal((await teacherClient(`/teachers/${teacher.id}`)).status, 200);
  const edit = await adminClient(`/teachers/${teacher.id}/edit`);
  assert.equal((await adminClient(`/teachers/${teacher.id}`, {
    _csrf: edit.csrf,
    teacherId: 'T-001',
    user: teacherUser.id,
    name: 'Ada Byron',
    email: 'ada@example.test',
    phone: '555-2000',
    joiningDate: '2026-01-10',
    qualification: 'MSc',
    status: 'active',
  })).status, 303);
  assert.equal((await Teacher.findById(teacher.id)).name, 'Ada Byron');

  const show = await adminClient(`/teachers/${teacher.id}`);
  assert.equal((await adminClient(`/teachers/${teacher.id}/status`, { _csrf: show.csrf, status: 'inactive' })).status, 303);
  assert.equal((await Teacher.findById(teacher.id)).status, 'inactive');
  assert.equal((await teacherClient(`/teachers/${teacher.id}`)).status, 200);
  assert.equal((await teacherClient(`/teachers/${(await Teacher.findOne({ teacherId: 'T-002' })).id}`)).status, 200);
});
