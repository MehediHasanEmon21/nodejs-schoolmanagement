import mongoose from 'mongoose';
import Teacher from '../models/Teacher.js';
import User from '../models/User.js';
import { hasRole } from './authorization.service.js';

const sortOptions = {
  teacherId: { teacherId: 1 },
  name: { name: 1 },
  joiningDate: { joiningDate: -1 },
  status: { status: 1, name: 1 },
};

export class TeacherFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'TeacherFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  const field = error.keyPattern?.user ? 'user' : error.keyPattern?.email ? 'email' : 'teacherId';
  const messages = {
    user: 'This user account is already linked to a teacher.',
    email: 'A teacher with this email already exists.',
    teacherId: 'A teacher with this ID already exists.',
  };
  throw new TeacherFormError(messages[field], { [field]: messages[field] });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listScope(authorization) {
  if (hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin')) return {};
  if (hasRole(authorization, 'teacher')) return { status: 'active' };
  return { _id: null };
}

export function canManageTeachers(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

export function canAccessTeacher(authorization, teacher) {
  if (!teacher) return false;
  if (canManageTeachers(authorization)) return true;
  if (hasRole(authorization, 'teacher')) {
    return teacher.status === 'active' || String(teacher.user?._id ?? teacher.user ?? '') === String(authorization.user.id);
  }
  return false;
}

export function teacherListParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 10;
  const sort = Object.hasOwn(sortOptions, query.sort) ? query.sort : 'name';
  return {
    page,
    limit,
    q: typeof query.q === 'string' ? query.q.trim() : '',
    status: ['active', 'inactive'].includes(query.status) ? query.status : '',
    sort,
  };
}

export async function listTeachers(query, authorization) {
  const params = teacherListParams(query);
  const filter = { ...listScope(authorization) };
  if (params.status) filter.status = params.status;
  if (params.q) {
    const pattern = new RegExp(escapeRegex(params.q), 'i');
    filter.$or = [{ teacherId: pattern }, { name: pattern }, { email: pattern }, { phone: pattern }, { qualification: pattern }];
  }
  const total = await Teacher.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const records = await Teacher.find(filter).populate('user')
    .sort(sortOptions[params.sort]).skip((page - 1) * params.limit).limit(params.limit).lean();
  return { records, filters: { ...params, page }, total, totalPages };
}

export async function listTeacherFormOptions() {
  const users = await User.find({ role: 'teacher', status: 'active' }).sort({ name: 1 }).lean();
  return { users };
}

export async function getTeacher(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Teacher.findById(id).populate('user');
}

async function ensureRelationships(data) {
  if (!data.user) return;
  const user = await User.findOne({ _id: data.user, role: 'teacher', status: 'active' });
  if (!user) throw new TeacherFormError('Choose a valid active teacher user account.', { user: 'Choose a valid active teacher user account.' });
}

export async function createTeacher(data) {
  try {
    await ensureRelationships(data);
    return await Teacher.create(data);
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateTeacher(teacher, data) {
  try {
    await ensureRelationships(data);
    teacher.set(data);
    return await teacher.save();
  } catch (error) {
    duplicateError(error);
  }
}

export async function setTeacherStatus(teacher, status) {
  if (!['active', 'inactive'].includes(status)) throw new TeacherFormError('Choose a valid status.', { status: 'Choose a valid status.' });
  teacher.status = status;
  return teacher.save();
}
