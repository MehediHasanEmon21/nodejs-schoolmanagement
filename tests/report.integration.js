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
import Exam from '../src/models/Exam.js';
import FeeType from '../src/models/FeeType.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import Mark from '../src/models/Mark.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Student from '../src/models/Student.js';
import StudentFee from '../src/models/StudentFee.js';
import Subject from '../src/models/Subject.js';
import User from '../src/models/User.js';

test('reports render filtered operational data and remain admin-only', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_report_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([
    User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Section.init(), Subject.init(),
    Student.init(), Enrollment.init(), Attendance.init(), Exam.init(), Mark.init(), FeeType.init(), StudentFee.init(),
  ]);
  await seedAuthorization();
  const password = 'Report-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-report@example.test', password, role: 'admin' });
  const teacher = await User.create({ name: 'Teacher', email: 'teacher-report@example.test', password, role: 'teacher' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  const section = await Section.create({ name: 'A', class: schoolClass.id });
  const subject = await Subject.create({ name: 'Report Math', code: 'REP-M', classes: [schoolClass.id] });
  const student = await Student.create({ studentId: 'S-R01', firstName: 'Grace', lastName: 'Hopper', dateOfBirth: new Date('2014-01-01'), gender: 'female', admissionDate: new Date('2026-01-05'), class: schoolClass.id, section: section.id });
  const enrollment = await Enrollment.create({ student: student.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, rollNumber: '1', enrollmentDate: new Date('2026-01-05') });
  await Attendance.create({ academicYear: academicYear.id, class: schoolClass.id, section: section.id, date: new Date('2026-09-25'), records: [{ student: student.id, enrollment: enrollment.id, status: 'present' }], recordedBy: admin.id });
  const exam = await Exam.create({ academicYear: academicYear.id, class: schoolClass.id, name: 'Midterm', startDate: new Date('2026-09-01'), endDate: new Date('2026-09-05'), subjects: [{ subject: subject.id, totalMarks: 100, passMarks: 40 }] });
  await Mark.create({ exam: exam.id, subject: subject.id, student: student.id, enrollment: enrollment.id, marksObtained: 88, recordedBy: admin.id });
  const feeType = await FeeType.create({ name: 'Tuition', defaultAmount: 1000 });
  await StudentFee.create({ student: student.id, academicYear: academicYear.id, feeType: feeType.id, amount: 1000, paidAmount: 400, dueDate: new Date('2026-09-30'), status: 'partial', assignedBy: admin.id });
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
      return { status: response.status, text, csrf: text.match(/name="_csrf" value="([a-f0-9]{64})"/)?.[1] };
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
  assert.equal((await teacherClient('/reports')).status, 403);
  assert.match((await adminClient('/reports')).text, /Student report/);
  assert.match((await adminClient(`/reports/students?class=${schoolClass.id}`)).text, /Grace/);
  assert.match((await adminClient(`/reports/attendance?dateFrom=2026-09-01&dateTo=2026-09-30`)).text, /present 1/i);
  assert.match((await adminClient(`/reports/results?exam=${exam.id}`)).text, /88\/100/);
  assert.match((await adminClient('/reports/fees?status=partial')).text, /600.00/);
});
