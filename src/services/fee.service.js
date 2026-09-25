import mongoose from 'mongoose';
import AcademicYear from '../models/AcademicYear.js';
import FeeType from '../models/FeeType.js';
import Guardian from '../models/Guardian.js';
import Student from '../models/Student.js';
import StudentFee from '../models/StudentFee.js';
import { hasRole } from './authorization.service.js';

const sortOptions = {
  dueDate: { dueDate: 1 },
  amount: { amount: -1 },
  status: { status: 1, dueDate: 1 },
};

export class FeeFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'FeeFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  const message = 'This fee has already been assigned to the student for the selected year and due date.';
  throw new FeeFormError(message, { feeType: message });
}

export function canManageFees(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

async function guardianStudentIds(userId) {
  const guardian = await Guardian.findOne({ user: userId, status: 'active' }).select('students');
  return guardian?.students ?? [];
}

async function listScope(authorization) {
  if (canManageFees(authorization)) return {};
  if (hasRole(authorization, 'student')) return { student: { $in: await Student.find({ user: authorization.user.id }).distinct('_id') } };
  if (hasRole(authorization, 'guardian')) return { student: { $in: await guardianStudentIds(authorization.user.id) } };
  return { _id: null };
}

export function feeSummary(record) {
  const amount = Number(record.amount ?? 0);
  const paidAmount = Number(record.paidAmount ?? 0);
  const outstanding = Math.max(0, amount - paidAmount);
  const overdue = outstanding > 0 && record.dueDate instanceof Date && record.dueDate < new Date(new Date().toISOString().slice(0, 10));
  return { amount, paidAmount, outstanding, overdue };
}

export function feeListParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 10;
  const sort = Object.hasOwn(sortOptions, query.sort) ? query.sort : 'dueDate';
  return {
    page,
    limit,
    status: ['pending', 'partial', 'paid', 'waived', 'cancelled'].includes(query.status) ? query.status : '',
    academicYear: mongoose.isObjectIdOrHexString(query.academicYear) ? query.academicYear : '',
    feeType: mongoose.isObjectIdOrHexString(query.feeType) ? query.feeType : '',
    student: mongoose.isObjectIdOrHexString(query.student) ? query.student : '',
    sort,
  };
}

export async function listStudentFees(query, authorization) {
  const params = feeListParams(query);
  const filter = await listScope(authorization);
  if (params.status) filter.status = params.status;
  if (params.academicYear) filter.academicYear = params.academicYear;
  if (params.feeType) filter.feeType = params.feeType;
  if (params.student && canManageFees(authorization)) filter.student = params.student;
  const total = await StudentFee.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const records = await StudentFee.find(filter).populate('student academicYear feeType')
    .sort(sortOptions[params.sort]).skip((page - 1) * params.limit).limit(params.limit).lean();
  return { records: records.map((record) => ({ ...record, summary: feeSummary(record) })), filters: { ...params, page }, total, totalPages };
}

export async function listFeeTypes() {
  return FeeType.find({}).sort({ name: 1 }).lean();
}

export async function listFeeFormOptions() {
  const [students, academicYears, feeTypes] = await Promise.all([
    Student.find({ status: 'active' }).sort({ firstName: 1, lastName: 1 }).lean(),
    AcademicYear.find({ status: 'active' }).sort({ startDate: -1 }).lean(),
    FeeType.find({ status: 'active' }).sort({ name: 1 }).lean(),
  ]);
  return { students, academicYears, feeTypes };
}

export async function getFeeType(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return FeeType.findById(id);
}

export async function getStudentFee(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return StudentFee.findById(id).populate('student academicYear feeType assignedBy updatedBy');
}

export async function canAccessStudentFee(authorization, fee) {
  if (!fee) return false;
  if (canManageFees(authorization)) return true;
  const studentId = String(fee.student?._id ?? fee.student ?? '');
  if (hasRole(authorization, 'student')) return Boolean(await Student.exists({ _id: studentId, user: authorization.user.id }));
  if (hasRole(authorization, 'guardian')) return Boolean(await Guardian.exists({ user: authorization.user.id, status: 'active', students: studentId }));
  return false;
}

async function ensureStudentFeeRelationships(data) {
  const [student, academicYear, feeType] = await Promise.all([
    Student.findById(data.student),
    AcademicYear.findById(data.academicYear),
    FeeType.findById(data.feeType),
  ]);
  const errors = {};
  if (!student || student.status !== 'active') errors.student = 'Choose a valid active student.';
  if (!academicYear || academicYear.status !== 'active') errors.academicYear = 'Choose a valid active academic year.';
  if (!feeType || feeType.status !== 'active') errors.feeType = 'Choose a valid active fee type.';
  if (Object.keys(errors).length) throw new FeeFormError('Please check the fee relationships.', errors);
}

export async function createFeeType(data) {
  try {
    return await FeeType.create(data);
  } catch (error) {
    if (error?.code === 11000) throw new FeeFormError('A fee type with this name already exists.', { name: 'A fee type with this name already exists.' });
    throw error;
  }
}

export async function updateFeeType(record, data) {
  try {
    record.set(data);
    return await record.save();
  } catch (error) {
    if (error?.code === 11000) throw new FeeFormError('A fee type with this name already exists.', { name: 'A fee type with this name already exists.' });
    throw error;
  }
}

export async function createStudentFee(data, authorization) {
  try {
    await ensureStudentFeeRelationships(data);
    return await StudentFee.create({ ...data, assignedBy: authorization.user.id });
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateStudentFee(record, data, authorization) {
  try {
    await ensureStudentFeeRelationships(data);
    record.set({ ...data, updatedBy: authorization.user.id });
    return await record.save();
  } catch (error) {
    duplicateError(error);
  }
}
