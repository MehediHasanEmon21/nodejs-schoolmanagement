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
import Subject from '../src/models/Subject.js';
import Teacher from '../src/models/Teacher.js';
import TeacherAssignment from '../src/models/TeacherAssignment.js';
import TimetableEntry from '../src/models/TimetableEntry.js';
import User from '../src/models/User.js';

test('timetable supports CRUD, conflict prevention and scoped weekly access', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_timetable_test_${randomBytes(8).toString('hex')}` });
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([
    User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Section.init(), Subject.init(),
    Student.init(), Teacher.init(), Guardian.init(), Enrollment.init(), TeacherAssignment.init(), TimetableEntry.init(),
  ]);
  await seedAuthorization();
  const password = 'Timetable-phase-test-123';
  const admin = await User.create({ name: 'Admin', email: 'admin-timetable@example.test', password, role: 'admin' });
  const teacherUser = await User.create({ name: 'Teacher', email: 'teacher-timetable@example.test', password, role: 'teacher' });
  const otherTeacherUser = await User.create({ name: 'Other Teacher', email: 'other-teacher-timetable@example.test', password, role: 'teacher' });
  const studentUser = await User.create({ name: 'Student', email: 'student-timetable@example.test', password, role: 'student' });
  const otherStudentUser = await User.create({ name: 'Other Student', email: 'other-student-timetable@example.test', password, role: 'student' });
  const guardianUser = await User.create({ name: 'Guardian', email: 'guardian-timetable@example.test', password, role: 'guardian' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  const otherClass = await SchoolClass.create({ name: 'Grade 9' });
  const section = await Section.create({ name: 'A', class: schoolClass.id });
  const otherSection = await Section.create({ name: 'B', class: otherClass.id });
  const subject = await Subject.create({ name: 'Mathematics', code: 'MATH-TT', classes: [schoolClass.id] });
  const science = await Subject.create({ name: 'Science', code: 'SCI-TT', classes: [schoolClass.id] });
  const teacher = await Teacher.create({ teacherId: 'T-TT01', user: teacherUser.id, name: 'Ada Teacher', email: 'ada@example.test', joiningDate: new Date('2026-01-01') });
  const otherTeacher = await Teacher.create({ teacherId: 'T-TT02', user: otherTeacherUser.id, name: 'Other Teacher', email: 'other@example.test', joiningDate: new Date('2026-01-01') });
  const student = await Student.create({ studentId: 'S-TT01', user: studentUser.id, firstName: 'Grace', lastName: 'Hopper', dateOfBirth: new Date('2014-01-01'), gender: 'female', admissionDate: new Date('2026-01-05') });
  await Student.create({ studentId: 'S-TT02', user: otherStudentUser.id, firstName: 'Other', lastName: 'Student', dateOfBirth: new Date('2014-01-01'), gender: 'male', admissionDate: new Date('2026-01-05') });
  await Guardian.create({ guardianId: 'G-TT01', user: guardianUser.id, name: 'Guardian', relationship: 'Parent', phone: '123', students: [student.id] });
  await Enrollment.create({ student: student.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, rollNumber: '1', enrollmentDate: new Date('2026-01-05') });
  await TeacherAssignment.create({ teacher: teacher.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: subject.id });
  await TeacherAssignment.create({ teacher: otherTeacher.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: science.id });
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
  assert.equal((await teacherClient('/timetable/new')).status, 403);
  const form = await adminClient('/timetable/new');
  const create = await adminClient('/timetable', {
    _csrf: form.csrf, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: subject.id, teacher: teacher.id,
    day: 'monday', startTime: '08:00', endTime: '08:45', room: 'Room 1', status: 'active',
  });
  assert.equal(create.status, 303);
  const entry = await TimetableEntry.findOne({ subject: subject.id });
  assert.equal(entry.room, 'Room 1');
  const conflict = await adminClient('/timetable', {
    _csrf: (await adminClient('/timetable/new')).csrf, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: science.id, teacher: otherTeacher.id,
    day: 'monday', startTime: '08:30', endTime: '09:15', room: 'Room 2', status: 'active',
  });
  assert.equal(conflict.status, 422);
  assert.match(conflict.text, /already has/);
  const edit = await adminClient(`/timetable/${entry.id}/edit`);
  assert.equal((await adminClient(`/timetable/${entry.id}`, {
    _csrf: edit.csrf, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: subject.id, teacher: teacher.id,
    day: 'monday', startTime: '09:00', endTime: '09:45', room: 'Room 3', status: 'active',
  })).status, 303);
  assert.match((await teacherClient('/timetable')).text, /Mathematics/);
  assert.match((await studentClient('/timetable')).text, /Mathematics/);
  assert.match((await guardianClient('/timetable')).text, /Mathematics/);
  assert.doesNotMatch((await otherStudentClient('/timetable')).text, /Mathematics/);
  const inaccessible = await TimetableEntry.create({
    academicYear: academicYear.id, class: otherClass.id, section: otherSection.id, subject: subject.id, teacher: teacher.id,
    day: 'tuesday', startTime: '10:00', endTime: '10:45', status: 'active',
  });
  assert.equal((await otherStudentClient(`/timetable/${inaccessible.id}`)).status, 404);
});
