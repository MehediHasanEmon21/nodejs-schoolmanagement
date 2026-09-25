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
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Subject from '../src/models/Subject.js';
import Teacher from '../src/models/Teacher.js';
import TeacherAssignment from '../src/models/TeacherAssignment.js';
import User from '../src/models/User.js';

test('teacher assignment supports creation, updates and scoped teacher/class views', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_teacher_assignment_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Section.init(), Subject.init(), Teacher.init(), TeacherAssignment.init()]);
  await seedAuthorization();
  const password = 'Teacher-assignment-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-teacher-assignment@example.test', password, role: 'admin' });
  const teacherUser = await User.create({ name: 'Teacher', email: 'teacher-assignment@example.test', password, role: 'teacher' });
  const otherTeacherUser = await User.create({ name: 'Other Teacher', email: 'other-teacher-assignment@example.test', password, role: 'teacher' });
  const studentUser = await User.create({ name: 'Student', email: 'student-teacher-assignment@example.test', password, role: 'student' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const nextYear = await AcademicYear.create({ name: '2027', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31') });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  const otherClass = await SchoolClass.create({ name: 'Grade 9' });
  const section = await Section.create({ name: 'Section A', class: schoolClass.id });
  const otherSection = await Section.create({ name: 'Section B', class: otherClass.id });
  const subject = await Subject.create({ name: 'Mathematics', code: 'MATH', classes: [schoolClass.id] });
  const otherSubject = await Subject.create({ name: 'Physics', code: 'PHY', classes: [otherClass.id] });
  const teacher = await Teacher.create({ teacherId: 'T-001', user: teacherUser.id, name: 'Ada Teacher', email: 'ada-teacher@example.test', joiningDate: new Date('2025-01-01') });
  const otherTeacher = await Teacher.create({ teacherId: 'T-002', user: otherTeacherUser.id, name: 'Other Teacher', email: 'other-teacher@example.test', joiningDate: new Date('2025-01-01') });
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
  const otherTeacherClient = await login(otherTeacherUser);
  const studentClient = await login(studentUser);

  assert.equal((await studentClient('/teacher-assignments')).status, 403);
  assert.equal((await teacherClient('/teacher-assignments/new')).status, 403);
  const form = await adminClient('/teacher-assignments/new');
  assert.match(form.text, /Ada Teacher/);
  assert.equal((await adminClient('/teacher-assignments', {
    _csrf: form.csrf,
    teacher: teacher.id,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: section.id,
    subject: subject.id,
    status: 'active',
  })).status, 303);
  const assignment = await TeacherAssignment.findOne({ teacher: teacher.id, academicYear: academicYear.id });

  const duplicate = await adminClient('/teacher-assignments', {
    _csrf: (await adminClient('/teacher-assignments/new')).csrf,
    teacher: teacher.id,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: section.id,
    subject: subject.id,
    status: 'active',
  });
  assert.equal(duplicate.status, 422);
  assert.match(duplicate.text, /already has an active assignment/);

  const wrongSubject = await adminClient('/teacher-assignments', {
    _csrf: (await adminClient('/teacher-assignments/new')).csrf,
    teacher: teacher.id,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: section.id,
    subject: otherSubject.id,
    status: 'active',
  });
  assert.equal(wrongSubject.status, 422);
  assert.match(wrongSubject.text, /subject assigned to the selected class/);

  const list = await adminClient('/teacher-assignments?q=Ada&status=active&sort=subject');
  assert.equal(list.status, 200);
  assert.match(list.text, /Ada Teacher/);
  assert.equal((await teacherClient(`/teacher-assignments/${assignment.id}`)).status, 200);
  assert.equal((await otherTeacherClient(`/teacher-assignments/${assignment.id}`)).status, 404);

  const teacherAssignments = await teacherClient(`/teacher-assignments/teachers/${teacher.id}`);
  assert.equal(teacherAssignments.status, 200);
  assert.match(teacherAssignments.text, /Mathematics/);
  assert.equal((await teacherClient(`/teacher-assignments/teachers/${otherTeacher.id}`)).status, 404);
  const classAssignments = await teacherClient(`/teacher-assignments/classes/${schoolClass.id}`);
  assert.equal(classAssignments.status, 200);
  assert.match(classAssignments.text, /Ada Teacher/);

  const edit = await adminClient(`/teacher-assignments/${assignment.id}/edit`);
  assert.equal((await adminClient(`/teacher-assignments/${assignment.id}`, {
    _csrf: edit.csrf,
    teacher: teacher.id,
    academicYear: nextYear.id,
    class: otherClass.id,
    section: otherSection.id,
    subject: otherSubject.id,
    status: 'inactive',
  })).status, 303);
  const updated = await TeacherAssignment.findById(assignment.id);
  assert.equal(updated.status, 'inactive');
  assert.equal(updated.class.toString(), otherClass.id);
});
