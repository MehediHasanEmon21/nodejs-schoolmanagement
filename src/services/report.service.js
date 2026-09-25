import AcademicYear from '../models/AcademicYear.js';
import Attendance from '../models/Attendance.js';
import Enrollment from '../models/Enrollment.js';
import Exam from '../models/Exam.js';
import FeeType from '../models/FeeType.js';
import Mark from '../models/Mark.js';
import SchoolClass from '../models/SchoolClass.js';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import StudentFee from '../models/StudentFee.js';
import { hasRole } from './authorization.service.js';
import { calculateResult, calculateSubjectResult } from './result.service.js';
import { dateRange, reportFilters } from '../validators/report.validator.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function canViewReports(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

export async function reportOptions() {
  const [academicYears, classes, sections, exams, feeTypes] = await Promise.all([
    AcademicYear.find({}).select('name startDate status').sort({ startDate: -1 }).lean(),
    SchoolClass.find({}).select('name status').sort({ name: 1 }).lean(),
    Section.find({}).select('name class status').populate('class', 'name').sort({ name: 1 }).lean(),
    Exam.find({}).select('name academicYear class startDate status').populate('academicYear', 'name').populate('class', 'name').sort({ startDate: -1 }).limit(200).lean(),
    FeeType.find({}).select('name status').sort({ name: 1 }).lean(),
  ]);
  return { academicYears, classes, sections, exams, feeTypes };
}

async function pickReportOptions(keys) {
  const options = {};
  await Promise.all(keys.map(async (key) => {
    if (key === 'academicYears') options.academicYears = await AcademicYear.find({}).select('name startDate status').sort({ startDate: -1 }).lean();
    if (key === 'classes') options.classes = await SchoolClass.find({}).select('name status').sort({ name: 1 }).lean();
    if (key === 'sections') options.sections = await Section.find({}).select('name class status').populate('class', 'name').sort({ name: 1 }).lean();
    if (key === 'exams') options.exams = await Exam.find({}).select('name academicYear class startDate status').populate('academicYear', 'name').populate('class', 'name').sort({ startDate: -1 }).limit(200).lean();
    if (key === 'feeTypes') options.feeTypes = await FeeType.find({}).select('name status').sort({ name: 1 }).lean();
  }));
  return options;
}

export async function studentReport(query = {}) {
  const filters = reportFilters(query);
  const filter = {};
  if (['active', 'inactive'].includes(filters.status)) filter.status = filters.status;
  if (filters.class) filter.class = filters.class;
  if (filters.section) filter.section = filters.section;
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), 'i');
    filter.$or = [{ firstName: pattern }, { lastName: pattern }, { studentId: pattern }, { phone: pattern }];
  }
  const records = await Student.find(filter).select('studentId firstName lastName class section status')
    .populate('class', 'name').populate('section', 'name').sort({ firstName: 1, lastName: 1 }).limit(500).lean();
  const totals = records.reduce((carry, student) => {
    carry.total += 1;
    carry[student.status] = (carry[student.status] ?? 0) + 1;
    return carry;
  }, { total: 0, active: 0, inactive: 0 });
  return { filters, records, totals, reportOptions: await pickReportOptions(['classes', 'sections']) };
}

export async function attendanceReport(query = {}) {
  const filters = reportFilters(query);
  const filter = {};
  if (filters.academicYear) filter.academicYear = filters.academicYear;
  if (filters.class) filter.class = filters.class;
  if (filters.section) filter.section = filters.section;
  const range = dateRange(filters);
  if (Object.keys(range).length) filter.date = range;
  const records = await Attendance.find(filter).select('academicYear class section date records.status')
    .populate('academicYear', 'name').populate('class', 'name').populate('section', 'name')
    .sort({ date: -1, class: 1, section: 1 }).limit(300).lean();
  const totals = { days: records.length, present: 0, absent: 0, late: 0, excused: 0 };
  for (const attendance of records) {
    for (const record of attendance.records ?? []) totals[record.status] += 1;
  }
  return { filters, records, totals, reportOptions: await pickReportOptions(['academicYears', 'classes', 'sections']) };
}

export async function resultReport(query = {}) {
  const filters = reportFilters(query);
  const exam = filters.exam ? await Exam.findById(filters.exam).populate('academicYear class subjects.subject').lean() : null;
  if (!exam) return { filters, exam: null, rows: [], totals: { students: 0, passed: 0, failed: 0 }, reportOptions: await reportOptions() };
  const enrollmentFilter = { academicYear: exam.academicYear._id, class: exam.class._id, status: 'active' };
  if (filters.section) enrollmentFilter.section = filters.section;
  const enrollments = await Enrollment.find(enrollmentFilter).select('student section rollNumber')
    .populate('student', 'firstName lastName status').populate('section', 'name').sort({ section: 1, rollNumber: 1 }).lean();
  const marks = await Mark.find({ exam: exam._id }).select('subject student marksObtained').lean();
  const byStudent = new Map();
  for (const mark of marks) {
    const key = String(mark.student);
    if (!byStudent.has(key)) byStudent.set(key, new Map());
    byStudent.get(key).set(String(mark.subject), mark);
  }
  const rows = enrollments.filter((enrollment) => enrollment.student?.status === 'active').map((enrollment) => {
    const subjectMarks = exam.subjects.map((config) => {
      const mark = byStudent.get(String(enrollment.student._id))?.get(String(config.subject._id));
      return { subject: config.subject, mark, result: calculateSubjectResult(mark, config) };
    });
    return { enrollment, summary: calculateResult(subjectMarks) };
  });
  const totals = rows.reduce((carry, row) => {
    carry.students += 1;
    carry[row.summary.passed ? 'passed' : 'failed'] += 1;
    return carry;
  }, { students: 0, passed: 0, failed: 0 });
  return { filters, exam, rows, totals, reportOptions: await pickReportOptions(['exams', 'sections']) };
}

export async function feeReport(query = {}) {
  const filters = reportFilters(query);
  const filter = {};
  if (filters.academicYear) filter.academicYear = filters.academicYear;
  if (filters.feeType) filter.feeType = filters.feeType;
  if (['pending', 'partial', 'paid', 'waived', 'cancelled'].includes(filters.status)) filter.status = filters.status;
  const records = await StudentFee.find(filter).select('student academicYear feeType amount paidAmount dueDate status')
    .populate('student', 'firstName lastName studentId').populate('academicYear', 'name').populate('feeType', 'name')
    .sort({ dueDate: 1, status: 1 }).limit(500).lean();
  const rows = records.map((record) => ({
    ...record,
    outstanding: Math.max(0, Number(record.amount ?? 0) - Number(record.paidAmount ?? 0)),
  }));
  const totals = rows.reduce((carry, row) => {
    carry.amount += Number(row.amount ?? 0);
    carry.paid += Number(row.paidAmount ?? 0);
    carry.outstanding += row.outstanding;
    return carry;
  }, { records: rows.length, amount: 0, paid: 0, outstanding: 0 });
  return { filters, records: rows, totals, reportOptions: await pickReportOptions(['academicYears', 'feeTypes']) };
}
