import mongoose from 'mongoose';
import Enrollment from '../models/Enrollment.js';
import AcademicYear from '../models/AcademicYear.js';
import Guardian from '../models/Guardian.js';
import SchoolClass from '../models/SchoolClass.js';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import { hasRole } from './authorization.service.js';

const sortOptions = {
  enrollmentDate: { enrollmentDate: -1 },
  rollNumber: { rollNumber: 1 },
  student: { student: 1 },
  status: { status: 1, enrollmentDate: -1 },
};

export class EnrollmentFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'EnrollmentFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  const field = error.keyPattern?.rollNumber ? 'rollNumber' : 'student';
  const messages = {
    student: 'This student already has an active enrollment for the selected academic year.',
    rollNumber: 'This roll number is already active for the selected year, class and section.',
  };
  throw new EnrollmentFormError(messages[field], { [field]: messages[field] });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function canManageEnrollments(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

async function guardianStudentIds(userId) {
  const guardian = await Guardian.findOne({ user: userId, status: 'active' }).select('students');
  return guardian?.students ?? [];
}

async function listScope(authorization) {
  if (canManageEnrollments(authorization)) return {};
  if (hasRole(authorization, 'teacher')) return { status: 'active' };
  if (hasRole(authorization, 'student')) return { student: { $in: await Student.find({ user: authorization.user.id }).distinct('_id') } };
  if (hasRole(authorization, 'guardian')) return { student: { $in: await guardianStudentIds(authorization.user.id) } };
  return { _id: null };
}

export async function canAccessEnrollment(authorization, enrollment) {
  if (!enrollment) return false;
  if (canManageEnrollments(authorization)) return true;
  if (hasRole(authorization, 'teacher')) return enrollment.status === 'active';
  const studentId = String(enrollment.student?._id ?? enrollment.student ?? '');
  if (hasRole(authorization, 'student')) {
    return await Student.exists({ _id: studentId, user: authorization.user.id });
  }
  if (hasRole(authorization, 'guardian')) {
    return await Guardian.exists({ user: authorization.user.id, status: 'active', students: studentId });
  }
  return false;
}

export function enrollmentListParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 10;
  const sort = Object.hasOwn(sortOptions, query.sort) ? query.sort : 'enrollmentDate';
  return {
    page,
    limit,
    q: typeof query.q === 'string' ? query.q.trim() : '',
    status: ['active', 'inactive', 'completed', 'transferred'].includes(query.status) ? query.status : '',
    academicYear: mongoose.isObjectIdOrHexString(query.academicYear) ? query.academicYear : '',
    class: mongoose.isObjectIdOrHexString(query.class) ? query.class : '',
    section: mongoose.isObjectIdOrHexString(query.section) ? query.section : '',
    sort,
  };
}

export async function listEnrollments(query, authorization) {
  const params = enrollmentListParams(query);
  const filter = await listScope(authorization);
  if (params.status) filter.status = params.status;
  if (params.academicYear) filter.academicYear = params.academicYear;
  if (params.class) filter.class = params.class;
  if (params.section) filter.section = params.section;
  if (params.q) {
    const pattern = new RegExp(escapeRegex(params.q), 'i');
    const studentIds = await Student.find({ $or: [{ studentId: pattern }, { firstName: pattern }, { lastName: pattern }] }).distinct('_id');
    filter.$or = [{ rollNumber: pattern }, { student: { $in: studentIds } }];
  }
  const total = await Enrollment.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const records = await Enrollment.find(filter).populate('student academicYear class section')
    .sort(sortOptions[params.sort]).skip((page - 1) * params.limit).limit(params.limit).lean();
  return { records, filters: { ...params, page }, total, totalPages };
}

export async function listEnrollmentFormOptions() {
  const [students, academicYears, classes, sections] = await Promise.all([
    Student.find({ status: 'active' }).sort({ firstName: 1, lastName: 1 }).lean(),
    AcademicYear.find({ status: 'active' }).sort({ startDate: -1 }).lean(),
    SchoolClass.find({ status: 'active' }).sort({ name: 1 }).lean(),
    Section.find({ status: 'active' }).populate('class').sort({ name: 1 }).lean(),
  ]);
  return { students, academicYears, classes, sections };
}

export async function getEnrollment(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Enrollment.findById(id).populate('student academicYear class section');
}

export async function listClassStudents(classId, query, authorization) {
  if (!mongoose.isObjectIdOrHexString(classId)) return null;
  const schoolClass = await SchoolClass.findById(classId);
  if (!schoolClass) return null;
  const result = await listEnrollments({ ...query, class: classId, status: query.status || 'active', sort: query.sort || 'rollNumber' }, authorization);
  return { schoolClass, ...result };
}

export async function listStudentEnrollmentHistory(studentId, authorization) {
  if (!mongoose.isObjectIdOrHexString(studentId)) return null;
  const student = await Student.findById(studentId);
  if (!student) return null;
  const probe = { student: student._id, status: 'active' };
  if (!await canAccessEnrollment(authorization, probe)) return null;
  const records = await Enrollment.find({ student: student._id }).populate('academicYear class section student').sort({ enrollmentDate: -1 }).lean();
  return { student, records };
}

async function ensureRelationships(data) {
  const [student, academicYear, schoolClass, section] = await Promise.all([
    Student.findById(data.student),
    AcademicYear.findById(data.academicYear),
    SchoolClass.findById(data.class),
    Section.findById(data.section),
  ]);
  const errors = {};
  if (!student || student.status !== 'active') errors.student = 'Choose a valid active student.';
  if (!academicYear || academicYear.status !== 'active') errors.academicYear = 'Choose a valid active academic year.';
  if (!schoolClass || schoolClass.status !== 'active') errors.class = 'Choose a valid active class.';
  if (!section || section.status !== 'active' || String(section.class) !== String(data.class)) {
    errors.section = 'Choose an active section that belongs to the selected class.';
  }
  if (Object.keys(errors).length) throw new EnrollmentFormError('Please check the enrollment relationships.', errors);
}

async function syncStudentPlacement(enrollment) {
  if (enrollment.status !== 'active') return;
  await Student.updateOne({ _id: enrollment.student }, { $set: { class: enrollment.class, section: enrollment.section } }, { runValidators: true });
}

export async function createEnrollment(data) {
  try {
    await ensureRelationships(data);
    const enrollment = await Enrollment.create(data);
    await syncStudentPlacement(enrollment);
    return enrollment;
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateEnrollment(enrollment, data) {
  try {
    await ensureRelationships(data);
    enrollment.set(data);
    const saved = await enrollment.save();
    await syncStudentPlacement(saved);
    return saved;
  } catch (error) {
    duplicateError(error);
  }
}
