import AcademicYear from '../models/AcademicYear.js';
import Attendance from '../models/Attendance.js';
import Enrollment from '../models/Enrollment.js';
import Exam from '../models/Exam.js';
import FeeType from '../models/FeeType.js';
import Guardian from '../models/Guardian.js';
import Mark from '../models/Mark.js';
import Notice from '../models/Notice.js';
import Payment from '../models/Payment.js';
import SchoolClass from '../models/SchoolClass.js';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import StudentFee from '../models/StudentFee.js';
import Subject from '../models/Subject.js';
import Teacher from '../models/Teacher.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import TimetableEntry from '../models/TimetableEntry.js';
import User from '../models/User.js';
import { seedAuthorization } from './authorization.service.js';

export const demoSeedPassword = 'DemoPass12345!';

export const demoSeedUsers = [
  { key: 'admin', name: 'Demo Admin', email: 'demo.admin@example.test', role: 'admin' },
  { key: 'teacher', name: 'Demo Teacher', email: 'demo.teacher@example.test', role: 'teacher' },
  { key: 'student', name: 'Demo Student', email: 'demo.student@example.test', role: 'student' },
  { key: 'guardian', name: 'Demo Guardian', email: 'demo.guardian@example.test', role: 'guardian' },
];

const demoAcademicYearName = 'Demo Academic Year 2026';
const demoClassNames = ['Demo Grade 8', 'Demo Grade 9'];
const demoSubjectCodes = ['DEMO-ENG', 'DEMO-MATH', 'DEMO-SCI'];
const demoTeacherIds = ['DEMO-T001', 'DEMO-T002'];
const demoStudentIds = ['DEMO-S001', 'DEMO-S002', 'DEMO-S003'];
const demoGuardianIds = ['DEMO-G001', 'DEMO-G002'];
const demoFeeTypeNames = ['Demo Tuition Fee', 'Demo Exam Fee'];
const demoExamNames = ['Demo Midterm Exam'];
const demoPaymentReferences = ['DEMO-PAY-001', 'DEMO-PAY-002'];

const modelInitializers = [
  User, AcademicYear, SchoolClass, Section, Subject, Teacher, Student, Guardian, Enrollment,
  TeacherAssignment, Attendance, Exam, Mark, FeeType, StudentFee, Payment, TimetableEntry, Notice,
];

