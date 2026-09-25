import mongoose from 'mongoose';
import Exam from '../models/Exam.js';
import AcademicYear from '../models/AcademicYear.js';
import SchoolClass from '../models/SchoolClass.js';
import Subject from '../models/Subject.js';
import { hasRole } from './authorization.service.js';

const sortOptions = {
  startDate: { startDate: -1 },
  name: { name: 1 },
  status: { status: 1, startDate: -1 },
};

export class ExamFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'ExamFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function duplicateError(error) {
  if (error?.code !== 11000) throw error;
  const message = 'An exam with this name already exists for the selected academic year and class.';
  throw new ExamFormError(message, { name: message });
}

export function canManageExams(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

export function canViewExams(authorization) {
  return canManageExams(authorization) || hasRole(authorization, 'teacher') || hasRole(authorization, 'student') || hasRole(authorization, 'guardian');
}

export function examListParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 10;
  const sort = Object.hasOwn(sortOptions, query.sort) ? query.sort : 'startDate';
  return {
    page,
    limit,
    status: ['draft', 'scheduled', 'completed', 'cancelled'].includes(query.status) ? query.status : '',
    academicYear: mongoose.isObjectIdOrHexString(query.academicYear) ? query.academicYear : '',
    class: mongoose.isObjectIdOrHexString(query.class) ? query.class : '',
    sort,
  };
}

export async function listExams(query, authorization) {
  if (!canViewExams(authorization)) return { records: [], filters: { ...examListParams(query), page: 1 }, total: 0, totalPages: 1 };
  const params = examListParams(query);
  const filter = {};
  if (params.status) filter.status = params.status;
  if (params.academicYear) filter.academicYear = params.academicYear;
  if (params.class) filter.class = params.class;
  const total = await Exam.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const records = await Exam.find(filter).populate('academicYear class subjects.subject')
    .sort(sortOptions[params.sort]).skip((page - 1) * params.limit).limit(params.limit).lean();
  return { records, filters: { ...params, page }, total, totalPages };
}

export async function listExamFormOptions() {
  const [academicYears, classes, subjects] = await Promise.all([
    AcademicYear.find({ status: 'active' }).sort({ startDate: -1 }).lean(),
    SchoolClass.find({ status: 'active' }).sort({ name: 1 }).lean(),
    Subject.find({ status: 'active' }).populate('classes').sort({ name: 1 }).lean(),
  ]);
  return { academicYears, classes, subjects };
}

export async function getExam(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Exam.findById(id).populate('academicYear class subjects.subject');
}

async function ensureRelationships(data) {
  const [academicYear, schoolClass, subjects] = await Promise.all([
    AcademicYear.findById(data.academicYear),
    SchoolClass.findById(data.class),
    Subject.find({ _id: { $in: data.subjects.map((item) => item.subject) } }),
  ]);
  const errors = {};
  if (!academicYear || academicYear.status !== 'active') errors.academicYear = 'Choose a valid active academic year.';
  if (!schoolClass || schoolClass.status !== 'active') errors.class = 'Choose a valid active class.';
  if (subjects.length !== data.subjects.length) {
    errors.subjects = 'Choose valid active subjects.';
  } else {
    for (const subject of subjects) {
      if (subject.status !== 'active' || !subject.classes.map(String).includes(String(data.class))) {
        errors.subjects = 'Every subject must be active and assigned to the selected class.';
        break;
      }
    }
  }
  if (Object.keys(errors).length) throw new ExamFormError('Please check the exam relationships.', errors);
}

export async function createExam(data) {
  try {
    await ensureRelationships(data);
    return await Exam.create(data);
  } catch (error) {
    duplicateError(error);
  }
}

export async function updateExam(exam, data) {
  try {
    await ensureRelationships(data);
    exam.set(data);
    return await exam.save();
  } catch (error) {
    duplicateError(error);
  }
}
