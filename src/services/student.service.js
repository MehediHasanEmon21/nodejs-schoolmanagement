import mongoose from 'mongoose';
import Student from '../models/Student.js';
import User from '../models/User.js';
import SchoolClass from '../models/SchoolClass.js';
import Section from '../models/Section.js';
import { hasRole } from './authorization.service.js';

const sortOptions = {
  studentId: { studentId: 1 },
  name: { firstName: 1, lastName: 1 },
  admissionDate: { admissionDate: -1 },
  status: { status: 1, firstName: 1 },
};

export class StudentFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'StudentFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  const field = error.keyPattern?.user ? 'user' : 'studentId';
  const messages = {
    user: 'This user account is already linked to a student.',
    studentId: 'A student with this ID already exists.',
  };
  throw new StudentFormError(messages[field], { [field]: messages[field] });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listScope(authorization) {
  if (hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin')) return {};
  if (hasRole(authorization, 'teacher')) return { status: 'active' };
  if (hasRole(authorization, 'student')) return { user: authorization.user._id ?? authorization.user.id };
  // Guardian links arrive in the guardian module.
  return { _id: null };
}

export function canManageStudents(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

export function canAccessStudent(authorization, student) {
  if (!student) return false;
  if (canManageStudents(authorization)) return true;
  if (hasRole(authorization, 'teacher')) return student.status === 'active';
  if (hasRole(authorization, 'student')) return String(student.user?._id ?? student.user ?? '') === String(authorization.user.id);
  return false;
}

export function studentListParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 10;
  const sort = Object.hasOwn(sortOptions, query.sort) ? query.sort : 'name';
  return {
    page,
    limit,
    q: typeof query.q === 'string' ? query.q.trim() : '',
    status: ['active', 'inactive'].includes(query.status) ? query.status : '',
    class: mongoose.isObjectIdOrHexString(query.class) ? query.class : '',
    section: mongoose.isObjectIdOrHexString(query.section) ? query.section : '',
    sort,
  };
}

export async function listStudents(query, authorization) {
  const params = studentListParams(query);
  const filter = { ...listScope(authorization) };
  if (params.status) filter.status = params.status;
  if (params.class) filter.class = params.class;
  if (params.section) filter.section = params.section;
  if (params.q) {
    const pattern = new RegExp(escapeRegex(params.q), 'i');
    filter.$or = [{ studentId: pattern }, { firstName: pattern }, { lastName: pattern }, { phone: pattern }];
  }
  const total = await Student.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const records = await Student.find(filter).populate('class section user')
    .sort(sortOptions[params.sort]).skip((page - 1) * params.limit).limit(params.limit).lean();
  return { records, filters: { ...params, page }, total, totalPages };
}

export async function listStudentFormOptions() {
  const [classes, sections, users] = await Promise.all([
    SchoolClass.find({ status: 'active' }).sort({ name: 1 }).lean(),
    Section.find({ status: 'active' }).populate('class').sort({ name: 1 }).lean(),
    User.find({ role: 'student', status: 'active' }).sort({ name: 1 }).lean(),
  ]);
  return { classes, sections, users };
}

export async function getStudent(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Student.findById(id).populate('class section user');
}

async function ensureRelationships(data) {
  if (data.user) {
    const user = await User.findOne({ _id: data.user, role: 'student', status: 'active' });
    if (!user) throw new StudentFormError('Choose a valid active student user account.', { user: 'Choose a valid active student user account.' });
  }
  if (data.class) {
    const schoolClass = await SchoolClass.findById(data.class);
    if (!schoolClass) throw new StudentFormError('Choose a valid class.', { class: 'Choose a valid class.' });
  }
  if (data.section) {
    const section = await Section.findById(data.section);
    if (!section || String(section.class) !== String(data.class)) {
      throw new StudentFormError('Choose a section that belongs to the selected class.', { section: 'Choose a section that belongs to the selected class.' });
    }
  }
}

export async function createStudent(data) {
  try {
    await ensureRelationships(data);
    return await Student.create(data);
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateStudent(student, data) {
  try {
    await ensureRelationships(data);
    student.set(data);
    return await student.save();
  } catch (error) {
    duplicateError(error);
  }
}

export async function setStudentStatus(student, status) {
  if (!['active', 'inactive'].includes(status)) throw new StudentFormError('Choose a valid status.', { status: 'Choose a valid status.' });
  student.status = status;
  return student.save();
}
