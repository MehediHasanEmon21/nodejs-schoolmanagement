import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import { seedAuthorization } from '../src/services/authorization.service.js';
import AcademicYear from '../src/models/AcademicYear.js';
import Exam from '../src/models/Exam.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Subject from '../src/models/Subject.js';
import User from '../src/models/User.js';

test('exam management supports CRUD, subject setup, validation and authorization', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_exam_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Subject.init(), Exam.init()]);
  await seedAuthorization();
  const password = 'Exam-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-exam@example.test', password, role: 'admin' });
  const teacher = await User.create({ name: 'Teacher', email: 'teacher-exam@example.test', password, role: 'teacher' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  const otherClass = await SchoolClass.create({ name: 'Grade 9' });
  const subject = await Subject.create({ name: 'Mathematics', code: 'MATH', classes: [schoolClass.id] });
  const otherSubject = await Subject.create({ name: 'Physics', code: 'PHY', classes: [otherClass.id] });
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
  assert.equal((await teacherClient('/exams/new')).status, 403);
  assert.equal((await teacherClient('/exams')).status, 200);
  const form = await adminClient('/exams/new');
  assert.match(form.text, /Mathematics/);
  assert.equal((await adminClient('/exams', {
    _csrf: form.csrf,
    academicYear: academicYear.id,
    class: schoolClass.id,
    name: 'Midterm Exam',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
    status: 'scheduled',
    subjects: subject.id,
    totalMarks: '100',
    passMarks: '33',
    examDate: '2026-06-05',
  })).status, 303);
  const exam = await Exam.findOne({ name: 'Midterm Exam' });
  assert.equal(exam.subjects[0].totalMarks, 100);

  const duplicate = await adminClient('/exams', {
    _csrf: (await adminClient('/exams/new')).csrf,
    academicYear: academicYear.id,
    class: schoolClass.id,
    name: 'Midterm Exam',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
    status: 'scheduled',
    subjects: subject.id,
    totalMarks: '100',
    passMarks: '33',
  });
  assert.equal(duplicate.status, 422);
  assert.match(duplicate.text, /already exists/);

  const wrongSubject = await adminClient('/exams', {
    _csrf: (await adminClient('/exams/new')).csrf,
    academicYear: academicYear.id,
    class: schoolClass.id,
    name: 'Wrong Subject',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
    status: 'scheduled',
    subjects: otherSubject.id,
    totalMarks: '100',
    passMarks: '33',
  });
  assert.equal(wrongSubject.status, 422);
  assert.match(wrongSubject.text, /assigned to the selected class/);

  const show = await teacherClient(`/exams/${exam.id}`);
  assert.equal(show.status, 200);
  assert.match(show.text, /Midterm Exam/);
  const edit = await adminClient(`/exams/${exam.id}/edit`);
  assert.equal((await adminClient(`/exams/${exam.id}`, {
    _csrf: edit.csrf,
    academicYear: academicYear.id,
    class: schoolClass.id,
    name: 'Final Exam',
    startDate: '2026-10-01',
    endDate: '2026-10-10',
    status: 'draft',
    subjects: subject.id,
    totalMarks: '80',
    passMarks: '32',
    examDate: '2026-10-02',
  })).status, 303);
  const updated = await Exam.findById(exam.id);
  assert.equal(updated.name, 'Final Exam');
  assert.equal(updated.subjects[0].passMarks, 32);
});
