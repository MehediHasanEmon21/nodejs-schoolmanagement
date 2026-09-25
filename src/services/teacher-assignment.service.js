import mongoose from 'mongoose';
import AcademicYear from '../models/AcademicYear.js';
import SchoolClass from '../models/SchoolClass.js';
import Section from '../models/Section.js';
import Subject from '../models/Subject.js';
import Teacher from '../models/Teacher.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import { hasRole } from './authorization.service.js';

const sortOptions = {
  recent: { createdAt: -1 },
  teacher: { teacher: 1 },
  subject: { subject: 1 },
  status: { status: 1, createdAt: -1 },
};

export class TeacherAssignmentFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'TeacherAssignmentFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  const message = 'This teacher already has an active assignment for the selected year, class, section and subject.';
  throw new TeacherAssignmentFormError(message, { subject: message });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function canManageTeacherAssignments(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

async function teacherProfileId(userId) {
  const teacher = await Teacher.findOne({ user: userId, status: 'active' }).select('_id');
  return teacher?._id ?? null;
}

async function listScope(authorization) {
  if (canManageTeacherAssignments(authorization)) return {};
  if (hasRole(authorization, 'teacher')) {
    const teacherId = await teacherProfileId(authorization.user.id);
    return teacherId ? { teacher: teacherId, status: 'active' } : { _id: null };
  }
  return { _id: null };
}

export async function canAccessTeacherAssignment(authorization, assignment) {
  if (!assignment) return false;
  if (canManageTeacherAssignments(authorization)) return true;
  if (!hasRole(authorization, 'teacher') || assignment.status !== 'active') return false;
  const teacherId = String(assignment.teacher?._id ?? assignment.teacher ?? '');
  return Boolean(teacherId) && await Teacher.exists({ _id: teacherId, user: authorization.user.id, status: 'active' });
}

export function teacherAssignmentListParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 10;
  const sort = Object.hasOwn(sortOptions, query.sort) ? query.sort : 'recent';
  return {
    page,
    limit,
    q: typeof query.q === 'string' ? query.q.trim() : '',
    status: ['active', 'inactive'].includes(query.status) ? query.status : '',
    academicYear: mongoose.isObjectIdOrHexString(query.academicYear) ? query.academicYear : '',
    class: mongoose.isObjectIdOrHexString(query.class) ? query.class : '',
    section: mongoose.isObjectIdOrHexString(query.section) ? query.section : '',
    teacher: mongoose.isObjectIdOrHexString(query.teacher) ? query.teacher : '',
    subject: mongoose.isObjectIdOrHexString(query.subject) ? query.subject : '',
    sort,
  };
}

export async function listTeacherAssignments(query, authorization) {
  const params = teacherAssignmentListParams(query);
  const filter = await listScope(authorization);
  if (params.status) filter.status = params.status;
  if (params.academicYear) filter.academicYear = params.academicYear;
  if (params.class) filter.class = params.class;
  if (params.section) filter.section = params.section;
  if (params.teacher) filter.teacher = params.teacher;
  if (params.subject) filter.subject = params.subject;
  if (params.q) {
    const pattern = new RegExp(escapeRegex(params.q), 'i');
    const [teacherIds, subjectIds] = await Promise.all([
      Teacher.find({ $or: [{ name: pattern }, { teacherId: pattern }, { email: pattern }] }).distinct('_id'),
      Subject.find({ $or: [{ name: pattern }, { code: pattern }] }).distinct('_id'),
    ]);
    filter.$or = [{ teacher: { $in: teacherIds } }, { subject: { $in: subjectIds } }];
  }
  const total = await TeacherAssignment.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const records = await TeacherAssignment.find(filter).populate('teacher academicYear class section subject')
    .sort(sortOptions[params.sort]).skip((page - 1) * params.limit).limit(params.limit).lean();
  return { records, filters: { ...params, page }, total, totalPages };
}

export async function listTeacherAssignmentFormOptions() {
  const [teachers, academicYears, classes, sections, subjects] = await Promise.all([
    Teacher.find({ status: 'active' }).sort({ name: 1 }).lean(),
    AcademicYear.find({ status: 'active' }).sort({ startDate: -1 }).lean(),
    SchoolClass.find({ status: 'active' }).sort({ name: 1 }).lean(),
    Section.find({ status: 'active' }).populate('class').sort({ name: 1 }).lean(),
    Subject.find({ status: 'active' }).populate('classes').sort({ name: 1 }).lean(),
  ]);
  return { teachers, academicYears, classes, sections, subjects };
}

export async function getTeacherAssignment(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return TeacherAssignment.findById(id).populate('teacher academicYear class section subject');
}

export async function listClassSubjectTeachers(classId, query, authorization) {
  if (!mongoose.isObjectIdOrHexString(classId)) return null;
  const schoolClass = await SchoolClass.findById(classId);
  if (!schoolClass) return null;
  const result = await listTeacherAssignments({ ...query, class: classId, status: query.status || 'active', sort: query.sort || 'subject' }, authorization);
  return { schoolClass, ...result };
}

export async function listTeacherAssignmentHistory(teacherId, query, authorization) {
  if (!mongoose.isObjectIdOrHexString(teacherId)) return null;
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) return null;
  const probe = { teacher: teacher._id, status: 'active' };
  if (!await canAccessTeacherAssignment(authorization, probe)) return null;
  const result = await listTeacherAssignments({ ...query, teacher: teacherId, sort: query.sort || 'recent' }, authorization);
  return { teacher, ...result };
}

async function ensureRelationships(data) {
  const [teacher, academicYear, schoolClass, section, subject] = await Promise.all([
    Teacher.findById(data.teacher),
    AcademicYear.findById(data.academicYear),
    SchoolClass.findById(data.class),
    Section.findById(data.section),
    Subject.findById(data.subject),
  ]);
  const errors = {};
  if (!teacher || teacher.status !== 'active') errors.teacher = 'Choose a valid active teacher.';
  if (!academicYear || academicYear.status !== 'active') errors.academicYear = 'Choose a valid active academic year.';
  if (!schoolClass || schoolClass.status !== 'active') errors.class = 'Choose a valid active class.';
  if (!section || section.status !== 'active' || String(section.class) !== String(data.class)) {
    errors.section = 'Choose an active section that belongs to the selected class.';
  }
  if (!subject || subject.status !== 'active') {
    errors.subject = 'Choose a valid active subject.';
  } else if (!subject.classes.map(String).includes(String(data.class))) {
    errors.subject = 'Choose a subject assigned to the selected class.';
  }
  if (Object.keys(errors).length) throw new TeacherAssignmentFormError('Please check the assignment relationships.', errors);
}

export async function createTeacherAssignment(data) {
  try {
    await ensureRelationships(data);
    return await TeacherAssignment.create(data);
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateTeacherAssignment(assignment, data) {
  try {
    await ensureRelationships(data);
    assignment.set(data);
    return await assignment.save();
  } catch (error) {
    duplicateError(error);
  }
}
