import mongoose from 'mongoose';
import Guardian from '../models/Guardian.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import { hasRole } from './authorization.service.js';

const sortOptions = {
  guardianId: { guardianId: 1 },
  name: { name: 1 },
  relationship: { relationship: 1, name: 1 },
  status: { status: 1, name: 1 },
};

export class GuardianFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'GuardianFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  const field = error.keyPattern?.user ? 'user' : error.keyPattern?.email ? 'email' : 'guardianId';
  const messages = {
    user: 'This user account is already linked to a guardian.',
    email: 'A guardian with this email already exists.',
    guardianId: 'A guardian with this ID already exists.',
  };
  throw new GuardianFormError(messages[field], { [field]: messages[field] });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listScope(authorization) {
  if (hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin')) return {};
  if (hasRole(authorization, 'guardian')) return { user: authorization.user._id ?? authorization.user.id };
  return { _id: null };
}

export function canManageGuardians(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

export function canAccessGuardian(authorization, guardian) {
  if (!guardian) return false;
  if (canManageGuardians(authorization)) return true;
  if (hasRole(authorization, 'guardian')) return String(guardian.user?._id ?? guardian.user ?? '') === String(authorization.user.id);
  return false;
}

export function guardianListParams(query = {}) {
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

export async function listGuardians(query, authorization) {
  const params = guardianListParams(query);
  const filter = { ...listScope(authorization) };
  if (params.status) filter.status = params.status;
  if (params.q) {
    const pattern = new RegExp(escapeRegex(params.q), 'i');
    filter.$or = [{ guardianId: pattern }, { name: pattern }, { email: pattern }, { phone: pattern }, { relationship: pattern }];
  }
  const total = await Guardian.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const records = await Guardian.find(filter).populate('user students')
    .sort(sortOptions[params.sort]).skip((page - 1) * params.limit).limit(params.limit).lean();
  return { records, filters: { ...params, page }, total, totalPages };
}

export async function listGuardianFormOptions() {
  const [users, students] = await Promise.all([
    User.find({ role: 'guardian', status: 'active' }).sort({ name: 1 }).lean(),
    Student.find({ status: 'active' }).sort({ firstName: 1, lastName: 1 }).lean(),
  ]);
  return { users, students };
}

export async function getGuardian(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Guardian.findById(id).populate('user students');
}

async function ensureRelationships(data) {
  if (data.user) {
    const user = await User.findOne({ _id: data.user, role: 'guardian', status: 'active' });
    if (!user) throw new GuardianFormError('Choose a valid active guardian user account.', { user: 'Choose a valid active guardian user account.' });
  }
  const students = await Student.find({ _id: { $in: data.students }, status: 'active' }).select('_id');
  if (students.length !== data.students.length) throw new GuardianFormError('Choose valid active linked students.', { students: 'Choose valid active linked students.' });
}

export async function createGuardian(data) {
  try {
    await ensureRelationships(data);
    return await Guardian.create(data);
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateGuardian(guardian, data) {
  try {
    await ensureRelationships(data);
    guardian.set(data);
    return await guardian.save();
  } catch (error) {
    duplicateError(error);
  }
}

export async function setGuardianStatus(guardian, status) {
  if (!['active', 'inactive'].includes(status)) throw new GuardianFormError('Choose a valid status.', { status: 'Choose a valid status.' });
  guardian.status = status;
  return guardian.save();
}
