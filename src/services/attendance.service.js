import mongoose from 'mongoose';
import Attendance from '../models/Attendance.js';
import AcademicYear from '../models/AcademicYear.js';
import Enrollment from '../models/Enrollment.js';
import Guardian from '../models/Guardian.js';
import SchoolClass from '../models/SchoolClass.js';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import { hasRole } from './authorization.service.js';

const sortOptions = {
  date: { date: -1 },
  class: { class: 1, section: 1, date: -1 },
};

export class AttendanceFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'AttendanceFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  const message = 'Attendance has already been recorded for this year, class, section and date.';
  throw new AttendanceFormError(message, { date: message });
}

function dateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function canManageAttendance(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

async function teacherProfileId(userId) {
  const teacher = await Teacher.findOne({ user: userId, status: 'active' }).select('_id');
  return teacher?._id ?? null;
}

async function teacherAssignmentFilter(authorization) {
  const teacherId = await teacherProfileId(authorization.user.id);
  if (!teacherId) return { _id: null };
  const assignments = await TeacherAssignment.find({ teacher: teacherId, status: 'active' }).select('academicYear class section').lean();
  if (!assignments.length) return { _id: null };
  return { $or: assignments.map((assignment) => ({
    academicYear: assignment.academicYear,
    class: assignment.class,
    section: assignment.section,
  })) };
}

async function guardianStudentIds(userId) {
  const guardian = await Guardian.findOne({ user: userId, status: 'active' }).select('students');
  return guardian?.students ?? [];
}

async function listScope(authorization) {
  if (canManageAttendance(authorization)) return {};
  if (hasRole(authorization, 'teacher')) return teacherAssignmentFilter(authorization);
  if (hasRole(authorization, 'student')) return { 'records.student': { $in: await Student.find({ user: authorization.user.id }).distinct('_id') } };
  if (hasRole(authorization, 'guardian')) return { 'records.student': { $in: await guardianStudentIds(authorization.user.id) } };
  return { _id: null };
}

export async function canAccessAttendance(authorization, attendance) {
  if (!attendance) return false;
  if (canManageAttendance(authorization)) return true;
  if (hasRole(authorization, 'teacher')) return canRecordAttendance(authorization, attendance);
  const studentIds = (attendance.records ?? []).map((record) => String(record.student?._id ?? record.student ?? ''));
  if (hasRole(authorization, 'student')) {
    return await Student.exists({ _id: { $in: studentIds }, user: authorization.user.id });
  }
  if (hasRole(authorization, 'guardian')) {
    return await Guardian.exists({ user: authorization.user.id, status: 'active', students: { $in: studentIds } });
  }
  return false;
}

export async function canRecordAttendance(authorization, data) {
  if (canManageAttendance(authorization)) return true;
  if (!hasRole(authorization, 'teacher')) return false;
  const teacherId = await teacherProfileId(authorization.user.id);
  if (!teacherId) return false;
  return Boolean(await TeacherAssignment.exists({
    teacher: teacherId,
    academicYear: data.academicYear?._id ?? data.academicYear,
    class: data.class?._id ?? data.class,
    section: data.section?._id ?? data.section,
    status: 'active',
  }));
}

export function attendanceListParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 10;
  const sort = Object.hasOwn(sortOptions, query.sort) ? query.sort : 'date';
  return {
    page,
    limit,
    academicYear: mongoose.isObjectIdOrHexString(query.academicYear) ? query.academicYear : '',
    class: mongoose.isObjectIdOrHexString(query.class) ? query.class : '',
    section: mongoose.isObjectIdOrHexString(query.section) ? query.section : '',
    date: typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : '',
    sort,
  };
}

export async function listAttendance(query, authorization) {
  const params = attendanceListParams(query);
  const filter = await listScope(authorization);
  if (params.academicYear) filter.academicYear = params.academicYear;
  if (params.class) filter.class = params.class;
  if (params.section) filter.section = params.section;
  if (params.date) filter.date = new Date(`${params.date}T00:00:00.000Z`);
  const total = await Attendance.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const records = await Attendance.find(filter).populate('academicYear class section recordedBy')
    .sort(sortOptions[params.sort]).skip((page - 1) * params.limit).limit(params.limit).lean();
  return { records, filters: { ...params, page }, total, totalPages };
}

