import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { createSessionStore, sessionConfig } from '../src/config/session.js';
import { seedAuthorization } from '../src/services/authorization.service.js';
import AcademicYear from '../src/models/AcademicYear.js';
import Enrollment from '../src/models/Enrollment.js';
import Guardian from '../src/models/Guardian.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Student from '../src/models/Student.js';
import User from '../src/models/User.js';

test('student enrollment supports creation, updates, history and class lists', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_enrollment_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Section.init(), Student.init(), Guardian.init(), Enrollment.init()]);
  await seedAuthorization();
  const password = 'Enrollment-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-enrollment@example.test', password, role: 'admin' });
  const teacher = await User.create({ name: 'Teacher', email: 'teacher-enrollment@example.test', password, role: 'teacher' });
  const studentUser = await User.create({ name: 'Student', email: 'student-enrollment@example.test', password, role: 'student' });
  const guardianUser = await User.create({ name: 'Guardian', email: 'guardian-enrollment@example.test', password, role: 'guardian' });
  const otherStudentUser = await User.create({ name: 'Other', email: 'other-enrollment@example.test', password, role: 'student' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const nextYear = await AcademicYear.create({ name: '2027', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31') });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  const otherClass = await SchoolClass.create({ name: 'Grade 9' });
  const section = await Section.create({ name: 'Section A', class: schoolClass.id });
  const otherSection = await Section.create({ name: 'Section A', class: otherClass.id });
  const student = await Student.create({
    studentId: 'ST-001', user: studentUser.id, firstName: 'Ada', lastName: 'Student',
    dateOfBirth: new Date('2015-01-02'), admissionDate: new Date('2026-01-10'), gender: 'female', status: 'active',
  });
  const otherStudent = await Student.create({
    studentId: 'ST-002', user: otherStudentUser.id, firstName: 'Other', lastName: 'Student',
    dateOfBirth: new Date('2015-01-02'), admissionDate: new Date('2026-01-10'), gender: 'male', status: 'active',
  });
  await Guardian.create({ guardianId: 'G-001', user: guardianUser.id, name: 'Guardian', phone: '555', relationship: 'Mother', students: [student.id] });
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
  const guardianClient = await login(guardianUser);

  assert.equal((await teacherClient('/enrollments/new')).status, 403);
  const form = await adminClient('/enrollments/new');
  assert.match(form.text, /Ada Student/);
  assert.equal((await adminClient('/enrollments', {
    _csrf: form.csrf,
    student: student.id,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: section.id,
    rollNumber: '12',
    enrollmentDate: '2026-01-10',
    status: 'active',
  })).status, 303);
  const enrollment = await Enrollment.findOne({ student: student.id, academicYear: academicYear.id });
  assert.equal((await Student.findById(student.id)).class.toString(), schoolClass.id);

  const duplicateStudent = await adminClient('/enrollments', {
    _csrf: (await adminClient('/enrollments/new')).csrf,
    student: student.id,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: section.id,
    rollNumber: '13',
    enrollmentDate: '2026-01-11',
    status: 'active',
  });
  assert.equal(duplicateStudent.status, 422);
  assert.match(duplicateStudent.text, /already has an active enrollment/);

  const duplicateRoll = await adminClient('/enrollments', {
    _csrf: (await adminClient('/enrollments/new')).csrf,
    student: otherStudent.id,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: section.id,
    rollNumber: '12',
    enrollmentDate: '2026-01-11',
    status: 'active',
  });
  assert.equal(duplicateRoll.status, 422);
  assert.match(duplicateRoll.text, /roll number/);

  const wrongSection = await adminClient('/enrollments', {
    _csrf: (await adminClient('/enrollments/new')).csrf,
    student: otherStudent.id,
    academicYear: academicYear.id,
    class: schoolClass.id,
    section: otherSection.id,
    rollNumber: '14',
    enrollmentDate: '2026-01-11',
    status: 'active',
  });
  assert.equal(wrongSection.status, 422);
  assert.match(wrongSection.text, /belongs to the selected class/);

  const list = await adminClient('/enrollments?q=Ada&status=active&sort=rollNumber');
  assert.equal(list.status, 200);
  assert.match(list.text, /Ada Student/);
  assert.equal((await teacherClient(`/enrollments/${enrollment.id}`)).status, 200);
  assert.equal((await studentClient(`/enrollments/${enrollment.id}`)).status, 200);
  assert.equal((await guardianClient(`/enrollments/${enrollment.id}`)).status, 200);

  const history = await studentClient(`/enrollments/students/${student.id}/history`);
  assert.equal(history.status, 200);
  assert.match(history.text, /2026/);
  assert.equal((await studentClient(`/enrollments/students/${otherStudent.id}/history`)).status, 404);
  const classStudents = await teacherClient(`/enrollments/classes/${schoolClass.id}/students`);
  assert.equal(classStudents.status, 200);
  assert.match(classStudents.text, /Ada Student/);

  const edit = await adminClient(`/enrollments/${enrollment.id}/edit`);
  assert.equal((await adminClient(`/enrollments/${enrollment.id}`, {
    _csrf: edit.csrf,
    student: student.id,
    academicYear: nextYear.id,
    class: otherClass.id,
    section: otherSection.id,
    rollNumber: '21',
    enrollmentDate: '2027-01-10',
    status: 'active',
  })).status, 303);
  const updated = await Enrollment.findById(enrollment.id);
  assert.equal(updated.rollNumber, '21');
  assert.equal((await Student.findById(student.id)).class.toString(), otherClass.id);
});
