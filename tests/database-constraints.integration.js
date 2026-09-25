import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import AcademicYear from '../src/models/AcademicYear.js';
import Attendance from '../src/models/Attendance.js';
import Enrollment from '../src/models/Enrollment.js';
import Exam from '../src/models/Exam.js';
import FeeType from '../src/models/FeeType.js';
import LoginAttempt from '../src/models/LoginAttempt.js';
import Mark from '../src/models/Mark.js';
import Payment from '../src/models/Payment.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Student from '../src/models/Student.js';
import StudentFee from '../src/models/StudentFee.js';
import Subject from '../src/models/Subject.js';
import Teacher from '../src/models/Teacher.js';
import TeacherAssignment from '../src/models/TeacherAssignment.js';
import User from '../src/models/User.js';

async function rejectsDuplicate(operation) {
  await assert.rejects(operation, (error) => error?.code === 11000);
}

test('database constraints protect critical duplicate records', { skip: !process.env.MONGODB_URI }, async (t) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: `school_constraints_test_${randomBytes(8).toString('hex')}` });
  t.after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  await Promise.all([
    User.init(), LoginAttempt.init(), AcademicYear.init(), SchoolClass.init(), Section.init(), Subject.init(),
    Student.init(), Teacher.init(), Enrollment.init(), TeacherAssignment.init(), Attendance.init(),
    Exam.init(), Mark.init(), FeeType.init(), StudentFee.init(), Payment.init(),
  ]);
  const admin = await User.create({ name: 'Admin', email: 'admin-constraints@example.test', password: 'Constraint-test-123', role: 'admin' });
  const academicYear = await AcademicYear.create({ name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true });
  const schoolClass = await SchoolClass.create({ name: 'Grade 8' });
  await rejectsDuplicate(() => SchoolClass.create({ name: 'Grade 8' }));
  const section = await Section.create({ name: 'A', class: schoolClass.id });
  await rejectsDuplicate(() => Section.create({ name: 'A', class: schoolClass.id }));
  const subject = await Subject.create({ name: 'Mathematics Constraints', code: 'MATH-C', classes: [schoolClass.id] });
  await rejectsDuplicate(() => Subject.create({ name: 'Other Math', code: 'MATH-C', classes: [schoolClass.id] }));
  const student = await Student.create({ studentId: 'S-C01', firstName: 'Grace', lastName: 'Hopper', dateOfBirth: new Date('2014-01-01'), gender: 'female', admissionDate: new Date('2026-01-05') });
  const secondStudent = await Student.create({ studentId: 'S-C02', firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: new Date('2014-02-01'), gender: 'female', admissionDate: new Date('2026-01-05') });
  const teacher = await Teacher.create({ teacherId: 'T-C01', name: 'Alan Teacher', email: 'alan-constraints@example.test', joiningDate: new Date('2026-01-01') });
  const enrollment = await Enrollment.create({ student: student.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, rollNumber: '1', enrollmentDate: new Date('2026-01-05') });
  await rejectsDuplicate(() => Enrollment.create({ student: student.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, rollNumber: '2', enrollmentDate: new Date('2026-01-06') }));
  await rejectsDuplicate(() => Enrollment.create({ student: secondStudent.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, rollNumber: '1', enrollmentDate: new Date('2026-01-06') }));
  await TeacherAssignment.create({ teacher: teacher.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: subject.id });
  await rejectsDuplicate(() => TeacherAssignment.create({ teacher: teacher.id, academicYear: academicYear.id, class: schoolClass.id, section: section.id, subject: subject.id }));
  await Attendance.create({ academicYear: academicYear.id, class: schoolClass.id, section: section.id, date: new Date('2026-09-25'), records: [{ student: student.id, enrollment: enrollment.id, status: 'present' }], recordedBy: admin.id });
  await rejectsDuplicate(() => Attendance.create({ academicYear: academicYear.id, class: schoolClass.id, section: section.id, date: new Date('2026-09-25'), records: [], recordedBy: admin.id }));
  const exam = await Exam.create({ academicYear: academicYear.id, class: schoolClass.id, name: 'Midterm', startDate: new Date('2026-09-01'), endDate: new Date('2026-09-05'), subjects: [{ subject: subject.id, totalMarks: 100, passMarks: 40 }] });
  await rejectsDuplicate(() => Exam.create({ academicYear: academicYear.id, class: schoolClass.id, name: 'Midterm', startDate: new Date('2026-10-01'), endDate: new Date('2026-10-05') }));
  await Mark.create({ exam: exam.id, subject: subject.id, student: student.id, enrollment: enrollment.id, marksObtained: 88, recordedBy: admin.id });
  await rejectsDuplicate(() => Mark.create({ exam: exam.id, subject: subject.id, student: student.id, enrollment: enrollment.id, marksObtained: 90, recordedBy: admin.id }));
  const feeType = await FeeType.create({ name: 'Tuition Constraint', defaultAmount: 1000 });
  const studentFee = await StudentFee.create({ student: student.id, academicYear: academicYear.id, feeType: feeType.id, amount: 1000, paidAmount: 0, dueDate: new Date('2026-09-30'), assignedBy: admin.id });
  await rejectsDuplicate(() => StudentFee.create({ student: student.id, academicYear: academicYear.id, feeType: feeType.id, amount: 1000, paidAmount: 0, dueDate: new Date('2026-09-30'), assignedBy: admin.id }));
  await Payment.create({ studentFee: studentFee.id, amount: 200, paidAt: new Date('2026-09-25'), method: 'cash', referenceNumber: 'REF-C01', recordedBy: admin.id });
  await rejectsDuplicate(() => Payment.create({ studentFee: studentFee.id, amount: 100, paidAt: new Date('2026-09-26'), method: 'cash', referenceNumber: 'REF-C01', recordedBy: admin.id }));
});
