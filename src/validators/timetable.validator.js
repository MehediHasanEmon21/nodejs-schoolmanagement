import mongoose from 'mongoose';
import { timetableDays } from '../models/TimetableEntry.js';

const statuses = new Set(['active', 'inactive']);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function id(value) {
  const candidate = text(value);
  return candidate && mongoose.isObjectIdOrHexString(candidate) ? candidate : '';
}

function time(value) {
  const candidate = text(value);
  return timePattern.test(candidate) ? candidate : '';
}

export function timetableFormValues(entry = {}) {
  return {
    academicYear: String(entry.academicYear?._id ?? entry.academicYear ?? ''),
    class: String(entry.class?._id ?? entry.class ?? ''),
    section: String(entry.section?._id ?? entry.section ?? ''),
    subject: String(entry.subject?._id ?? entry.subject ?? ''),
    teacher: String(entry.teacher?._id ?? entry.teacher ?? ''),
    day: timetableDays.includes(entry.day) ? entry.day : 'monday',
    startTime: entry.startTime ?? '',
    endTime: entry.endTime ?? '',
    room: entry.room ?? '',
    status: entry.status ?? 'active',
  };
}

export function validateTimetableEntry(body = {}) {
  const values = {
    academicYear: id(body.academicYear),
    class: id(body.class),
    section: id(body.section),
    subject: id(body.subject),
    teacher: id(body.teacher),
    day: timetableDays.includes(body.day) ? body.day : 'monday',
    startTime: time(body.startTime),
    endTime: time(body.endTime),
    room: text(body.room).slice(0, 80),
    status: statuses.has(body.status) ? body.status : 'active',
  };
  const errors = {};
  if (!values.academicYear) errors.academicYear = 'Choose a valid academic year.';
  if (!values.class) errors.class = 'Choose a valid class.';
  if (!values.section) errors.section = 'Choose a valid section.';
  if (!values.subject) errors.subject = 'Choose a valid subject.';
  if (!values.teacher) errors.teacher = 'Choose a valid teacher.';
  if (!values.startTime) errors.startTime = 'Use a valid start time.';
  if (!values.endTime) errors.endTime = 'Use a valid end time.';
  if (values.startTime && values.endTime && values.startTime >= values.endTime) errors.endTime = 'End time must be after start time.';
  return { values, data: { ...values }, errors };
}

export function timetableListParams(query = {}) {
  return {
    academicYear: mongoose.isObjectIdOrHexString(query.academicYear) ? query.academicYear : '',
    class: mongoose.isObjectIdOrHexString(query.class) ? query.class : '',
    section: mongoose.isObjectIdOrHexString(query.section) ? query.section : '',
    teacher: mongoose.isObjectIdOrHexString(query.teacher) ? query.teacher : '',
    day: timetableDays.includes(query.day) ? query.day : '',
  };
}
