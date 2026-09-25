import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import mongoose from 'mongoose';
import AcademicYear from '../src/models/AcademicYear.js';
import Attendance from '../src/models/Attendance.js';
import Enrollment from '../src/models/Enrollment.js';
import Exam from '../src/models/Exam.js';
import FeeType from '../src/models/FeeType.js';
import Guardian from '../src/models/Guardian.js';
import Mark from '../src/models/Mark.js';
import Notice from '../src/models/Notice.js';
import Payment from '../src/models/Payment.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Student from '../src/models/Student.js';
import StudentFee from '../src/models/StudentFee.js';
import Subject from '../src/models/Subject.js';
import Teacher from '../src/models/Teacher.js';
import TeacherAssignment from '../src/models/TeacherAssignment.js';
import TimetableEntry from '../src/models/TimetableEntry.js';
import User from '../src/models/User.js';
import { cleanupDemoSeedData, seedDemoData } from '../src/services/demo-seed.service.js';

test('demo seed data covers the walkthrough and can be rerun safely', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_demo_seed_test_${randomBytes(8).toString('hex')}` });
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const first = await seedDemoData({ environment: { NODE_ENV: 'test' } });
  assert.equal(first.counts.users, 4);
  assert.equal(await User.countDocuments({ email: /@example\.test$/ }), 4);
  assert.equal(await AcademicYear.countDocuments({ name: 'Demo Academic Year 2026' }), 1);
  assert.equal(await SchoolClass.countDocuments({ name: /^Demo Grade/ }), 2);
  assert.equal(await Section.countDocuments({ name: 'Demo Section A' }), 2);
  assert.equal(await Subject.countDocuments({ code: /^DEMO-/ }), 3);
  assert.equal(await Teacher.countDocuments({ teacherId: /^DEMO-/ }), 2);
  assert.equal(await Student.countDocuments({ studentId: /^DEMO-/ }), 3);
  assert.equal(await Guardian.countDocuments({ guardianId: /^DEMO-/ }), 2);
  assert.equal(await Enrollment.countDocuments({ rollNumber: /^D-/ }), 3);
  assert.equal(await TeacherAssignment.countDocuments({ status: 'active' }), 3);
  assert.equal(await Attendance.countDocuments({}), 2);
  assert.equal(await Exam.countDocuments({ name: 'Demo Midterm Exam' }), 1);
  assert.equal(await Mark.countDocuments({}), 6);
  assert.equal(await FeeType.countDocuments({ name: /^Demo / }), 2);
  assert.equal(await StudentFee.countDocuments({}), 3);
  assert.equal(await Payment.countDocuments({ referenceNumber: /^DEMO-PAY-/ }), 2);
  assert.equal(await TimetableEntry.countDocuments({ room: /^Demo / }), 3);
  assert.equal(await Notice.countDocuments({ title: /^Demo / }), 2);

  const second = await seedDemoData({ environment: { NODE_ENV: 'test' } });
  assert.ok(Object.values(second.deleted).some((count) => count > 0));
  assert.equal(await User.countDocuments({ email: /@example\.test$/ }), 4);
  assert.equal(await Student.countDocuments({ studentId: /^DEMO-/ }), 3);
  assert.equal(await Payment.countDocuments({ referenceNumber: /^DEMO-PAY-/ }), 2);

  await cleanupDemoSeedData();
  assert.equal(await User.countDocuments({ email: /@example\.test$/ }), 0);
  assert.equal(await Student.countDocuments({ studentId: /^DEMO-/ }), 0);
  assert.equal(await Payment.countDocuments({ referenceNumber: /^DEMO-PAY-/ }), 0);
});