export async function listAttendanceFormOptions() {
  const [academicYears, classes, sections] = await Promise.all([
    AcademicYear.find({ status: 'active' }).sort({ startDate: -1 }).lean(),
    SchoolClass.find({ status: 'active' }).sort({ name: 1 }).lean(),
    Section.find({ status: 'active' }).populate('class').sort({ name: 1 }).lean(),
  ]);
  return { academicYears, classes, sections };
}

export async function getAttendance(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Attendance.findById(id).populate('academicYear class section recordedBy updatedBy records.student records.enrollment');
}

async function ensureRelationships(data) {
  const [academicYear, schoolClass, section] = await Promise.all([
    AcademicYear.findById(data.academicYear),
    SchoolClass.findById(data.class),
    Section.findById(data.section),
  ]);
  const errors = {};
  if (!academicYear || academicYear.status !== 'active') errors.academicYear = 'Choose a valid active academic year.';
  if (!schoolClass || schoolClass.status !== 'active') errors.class = 'Choose a valid active class.';
  if (!section || section.status !== 'active' || String(section.class) !== String(data.class)) {
    errors.section = 'Choose an active section that belongs to the selected class.';
  }
  if (!dateOnly(data.date)) errors.date = 'Choose a valid attendance date.';
  if (Object.keys(errors).length) throw new AttendanceFormError('Please check the attendance details.', errors);
}

export async function loadAttendanceRoster(data, authorization) {
  await ensureRelationships(data);
  if (!await canRecordAttendance(authorization, data)) return null;
  const enrollments = await Enrollment.find({
    academicYear: data.academicYear,
    class: data.class,
    section: data.section,
    status: 'active',
  }).populate('student').sort({ rollNumber: 1 }).lean();
  return enrollments.filter((enrollment) => enrollment.student?.status === 'active');
}

function buildRecords(roster, values = {}) {
  return roster.map((enrollment) => {
    const studentId = String(enrollment.student._id);
    const value = values[studentId] ?? {};
    return {
      student: enrollment.student._id,
      enrollment: enrollment._id,
      status: ['present', 'absent', 'late', 'excused'].includes(value.status) ? value.status : 'present',
      note: typeof value.note === 'string' ? value.note.trim().slice(0, 200) : '',
    };
  });
}

export async function createAttendance(data, authorization) {
  try {
    const roster = await loadAttendanceRoster(data, authorization);
    if (!roster) throw Object.assign(new Error('Access denied'), { status: 403 });
    const attendance = await Attendance.create({
      academicYear: data.academicYear,
      class: data.class,
      section: data.section,
      date: dateOnly(data.date),
      records: buildRecords(roster, data.records),
      recordedBy: authorization.user.id,
    });
    return attendance;
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateAttendance(attendance, data, authorization) {
  try {
    await ensureRelationships(data);
    if (!await canRecordAttendance(authorization, attendance)) throw Object.assign(new Error('Access denied'), { status: 403 });
    const roster = await loadAttendanceRoster({
      academicYear: attendance.academicYear._id ?? attendance.academicYear,
      class: attendance.class._id ?? attendance.class,
      section: attendance.section._id ?? attendance.section,
      date: attendance.date,
    }, authorization);
    if (!roster) throw Object.assign(new Error('Access denied'), { status: 403 });
    attendance.set({ records: buildRecords(roster, data.records), updatedBy: authorization.user.id });
    return await attendance.save();
  } catch (error) {
    duplicateError(error);
  }
}

export async function listStudentAttendanceHistory(studentId, authorization) {
  if (!mongoose.isObjectIdOrHexString(studentId)) return null;
  const student = await Student.findById(studentId);
  if (!student) return null;
  const probe = { records: [{ student: student._id }] };
  if (!await canAccessAttendance(authorization, probe)) return null;
  const records = await Attendance.find({ 'records.student': student._id }).populate('academicYear class section records.student')
    .sort({ date: -1 }).lean();
  return { student, records: records.map((attendance) => ({
    ...attendance,
    record: attendance.records.find((record) => String(record.student._id ?? record.student) === String(student._id)),
  })) };
}

export async function classAttendanceSummary(classId, query, authorization) {
  if (!mongoose.isObjectIdOrHexString(classId)) return null;
  const schoolClass = await SchoolClass.findById(classId);
  if (!schoolClass) return null;
  const result = await listAttendance({ ...query, class: classId, sort: 'date' }, authorization);
  const totals = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const attendance of result.records) {
    for (const record of attendance.records ?? []) totals[record.status] += 1;
  }
  return { schoolClass, ...result, totals };
}
