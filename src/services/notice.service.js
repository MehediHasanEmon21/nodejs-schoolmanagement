import mongoose from 'mongoose';
import Notice from '../models/Notice.js';
import Enrollment from '../models/Enrollment.js';
import Guardian from '../models/Guardian.js';
import SchoolClass from '../models/SchoolClass.js';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import { hasRole } from './authorization.service.js';
import { noticeListParams } from '../validators/notice.validator.js';

export class NoticeFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'NoticeFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function now() {
  return new Date();
}

function publishedVisibilityFilter(date = now()) {
  return {
    status: 'published',
    $and: [
      { $or: [{ visibleFrom: null }, { visibleFrom: { $lte: date } }] },
      { $or: [{ visibleUntil: null }, { visibleUntil: { $gte: date } }] },
    ],
  };
}

export function canManageNotices(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

async function teacherScope(userId) {
  const teacher = await Teacher.findOne({ user: userId, status: 'active' }).select('_id');
  if (!teacher) return [];
  return TeacherAssignment.find({ teacher: teacher._id, status: 'active' }).select('class section').lean();
}

async function studentScope(userId) {
  const students = await Student.find({ user: userId, status: 'active' }).distinct('_id');
  if (!students.length) return [];
  return Enrollment.find({ student: { $in: students }, status: 'active' }).select('class section').lean();
}

async function guardianScope(userId) {
  const guardian = await Guardian.findOne({ user: userId, status: 'active' }).select('students');
  if (!guardian?.students?.length) return [];
  return Enrollment.find({ student: { $in: guardian.students }, status: 'active' }).select('class section').lean();
}

async function classSectionScope(authorization) {
  if (hasRole(authorization, 'teacher')) return teacherScope(authorization.user.id);
  if (hasRole(authorization, 'student')) return studentScope(authorization.user.id);
  if (hasRole(authorization, 'guardian')) return guardianScope(authorization.user.id);
  return [];
}

function roleAudience(authorization) {
  if (hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin')) return 'admins';
  if (hasRole(authorization, 'teacher')) return 'teachers';
  if (hasRole(authorization, 'student')) return 'students';
  if (hasRole(authorization, 'guardian')) return 'guardians';
  return '';
}

async function audienceFilter(authorization) {
  if (canManageNotices(authorization)) return {};
  const role = roleAudience(authorization);
  const scopes = await classSectionScope(authorization);
  const filters = [{ audience: 'everyone' }];
  if (role) filters.push({ audience: role });
  for (const scope of scopes) {
    filters.push({ audience: 'class', class: scope.class });
    filters.push({ audience: 'section', class: scope.class, section: scope.section });
  }
  return { ...publishedVisibilityFilter(), $or: filters };
}

export async function listNoticeFormOptions() {
  const [classes, sections] = await Promise.all([
    SchoolClass.find({ status: 'active' }).sort({ name: 1 }).lean(),
    Section.find({ status: 'active' }).populate('class').sort({ name: 1 }).lean(),
  ]);
  return { classes, sections };
}

export async function listNotices(query, authorization) {
  const params = noticeListParams(query);
  const filter = await audienceFilter(authorization);
  if (canManageNotices(authorization)) {
    if (params.audience) filter.audience = params.audience;
    if (params.status) filter.status = params.status;
  }
  if (params.q) {
    const pattern = new RegExp(escapeRegex(params.q), 'i');
    filter.$and = [...(filter.$and ?? []), { $or: [{ title: pattern }, { body: pattern }] }];
  }
  const total = await Notice.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(params.page, totalPages);
  const records = await Notice.find(filter).populate('class section createdBy updatedBy')
    .sort({ visibleFrom: -1, createdAt: -1 }).skip((page - 1) * params.limit).limit(params.limit).lean();
  return { records, filters: { ...params, page }, total, totalPages };
}

export async function getNotice(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Notice.findById(id).populate('class section createdBy updatedBy');
}

function isVisibleByDate(notice, date = now()) {
  if (notice.status !== 'published') return false;
  if (notice.visibleFrom && notice.visibleFrom > date) return false;
  if (notice.visibleUntil && notice.visibleUntil < date) return false;
  return true;
}

export async function canAccessNotice(authorization, notice) {
  if (!notice) return false;
  if (canManageNotices(authorization)) return true;
  if (!isVisibleByDate(notice)) return false;
  if (notice.audience === 'everyone') return true;
  if (notice.audience === roleAudience(authorization)) return true;
  if (!['class', 'section'].includes(notice.audience)) return false;
  const scopes = await classSectionScope(authorization);
  return scopes.some((scope) => String(scope.class) === String(notice.class?._id ?? notice.class) &&
    (notice.audience === 'class' || String(scope.section) === String(notice.section?._id ?? notice.section)));
}

async function ensureRelationships(data) {
  const errors = {};
  if (data.audience === 'class' || data.audience === 'section') {
    const schoolClass = await SchoolClass.findById(data.class);
    if (!schoolClass || schoolClass.status !== 'active') errors.class = 'Choose a valid active class.';
  }
  if (data.audience === 'section') {
    const section = await Section.findById(data.section);
    if (!section || section.status !== 'active' || String(section.class) !== String(data.class)) {
      errors.section = 'Choose an active section that belongs to the selected class.';
    }
  }
  if (Object.keys(errors).length) throw new NoticeFormError('Please check the notice audience.', errors);
}

export async function createNotice(data, authorization) {
  if (!canManageNotices(authorization)) throw Object.assign(new Error('Access denied'), { status: 403 });
  await ensureRelationships(data);
  return Notice.create({ ...data, createdBy: authorization.user.id });
}

export async function updateNotice(notice, data, authorization) {
  if (!canManageNotices(authorization)) throw Object.assign(new Error('Access denied'), { status: 403 });
  await ensureRelationships(data);
  notice.set({ ...data, updatedBy: authorization.user.id });
  return notice.save();
}
