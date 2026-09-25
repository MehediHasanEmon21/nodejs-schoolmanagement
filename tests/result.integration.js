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
import Exam from '../src/models/Exam.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import Mark from '../src/models/Mark.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Student from '../src/models/Student.js';
import Subject from '../src/models/Subject.js';
import Teacher from '../src/models/Teacher.js';
import TeacherAssignment from '../src/models/TeacherAssignment.js';
import User from '../src/models/User.js';

test('marks and results support entry, edits, calculation and scoped access', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_result_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([
    User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Section.init(), Student.init(), Subject.init(),
    Teacher.init(), TeacherAssignment.init(), Enrollment.init(), Exam.init(), Mark.init(),
  ]);
  await seedAuthorization();
  const password = 'Result-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-result@example.test', password, role: 'admin' });
  const teacherUser = await User.create({ name: 'Teacher', email: 'teacher-result@example.test', password, role: 'teacher' });
  const otherTeacherUser = await User.create({ name: 'Other Teacher', email: 'other-result@example.test', password, role: 'teacher' });
  const studentUser = await User.create({ name: 'Student', email: 'student-result@example.test', password, role: 'student' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  const section = await Section.create({ name: 'Section A', class: schoolClass.id });
  const subject = await Subject.create({ name: 'Mathematics', code: 'MATH-R', classes: [schoolClass.id] });
  const teacher = await Teacher.create({ teacherId: 'T-R01', user: teacherUser.id, name: 'Ada Teacher', email: 'ada-result@example.test', joiningDate: new Date('2025-01-01') });
  await Teacher.create({ teacherId: 'T-R02', user: otherTeacherUser.id, name: 'Other Teacher', email: 'other-result@example.test', joiningDate: new Date('2025-01-01') });
  const student = await Student.create({
    studentId: 'S-R01', user: studentUser.id, firstName: 'Grace', lastName: 'Hopper',
    dateOfBirth: new Date('2014-01-01'), gender: 'female', admissionDate: new Date('2026-01-05'), class: schoolClass.id, section: section.id,
  });
  await Enrollment.create({ student: student.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, rollNumber: '1', enrollmentDate: new Date('2026-01-05'), status: 'active' });
  await TeacherAssignment.create({ teacher: teacher.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: subject.id, status: 'active' });
  const exam = await Exam.create({
    academicYear: academicYear.id,
    class: schoolClass.id,
    name: 'Final Exam',
    startDate: new Date('2026-10-01'),
    endDate: new Date('2026-10-10'),
    status: 'scheduled',
    subjects: [{ subject: subject.id, totalMarks: 100, passMarks: 33, examDate: new Date('2026-10-02') }],
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

  const form = await teacherClient(`/results/entry?exam=${exam.id}&subject=${subject.id}`);
  assert.equal(form.status, 200);
  assert.match(form.text, /Grace Hopper/);
  assert.equal((await otherTeacherClient(`/results/entry?exam=${exam.id}&subject=${subject.id}`)).status, 403);
  assert.equal((await teacherClient('/results/entry', {
    _csrf: form.csrf,
    exam: exam.id,
    subject: subject.id,
    [`marks_${student.id}`]: '88',
    [`note_${student.id}`]: 'Strong work',
  })).status, 303);
  assert.equal((await Mark.findOne({ exam: exam.id, subject: subject.id, student: student.id })).marksObtained, 88);

  const edit = await teacherClient(`/results/entry?exam=${exam.id}&subject=${subject.id}`);
  assert.equal((await teacherClient('/results/entry', {
    _csrf: edit.csrf,
    exam: exam.id,
    subject: subject.id,
    [`marks_${student.id}`]: '91',
  })).status, 303);
  assert.equal((await Mark.findOne({ exam: exam.id, subject: subject.id, student: student.id })).marksObtained, 91);

  const invalid = await adminClient('/results/entry', {
    _csrf: (await adminClient(`/results/entry?exam=${exam.id}&subject=${subject.id}`)).csrf,
    exam: exam.id,
    subject: subject.id,
    [`marks_${student.id}`]: '101',
  });
  assert.equal(invalid.status, 422);
  assert.match(invalid.text, /between 0 and 100/);

  const studentResult = await studentClient(`/results/exams/${exam.id}/students/${student.id}`);
  assert.equal(studentResult.status, 200);
  assert.match(studentResult.text, /91\/100/);
  assert.match(studentResult.text, /A\+/);
  const classResult = await teacherClient(`/results/exams/${exam.id}/class`);
  assert.equal(classResult.status, 200);
  assert.match(classResult.text, /Grace Hopper/);
});
