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
import Notice from '../src/models/Notice.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Student from '../src/models/Student.js';
import Subject from '../src/models/Subject.js';
import Teacher from '../src/models/Teacher.js';
import TeacherAssignment from '../src/models/TeacherAssignment.js';
import User from '../src/models/User.js';

test('notices support publishing, audience targeting and scoped visibility', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_notice_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([
    User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Section.init(), Subject.init(),
    Student.init(), Teacher.init(), Guardian.init(), Enrollment.init(), TeacherAssignment.init(), Notice.init(),
  ]);
  await seedAuthorization();
  const password = 'Notice-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-notice@example.test', password, role: 'admin' });
  const teacherUser = await User.create({ name: 'Teacher', email: 'teacher-notice@example.test', password, role: 'teacher' });
  const studentUser = await User.create({ name: 'Student', email: 'student-notice@example.test', password, role: 'student' });
  const otherStudentUser = await User.create({ name: 'Other Student', email: 'other-student-notice@example.test', password, role: 'student' });
  const guardianUser = await User.create({ name: 'Guardian', email: 'guardian-notice@example.test', password, role: 'guardian' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  const section = await Section.create({ name: 'A', class: schoolClass.id });
  const subject = await Subject.create({ name: 'Notice Math', code: 'NTC-M', classes: [schoolClass.id] });
  const teacher = await Teacher.create({ teacherId: 'T-N01', user: teacherUser.id, name: 'Notice Teacher', email: 'notice-teacher@example.test', joiningDate: new Date('2026-01-01') });
  const student = await Student.create({ studentId: 'S-N01', user: studentUser.id, firstName: 'Grace', lastName: 'Hopper', dateOfBirth: new Date('2014-01-01'), gender: 'female', admissionDate: new Date('2026-01-05') });
  await Student.create({ studentId: 'S-N02', user: otherStudentUser.id, firstName: 'Other', lastName: 'Student', dateOfBirth: new Date('2014-01-01'), gender: 'male', admissionDate: new Date('2026-01-05') });
  await Enrollment.create({ student: student.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, rollNumber: '1', enrollmentDate: new Date('2026-01-05') });
  await Guardian.create({ guardianId: 'G-N01', user: guardianUser.id, name: 'Guardian', relationship: 'Parent', phone: '123', students: [student.id] });
  await TeacherAssignment.create({ teacher: teacher.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: subject.id });
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
  const studentClient = await login(studentUser);
  const otherStudentClient = await login(otherStudentUser);
  const guardianClient = await login(guardianUser);
  assert.equal((await teacherClient('/notices/new')).status, 403);
  const form = await adminClient('/notices/new');
  const invalid = await adminClient('/notices', { _csrf: form.csrf, title: 'Class notice', body: 'Details', audience: 'section', status: 'published' });
  assert.equal(invalid.status, 422);
  assert.match(invalid.text, /Choose a class/);
  const created = await adminClient('/notices', {
    _csrf: (await adminClient('/notices/new')).csrf,
    title: 'Class Assembly', body: 'Meet in the hall.', audience: 'section', class: schoolClass.id, section: section.id, status: 'published',
  });
  assert.equal(created.status, 303);
  const notice = await Notice.findOne({ title: 'Class Assembly' });
  assert.ok(notice);
  const edit = await adminClient(`/notices/${notice.id}/edit`);
  assert.equal((await adminClient(`/notices/${notice.id}`, {
    _csrf: edit.csrf,
    title: 'Class Assembly Updated', body: 'Meet in the main hall.', audience: 'section', class: schoolClass.id, section: section.id, status: 'published',
  })).status, 303);
  await Notice.create({ title: 'Draft Secret', body: 'Hidden', audience: 'everyone', status: 'draft', createdBy: admin.id });
  assert.match((await teacherClient('/notices')).text, /Class Assembly Updated/);
  assert.match((await studentClient('/notices')).text, /Class Assembly Updated/);
  assert.match((await guardianClient('/notices')).text, /Class Assembly Updated/);
  const otherList = await otherStudentClient('/notices');
  assert.doesNotMatch(otherList.text, /Class Assembly Updated/);
  assert.doesNotMatch((await studentClient('/notices')).text, /Draft Secret/);
  assert.equal((await otherStudentClient(`/notices/${notice.id}`)).status, 404);
});
