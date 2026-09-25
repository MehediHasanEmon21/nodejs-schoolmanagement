import assert from 'node:assert/strict';
import { test } from 'node:test';
import AcademicYear from '../src/models/AcademicYear.js';
import Attendance from '../src/models/Attendance.js';
import Enrollment from '../src/models/Enrollment.js';
import Exam from '../src/models/Exam.js';
import FeeType from '../src/models/FeeType.js';
import Guardian from '../src/models/Guardian.js';
import Notice from '../src/models/Notice.js';
import SchoolClass from '../src/models/SchoolClass.js';
import Section from '../src/models/Section.js';
import Student from '../src/models/Student.js';
import StudentFee from '../src/models/StudentFee.js';
import Subject from '../src/models/Subject.js';
import Teacher from '../src/models/Teacher.js';
import TimetableEntry from '../src/models/TimetableEntry.js';
import { reportOptions } from '../src/services/report.service.js';

function hasIndex(model, keys) {
  return model.schema.indexes().some(([index]) => JSON.stringify(index) === JSON.stringify(keys));
}

test('common list and report queries have supporting indexes', () => {
  assert.equal(hasIndex(AcademicYear, { status: 1, startDate: -1 }), true);
  assert.equal(hasIndex(SchoolClass, { status: 1, name: 1 }), true);
  assert.equal(hasIndex(Section, { status: 1, class: 1, name: 1 }), true);
  assert.equal(hasIndex(Subject, { status: 1, name: 1 }), true);
  assert.equal(hasIndex(Student, { status: 1, firstName: 1, lastName: 1 }), true);
  assert.equal(hasIndex(Student, { class: 1, section: 1, status: 1 }), true);
  assert.equal(hasIndex(Teacher, { status: 1, name: 1 }), true);
  assert.equal(hasIndex(Guardian, { students: 1, status: 1 }), true);
  assert.equal(hasIndex(Enrollment, { academicYear: 1, class: 1, section: 1, status: 1, rollNumber: 1 }), true);
  assert.equal(hasIndex(Attendance, { academicYear: 1, class: 1, section: 1, date: -1 }), true);
  assert.equal(hasIndex(Exam, { status: 1, startDate: -1 }), true);
  assert.equal(hasIndex(FeeType, { status: 1, name: 1 }), true);
  assert.equal(hasIndex(StudentFee, { dueDate: 1, status: 1 }), true);
  assert.equal(hasIndex(Notice, { status: 1, visibleUntil: 1 }), true);
  assert.equal(hasIndex(TimetableEntry, { academicYear: 1, teacher: 1, day: 1, startTime: 1 }), true);
});

test('report option helper keeps bounded exam option reads', async () => {
  // Static source check: exam option lists are intentionally capped for admin report filters.
  const source = reportOptions.toString();
  assert.match(source, /Exam\.find\(\{\}\).*limit\(200\)/s);
});
