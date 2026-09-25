import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import { seedAuthorization } from '../src/services/authorization.service.js';
import AcademicYear from '../src/models/AcademicYear.js';
import Attendance from '../src/models/Attendance.js';
import Enrollment from '../src/models/Enrollment.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Student from '../src/models/Student.js';
import Subject from '../src/models/Subject.js';
import Teacher from '../src/models/Teacher.js';
import TeacherAssignment from '../src/models/TeacherAssignment.js';
import User from '../src/models/User.js';

test('attendance supports daily entry, updates, history, summaries and teacher scoping', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_attendance_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([
    User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Section.init(), Subject.init(),
    Student.init(), Teacher.init(), TeacherAssignment.init(), Enrollment.init(), Attendance.init(),
  ]);
  await seedAuthorization();
  const password = 'Attendance-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-attendance@example.test', password, role: 'admin' });
  const teacherUser = await User.create({ name: 'Teacher', email: 'teacher-attendance@example.test', password, role: 'teacher' });
  const otherTeacherUser = await User.create({ name: 'Other Teacher', email: 'other-attendance@example.test', password, role: 'teacher' });
  const studentUser = await User.create({ name: 'Student', email: 'student-attendance@example.test', password, role: 'student' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  const section = await Section.create({ name: 'Section A', class: schoolClass.id });
  const subject = await Subject.create({ name: 'Mathematics', code: 'MATH', classes: [schoolClass.id] });
  const teacher = await Teacher.create({ teacherId: 'T-001', user: teacherUser.id, name: 'Ada Teacher', email: 'ada-attendance@example.test', joiningDate: new Date('2025-01-01') });
  await Teacher.create({ teacherId: 'T-002', user: otherTeacherUser.id, name: 'Other Teacher', email: 'other-attendance@example.test', joiningDate: new Date('2025-01-01') });
  const student = await Student.create({
    studentId: 'S-001', user: studentUser.id, firstName: 'Grace', lastName: 'Hopper',
    dateOfBirth: new Date('2014-01-01'), gender: 'female', admissionDate: new Date('2026-01-05'),
    class: schoolClass.id, section: section.id,
  });
  await Enrollment.create({
    student: student.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id,
    rollNumber: '1', enrollmentDate: new Date('2026-01-05'), status: 'active',
  });
  await TeacherAssignment.create({
    teacher: teacher.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: subject.id, status: 'active',
  });
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

  assert.equal((await studentClient('/attendance/new')).status, 403);
  const form = await teacherClient(`/attendance/new?academicYear=${academicYear.id}&class=${schoolClass.id}&section=${section.id}&date=2026-09-25`);
  assert.equal(form.status, 200);
  assert.match(form.text, /Grace Hopper/);
  assert.equal((await teacherClient('/attendance', {
    _csrf: form.csrf,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: section.id,
    date: '2026-09-25',
    [`status_${student.id}`]: 'absent',
    [`note_${student.id}`]: 'Family notice',
  })).status, 303);
  const attendance = await Attendance.findOne({ class: schoolClass.id, section: section.id });
  assert.equal(attendance.records[0].status, 'absent');

  const duplicate = await adminClient('/attendance', {
    _csrf: (await adminClient(`/attendance/new?academicYear=${academicYear.id}&class=${schoolClass.id}&section=${section.id}&date=2026-09-25`)).csrf,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: section.id,
    date: '2026-09-25',
    [`status_${student.id}`]: 'present',
  });
  assert.equal(duplicate.status, 422);
  assert.match(duplicate.text, /already been recorded/);

  assert.equal((await otherTeacherClient(`/attendance/${attendance.id}`)).status, 404);
  const show = await teacherClient(`/attendance/${attendance.id}`);
  assert.equal(show.status, 200);
  assert.match(show.text, /Family notice/);
  const edit = await teacherClient(`/attendance/${attendance.id}/edit`);
  assert.equal((await teacherClient(`/attendance/${attendance.id}`, {
    _csrf: edit.csrf,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: section.id,
    date: '2026-09-25',
    [`status_${student.id}`]: 'present',
  })).status, 303);
  assert.equal((await Attendance.findById(attendance.id)).records[0].status, 'present');

  const history = await studentClient(`/attendance/students/${student.id}/history`);
  assert.equal(history.status, 200);
  assert.match(history.text, /Present/);
  const summary = await teacherClient(`/attendance/classes/${schoolClass.id}/summary`);
  assert.equal(summary.status, 200);
  assert.match(summary.text, /Attendance days/);
  assert.match(summary.text, /Present/);
});
