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
import Subject from '../src/models/Subject.js';
import User from '../src/models/User.js';

test('classes, sections and subjects enforce relationships and authorization', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_academic_structure_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), SchoolClass.init(), Section.init(), Subject.init()]);
  await seedAuthorization();
  const password = 'Academic-structure-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-structure@example.test', password, role: 'admin' });
  const student = await User.create({ name: 'Student', email: 'student-structure@example.test', password, role: 'student' });
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

  for (const path of ['/classes', '/sections', '/subjects']) assert.equal((await studentClient(path)).status, 403);
  const classForm = await adminClient('/classes/new');
  assert.equal((await adminClient('/classes', { _csrf: classForm.csrf, name: 'Grade 8', status: 'active' })).status, 303);
  const schoolClass = await SchoolClass.findOne({ name: 'Grade 8' });
  const duplicateClass = await adminClient('/classes', { _csrf: (await adminClient('/classes/new')).csrf, name: 'Grade 8', status: 'active' });
  assert.equal(duplicateClass.status, 422);

  const sectionForm = await adminClient('/sections/new');
  assert.match(sectionForm.text, /Grade 8/);
  assert.equal((await adminClient('/sections', { _csrf: sectionForm.csrf, name: 'Section A', class: schoolClass.id, status: 'active' })).status, 303);
  assert.equal(await Section.countDocuments({ class: schoolClass.id, name: 'Section A' }), 1);
  const duplicateSection = await adminClient('/sections', { _csrf: (await adminClient('/sections/new')).csrf, name: 'Section A', class: schoolClass.id, status: 'active' });
  assert.equal(duplicateSection.status, 422);
  assert.match(duplicateSection.text, /already exists/);

  const subjectForm = await adminClient('/subjects/new');
  assert.equal((await adminClient('/subjects', { _csrf: subjectForm.csrf, name: 'Mathematics', code: 'math', classes: schoolClass.id, status: 'active' })).status, 303);
  const subject = await Subject.findOne({ name: 'Mathematics' });
  assert.deepEqual(subject.classes.map(String), [schoolClass.id]);
  assert.equal(subject.code, 'MATH');
  const invalidSubject = await adminClient('/subjects', { _csrf: (await adminClient('/subjects/new')).csrf, name: 'Science', code: 'SCI', status: 'active' });
  assert.equal(invalidSubject.status, 422);
  assert.match(invalidSubject.text, /Choose at least one class/);
  const edit = await adminClient(`/subjects/${subject.id}/edit`);
  assert.equal((await adminClient(`/subjects/${subject.id}`, { _csrf: edit.csrf, name: 'Mathematics', code: 'MATH8', classes: schoolClass.id, status: 'inactive' })).status, 303);
  assert.equal((await Subject.findById(subject.id)).status, 'inactive');
});
