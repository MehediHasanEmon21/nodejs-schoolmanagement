import mongoose from 'mongoose';
import TimetableEntry, { timetableDays } from '../models/TimetableEntry.js';
import AcademicYear from '../models/AcademicYear.js';
import Enrollment from '../models/Enrollment.js';
import Guardian from '../models/Guardian.js';
import SchoolClass from '../models/SchoolClass.js';
import Section from '../models/Section.js';
import Student from '../models/Student.js';
import Subject from '../models/Subject.js';
import Teacher from '../models/Teacher.js';
import TeacherAssignment from '../models/TeacherAssignment.js';
import { hasRole } from './authorization.service.js';
import { timetableListParams } from '../validators/timetable.validator.js';

export class TimetableFormError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'TimetableFormError';
    this.status = 422;
    this.errors = errors;
  }
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
}

export function canManageTimetable(authorization) {
  return hasRole(authorization, 'admin') || hasRole(authorization, 'super_admin');
}

async function teacherProfileId(userId) {
  const teacher = await Teacher.findOne({ user: userId, status: 'active' }).select('_id');
  return teacher?._id ?? null;
}

async function guardianStudentIds(userId) {
  const guardian = await Guardian.findOne({ user: userId, status: 'active' }).select('students');
  return guardian?.students ?? [];
}

async function enrollmentScopes(authorization) {
  let studentFilter = null;
  if (hasRole(authorization, 'student')) studentFilter = await Student.find({ user: authorization.user.id, status: 'active' }).distinct('_id');
  if (hasRole(authorization, 'guardian')) studentFilter = await guardianStudentIds(authorization.user.id);
  if (!studentFilter?.length) return [];
  return Enrollment.find({ student: { $in: studentFilter }, status: 'active' }).select('academicYear class section').lean();
}

async function listScope(authorization) {
  if (canManageTimetable(authorization)) return { status: 'active' };
  if (hasRole(authorization, 'teacher')) {
    const teacherId = await teacherProfileId(authorization.user.id);
    return teacherId ? { teacher: teacherId, status: 'active' } : { _id: null };
  }
  const scopes = await enrollmentScopes(authorization);
  if (!scopes.length) return { _id: null };
  return {
    status: 'active',
    $or: scopes.map((item) => ({ academicYear: item.academicYear, class: item.class, section: item.section })),
  };
}

export async function canAccessTimetableEntry(authorization, entry) {
  if (!entry) return false;
  if (canManageTimetable(authorization)) return true;
  if (entry.status !== 'active') return false;
  if (hasRole(authorization, 'teacher')) {
    const teacherId = await teacherProfileId(authorization.user.id);
    return Boolean(teacherId) && String(entry.teacher?._id ?? entry.teacher) === String(teacherId);
  }
  const scopes = await enrollmentScopes(authorization);
  return scopes.some((item) => String(item.academicYear) === String(entry.academicYear?._id ?? entry.academicYear) &&
    String(item.class) === String(entry.class?._id ?? entry.class) &&
    String(item.section) === String(entry.section?._id ?? entry.section));
}

export async function listTimetable(query, authorization) {
  const filters = timetableListParams(query);
  const filter = await listScope(authorization);
  if (filters.academicYear) filter.academicYear = filters.academicYear;
  if (filters.class) filter.class = filters.class;
  if (filters.section) filter.section = filters.section;
  if (filters.teacher) filter.teacher = filters.teacher;
  if (filters.day) filter.day = filters.day;
  const records = await TimetableEntry.find(filter).populate('academicYear class section subject teacher')
    .sort({ day: 1, startTime: 1 }).lean();
  return { records, grouped: groupTimetable(records), filters };
}

export function groupTimetable(records) {
  return timetableDays.map((day) => ({
    day,
    records: records.filter((entry) => entry.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));
}

export async function listTimetableFormOptions() {
  const [academicYears, classes, sections, subjects, teachers] = await Promise.all([
    AcademicYear.find({ status: 'active' }).sort({ startDate: -1 }).lean(),
    SchoolClass.find({ status: 'active' }).sort({ name: 1 }).lean(),
    Section.find({ status: 'active' }).populate('class').sort({ name: 1 }).lean(),
    Subject.find({ status: 'active' }).populate('classes').sort({ name: 1 }).lean(),
    Teacher.find({ status: 'active' }).sort({ name: 1 }).lean(),
  ]);
  return { academicYears, classes, sections, subjects, teachers, days: timetableDays };
}

export async function getTimetableEntry(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return TimetableEntry.findById(id).populate('academicYear class section subject teacher createdBy updatedBy');
}

async function ensureRelationships(data) {
  const [academicYear, schoolClass, section, subject, teacher, assignment] = await Promise.all([
    AcademicYear.findById(data.academicYear),
    SchoolClass.findById(data.class),
    Section.findById(data.section),
    Subject.findById(data.subject),
    Teacher.findById(data.teacher),
    TeacherAssignment.findOne({
      academicYear: data.academicYear,
      class: data.class,
      section: data.section,
      subject: data.subject,
      teacher: data.teacher,
      status: 'active',
    }),
  ]);
  const errors = {};
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
  if (!teacher || teacher.status !== 'active') errors.teacher = 'Choose a valid active teacher.';
  if (!assignment) errors.teacher = 'Choose the active teacher assigned to this year, class, section and subject.';
  if (Object.keys(errors).length) throw new TimetableFormError('Please check the timetable relationships.', errors);
}

async function ensureNoConflicts(data, ignoredId = null) {
  if (data.status !== 'active') return;
  const filter = { academicYear: data.academicYear, day: data.day, status: 'active' };
  if (ignoredId) filter._id = { $ne: ignoredId };
  const candidates = await TimetableEntry.find({
    ...filter,
    $or: [
      { class: data.class, section: data.section },
      { teacher: data.teacher },
    ],
  }).populate('class section teacher subject').lean();
  const errors = {};
  for (const entry of candidates) {
    if (!overlaps(data.startTime, data.endTime, entry.startTime, entry.endTime)) continue;
    if (String(entry.class._id ?? entry.class) === String(data.class) && String(entry.section._id ?? entry.section) === String(data.section)) {
      errors.startTime = `This class already has ${entry.subject.name} from ${entry.startTime} to ${entry.endTime}.`;
    }
    if (String(entry.teacher._id ?? entry.teacher) === String(data.teacher)) {
      errors.teacher = `This teacher already has a class from ${entry.startTime} to ${entry.endTime}.`;
    }
  }
  if (Object.keys(errors).length) throw new TimetableFormError('Please resolve the timetable conflict.', errors);
}

export async function createTimetableEntry(data, authorization) {
  if (!canManageTimetable(authorization)) throw Object.assign(new Error('Access denied'), { status: 403 });
  await ensureRelationships(data);
  await ensureNoConflicts(data);
  return TimetableEntry.create({ ...data, createdBy: authorization.user.id });
}

export async function updateTimetableEntry(entry, data, authorization) {
  if (!canManageTimetable(authorization)) throw Object.assign(new Error('Access denied'), { status: 403 });
  await ensureRelationships(data);
  await ensureNoConflicts(data, entry._id);
  entry.set({ ...data, updatedBy: authorization.user.id });
  return entry.save();
}