function utcDate(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function ids(records) {
  return records.map((record) => record._id);
}

function orFilter(conditions) {
  const filtered = conditions.filter(Boolean);
  return filtered.length ? { $or: filtered } : null;
}

async function deleteIfAny(Model, filter) {
  if (!filter || Object.values(filter).some((value) => Array.isArray(value?.$in) && value.$in.length === 0)) {
    return { deletedCount: 0 };
  }
  return Model.deleteMany(filter);
}

export function assertDemoSeedAllowed(environment = process.env) {
  if (environment.NODE_ENV === 'production' && environment.ALLOW_DEMO_SEED_IN_PRODUCTION !== 'true') {
    throw new Error('Demo seeding is disabled in production. Set ALLOW_DEMO_SEED_IN_PRODUCTION=true only for an intentional demo database.');
  }
}

async function ensureDemoIndexes() {
  await Promise.all(modelInitializers.map((Model) => Model.init()));
}

async function findDemoRecords() {
  const [users, academicYears, classes, subjects, teachers, students, guardians, feeTypes] = await Promise.all([
    User.find({ email: { $in: demoSeedUsers.map((user) => user.email) } }).select('_id').lean(),
    AcademicYear.find({ name: demoAcademicYearName }).select('_id').lean(),
    SchoolClass.find({ name: { $in: demoClassNames } }).select('_id').lean(),
    Subject.find({ code: { $in: demoSubjectCodes } }).select('_id').lean(),
    Teacher.find({ teacherId: { $in: demoTeacherIds } }).select('_id').lean(),
    Student.find({ studentId: { $in: demoStudentIds } }).select('_id').lean(),
    Guardian.find({ guardianId: { $in: demoGuardianIds } }).select('_id').lean(),
    FeeType.find({ name: { $in: demoFeeTypeNames } }).select('_id').lean(),
  ]);
  const classIds = ids(classes);
  const academicYearIds = ids(academicYears);
  const studentIds = ids(students);
  const teacherIds = ids(teachers);
  const feeTypeIds = ids(feeTypes);
  const [sections, enrollments, assignments, attendances, exams, studentFees] = await Promise.all([
    classIds.length ? Section.find({ class: { $in: classIds }, name: 'Demo Section A' }).select('_id').lean() : [],
    studentIds.length || academicYearIds.length || classIds.length ? Enrollment.find(orFilter([
        ...(studentIds.length ? [{ student: { $in: studentIds } }] : []),
        ...(academicYearIds.length ? [{ academicYear: { $in: academicYearIds } }] : []),
        ...(classIds.length ? [{ class: { $in: classIds } }] : []),
      ])).select('_id').lean() : [],
    teacherIds.length || academicYearIds.length || classIds.length ? TeacherAssignment.find(orFilter([
        ...(teacherIds.length ? [{ teacher: { $in: teacherIds } }] : []),
        ...(academicYearIds.length ? [{ academicYear: { $in: academicYearIds } }] : []),
        ...(classIds.length ? [{ class: { $in: classIds } }] : []),
      ])).select('_id').lean() : [],
    academicYearIds.length || classIds.length ? Attendance.find(orFilter([
        ...(academicYearIds.length ? [{ academicYear: { $in: academicYearIds } }] : []),
        ...(classIds.length ? [{ class: { $in: classIds } }] : []),
      ])).select('_id').lean() : [],
    academicYearIds.length || classIds.length ? Exam.find(orFilter([
        { name: { $in: demoExamNames } },
        ...(academicYearIds.length ? [{ academicYear: { $in: academicYearIds } }] : []),
        ...(classIds.length ? [{ class: { $in: classIds } }] : []),
      ])).select('_id').lean() : [],
    studentIds.length || academicYearIds.length || feeTypeIds.length ? StudentFee.find(orFilter([
        ...(studentIds.length ? [{ student: { $in: studentIds } }] : []),
        ...(academicYearIds.length ? [{ academicYear: { $in: academicYearIds } }] : []),
        ...(feeTypeIds.length ? [{ feeType: { $in: feeTypeIds } }] : []),
      ])).select('_id').lean() : [],
  ]);
  return {
    userIds: ids(users),
    academicYearIds,
    classIds,
    sectionIds: ids(sections),
    subjectIds: ids(subjects),
    teacherIds,
    studentIds,
    guardianIds: ids(guardians),
    enrollmentIds: ids(enrollments),
    assignmentIds: ids(assignments),
    attendanceIds: ids(attendances),
    examIds: ids(exams),
    feeTypeIds,
    studentFeeIds: ids(studentFees),
  };
}

export async function cleanupDemoSeedData() {
  const demo = await findDemoRecords();
  const deleted = {};
  deleted.payments = (await deleteIfAny(Payment, orFilter([
      { referenceNumber: { $in: demoPaymentReferences } },
      ...(demo.studentFeeIds.length ? [{ studentFee: { $in: demo.studentFeeIds } }] : []),
    ]))).deletedCount;
  deleted.marks = (await deleteIfAny(Mark, orFilter([
      ...(demo.examIds.length ? [{ exam: { $in: demo.examIds } }] : []),
      ...(demo.studentIds.length ? [{ student: { $in: demo.studentIds } }] : []),
    ]))).deletedCount;
  deleted.studentFees = (await deleteIfAny(StudentFee, { _id: { $in: demo.studentFeeIds } })).deletedCount;
  deleted.feeTypes = (await deleteIfAny(FeeType, { _id: { $in: demo.feeTypeIds } })).deletedCount;
  deleted.attendance = (await deleteIfAny(Attendance, { _id: { $in: demo.attendanceIds } })).deletedCount;
  deleted.timetableEntries = (await deleteIfAny(TimetableEntry, orFilter([
      ...(demo.academicYearIds.length ? [{ academicYear: { $in: demo.academicYearIds } }] : []),
      ...(demo.teacherIds.length ? [{ teacher: { $in: demo.teacherIds } }] : []),
    ]))).deletedCount;
  deleted.notices = (await deleteIfAny(Notice, orFilter([
      { title: { $in: ['Demo School Assembly', 'Demo Grade 8 Exam Reminder'] } },
      ...(demo.classIds.length ? [{ class: { $in: demo.classIds } }] : []),
    ]))).deletedCount;
  deleted.marksAfterExams = (await deleteIfAny(Mark, { exam: { $in: demo.examIds } })).deletedCount;
  deleted.exams = (await deleteIfAny(Exam, { _id: { $in: demo.examIds } })).deletedCount;
  deleted.teacherAssignments = (await deleteIfAny(TeacherAssignment, { _id: { $in: demo.assignmentIds } })).deletedCount;
  deleted.enrollments = (await deleteIfAny(Enrollment, { _id: { $in: demo.enrollmentIds } })).deletedCount;
  deleted.guardians = (await deleteIfAny(Guardian, { _id: { $in: demo.guardianIds } })).deletedCount;
  deleted.students = (await deleteIfAny(Student, { _id: { $in: demo.studentIds } })).deletedCount;
  deleted.teachers = (await deleteIfAny(Teacher, { _id: { $in: demo.teacherIds } })).deletedCount;
  deleted.subjects = (await deleteIfAny(Subject, { _id: { $in: demo.subjectIds } })).deletedCount;
  deleted.sections = (await deleteIfAny(Section, { _id: { $in: demo.sectionIds } })).deletedCount;
  deleted.classes = (await deleteIfAny(SchoolClass, { _id: { $in: demo.classIds } })).deletedCount;
  deleted.academicYears = (await deleteIfAny(AcademicYear, { _id: { $in: demo.academicYearIds } })).deletedCount;
  deleted.users = (await deleteIfAny(User, { _id: { $in: demo.userIds } })).deletedCount;
  return deleted;
}

async function createDemoUsers() {
  const created = {};
  for (const user of demoSeedUsers) {
    created[user.key] = await User.create({
      name: user.name,
      email: user.email,
      password: demoSeedPassword,
      role: user.role,
      status: 'active',
    });
  }
  return created;
}

export async function seedDemoData({ cleanup = true, environment = process.env } = {}) {
  assertDemoSeedAllowed(environment);
  await ensureDemoIndexes();
  await seedAuthorization();
  const deleted = cleanup ? await cleanupDemoSeedData() : {};

  const users = await createDemoUsers();
  const academicYear = await AcademicYear.create({
    name: demoAcademicYearName,
    startDate: utcDate('2026-01-01'),
    endDate: utcDate('2026-12-31'),
    isCurrent: false,
    status: 'active',
  });
  const [grade8, grade9] = await SchoolClass.create(demoClassNames.map((name) => ({ name, status: 'active' })));
  const [grade8A, grade9A] = await Section.create([
    { name: 'Demo Section A', class: grade8._id, status: 'active' },
    { name: 'Demo Section A', class: grade9._id, status: 'active' },
  ]);
  const [english, math, science] = await Subject.create([
    { name: 'Demo English', code: 'DEMO-ENG', classes: [grade8._id, grade9._id], status: 'active' },
    { name: 'Demo Mathematics', code: 'DEMO-MATH', classes: [grade8._id], status: 'active' },
    { name: 'Demo Science', code: 'DEMO-SCI', classes: [grade8._id, grade9._id], status: 'active' },
  ]);
  const [teacher, secondTeacher] = await Teacher.create([
    {
      teacherId: 'DEMO-T001',
      user: users.teacher._id,
      name: 'Demo Teacher',
      email: 'demo.teacher@example.test',
      phone: '+8801700001001',
      joiningDate: utcDate('2024-01-15'),
      qualification: 'M.Ed, English',
      status: 'active',
    },
    {
      teacherId: 'DEMO-T002',
      name: 'Demo Science Teacher',
      email: 'demo.science.teacher@example.test',
      phone: '+8801700001002',
      joiningDate: utcDate('2023-08-01'),
      qualification: 'M.Sc, Science',
      status: 'active',
    },
  ]);
  const [student, secondStudent, thirdStudent] = await Student.create([
    {
      studentId: 'DEMO-S001',
      user: users.student._id,
      firstName: 'Demo',
      lastName: 'Student',
      dateOfBirth: utcDate('2013-05-12'),
      gender: 'female',
      phone: '+8801800001001',
      address: 'Demo Road, Dhaka',
      admissionDate: utcDate('2026-01-05'),
      class: grade8._id,
      section: grade8A._id,
      status: 'active',
    },
    {
      studentId: 'DEMO-S002',
      firstName: 'Ayan',
      lastName: 'Rahman Demo',
      dateOfBirth: utcDate('2013-09-20'),
      gender: 'male',
      phone: '+8801800001002',
      address: 'Demo Avenue, Dhaka',
      admissionDate: utcDate('2026-01-05'),
      class: grade8._id,
      section: grade8A._id,
      status: 'active',
    },
    {
      studentId: 'DEMO-S003',
      firstName: 'Mira',
      lastName: 'Khan Demo',
      dateOfBirth: utcDate('2012-11-03'),
      gender: 'female',
      phone: '+8801800001003',
      address: 'Demo Lane, Dhaka',
      admissionDate: utcDate('2026-01-05'),
      class: grade9._id,
      section: grade9A._id,
      status: 'active',
    },
  ]);
  await Guardian.create([
    {
      guardianId: 'DEMO-G001',
      user: users.guardian._id,
      name: 'Demo Guardian',
      email: 'demo.guardian@example.test',
      phone: '+8801900001001',
      relationship: 'Parent',
      address: 'Demo Road, Dhaka',
      students: [student._id, secondStudent._id],
      status: 'active',
    },
    {
      guardianId: 'DEMO-G002',
      name: 'Mira Demo Guardian',
      email: 'demo.guardian.two@example.test',
      phone: '+8801900001002',
      relationship: 'Parent',
      address: 'Demo Lane, Dhaka',
      students: [thirdStudent._id],
      status: 'active',
    },
  ]);
  const [enrollment, secondEnrollment, thirdEnrollment] = await Enrollment.create([
    { student: student._id, academicYear: academicYear._id, class: grade8._id, section: grade8A._id, rollNumber: 'D-001', enrollmentDate: utcDate('2026-01-06'), status: 'active' },
    { student: secondStudent._id, academicYear: academicYear._id, class: grade8._id, section: grade8A._id, rollNumber: 'D-002', enrollmentDate: utcDate('2026-01-06'), status: 'active' },
    { student: thirdStudent._id, academicYear: academicYear._id, class: grade9._id, section: grade9A._id, rollNumber: 'D-003', enrollmentDate: utcDate('2026-01-06'), status: 'active' },
  ]);
  await TeacherAssignment.create([
    { teacher: teacher._id, academicYear: academicYear._id, class: grade8._id, section: grade8A._id, subject: english._id, status: 'active' },
    { teacher: teacher._id, academicYear: academicYear._id, class: grade8._id, section: grade8A._id, subject: math._id, status: 'active' },
    { teacher: secondTeacher._id, academicYear: academicYear._id, class: grade9._id, section: grade9A._id, subject: science._id, status: 'active' },
  ]);
  await Attendance.create([
    {
      academicYear: academicYear._id,
      class: grade8._id,
      section: grade8A._id,
      date: utcDate('2026-09-21'),
      recordedBy: users.admin._id,
      records: [
        { student: student._id, enrollment: enrollment._id, status: 'present', note: '' },
        { student: secondStudent._id, enrollment: secondEnrollment._id, status: 'late', note: 'Arrived after assembly.' },
      ],
    },
    {
      academicYear: academicYear._id,
      class: grade8._id,
      section: grade8A._id,
      date: utcDate('2026-09-22'),
      recordedBy: users.admin._id,
      records: [
        { student: student._id, enrollment: enrollment._id, status: 'present', note: '' },
        { student: secondStudent._id, enrollment: secondEnrollment._id, status: 'absent', note: 'Guardian notified.' },
      ],
    },
  ]);
  const exam = await Exam.create({
    academicYear: academicYear._id,
    class: grade8._id,
    name: 'Demo Midterm Exam',
    startDate: utcDate('2026-09-10'),
    endDate: utcDate('2026-09-14'),
    status: 'completed',
    subjects: [
      { subject: english._id, totalMarks: 100, passMarks: 40, examDate: utcDate('2026-09-10') },
      { subject: math._id, totalMarks: 100, passMarks: 40, examDate: utcDate('2026-09-12') },
      { subject: science._id, totalMarks: 100, passMarks: 40, examDate: utcDate('2026-09-14') },
    ],
  });
  await Mark.create([
    { exam: exam._id, subject: english._id, student: student._id, enrollment: enrollment._id, marksObtained: 86, note: 'Strong writing.', recordedBy: users.admin._id },
    { exam: exam._id, subject: math._id, student: student._id, enrollment: enrollment._id, marksObtained: 78, note: '', recordedBy: users.admin._id },
    { exam: exam._id, subject: science._id, student: student._id, enrollment: enrollment._id, marksObtained: 82, note: '', recordedBy: users.admin._id },
    { exam: exam._id, subject: english._id, student: secondStudent._id, enrollment: secondEnrollment._id, marksObtained: 68, note: '', recordedBy: users.admin._id },
    { exam: exam._id, subject: math._id, student: secondStudent._id, enrollment: secondEnrollment._id, marksObtained: 39, note: 'Needs support.', recordedBy: users.admin._id },
    { exam: exam._id, subject: science._id, student: secondStudent._id, enrollment: secondEnrollment._id, marksObtained: 71, note: '', recordedBy: users.admin._id },
  ]);
  const [tuitionFee, examFee] = await FeeType.create([
    { name: 'Demo Tuition Fee', description: 'Monthly demo tuition charge.', defaultAmount: 1500, status: 'active' },
    { name: 'Demo Exam Fee', description: 'Term exam demo charge.', defaultAmount: 800, status: 'active' },
  ]);
  const [studentTuition, studentExamFee, secondStudentTuition] = await StudentFee.create([
    { student: student._id, academicYear: academicYear._id, feeType: tuitionFee._id, amount: 1500, paidAmount: 1500, dueDate: utcDate('2026-09-05'), status: 'paid', note: 'Paid in full.', assignedBy: users.admin._id },
    { student: student._id, academicYear: academicYear._id, feeType: examFee._id, amount: 800, paidAmount: 300, dueDate: utcDate('2026-09-20'), status: 'partial', note: 'Partial demo payment.', assignedBy: users.admin._id },
    { student: secondStudent._id, academicYear: academicYear._id, feeType: tuitionFee._id, amount: 1500, paidAmount: 0, dueDate: utcDate('2026-09-05'), status: 'pending', note: 'Outstanding demo balance.', assignedBy: users.admin._id },
  ]);
  await Payment.create([
    { studentFee: studentTuition._id, amount: 1500, paidAt: utcDate('2026-09-04'), method: 'cash', referenceNumber: 'DEMO-PAY-001', note: 'Full demo tuition payment.', recordedBy: users.admin._id },
    { studentFee: studentExamFee._id, amount: 300, paidAt: utcDate('2026-09-18'), method: 'mobile_banking', referenceNumber: 'DEMO-PAY-002', note: 'Partial demo exam payment.', recordedBy: users.admin._id },
  ]);
  await TimetableEntry.create([
    { academicYear: academicYear._id, class: grade8._id, section: grade8A._id, subject: english._id, teacher: teacher._id, day: 'monday', startTime: '09:00', endTime: '09:45', room: 'Demo Room 101', status: 'active', createdBy: users.admin._id },
    { academicYear: academicYear._id, class: grade8._id, section: grade8A._id, subject: math._id, teacher: teacher._id, day: 'tuesday', startTime: '10:00', endTime: '10:45', room: 'Demo Room 102', status: 'active', createdBy: users.admin._id },
    { academicYear: academicYear._id, class: grade9._id, section: grade9A._id, subject: science._id, teacher: secondTeacher._id, day: 'wednesday', startTime: '11:00', endTime: '11:45', room: 'Demo Lab', status: 'active', createdBy: users.admin._id },
  ]);
  await Notice.create([
    {
      title: 'Demo School Assembly',
      body: 'All demo students should join the morning assembly before first period.',
      audience: 'everyone',
      status: 'published',
      visibleFrom: utcDate('2026-09-01'),
      visibleUntil: utcDate('2026-12-31'),
      createdBy: users.admin._id,
    },
    {
      title: 'Demo Grade 8 Exam Reminder',
      body: 'Grade 8 demo students have midterm exams scheduled this week.',
      audience: 'class',
      class: grade8._id,
      status: 'published',
      visibleFrom: utcDate('2026-09-01'),
      visibleUntil: utcDate('2026-09-30'),
      createdBy: users.admin._id,
    },
  ]);

  return {
    deleted,
    credentials: demoSeedUsers.map(({ name, email, role }) => ({ name, email, role, password: demoSeedPassword })),
    counts: {
      users: demoSeedUsers.length,
      academicYears: 1,
      classes: 2,
      sections: 2,
      subjects: 3,
      teachers: 2,
      students: 3,
      guardians: 2,
      enrollments: 3,
      teacherAssignments: 3,
      attendanceDays: 2,
      exams: 1,
      marks: 6,
      feeTypes: 2,
      studentFees: 3,
      payments: 2,
      timetableEntries: 3,
      notices: 2,
    },
  };
}
