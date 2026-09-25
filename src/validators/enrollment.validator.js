import mongoose from 'mongoose';

const statuses = new Set(['active', 'inactive', 'completed', 'transferred']);

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : fallback;
}

function id(value) {
  const candidate = text(value);
  return candidate && mongoose.isObjectIdOrHexString(candidate) ? candidate : '';
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function formatDateInput(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return value.toISOString().slice(0, 10);
}

export function enrollmentFormValues(enrollment = {}) {
  return {
    student: String(enrollment.student?._id ?? enrollment.student ?? ''),
    academicYear: String(enrollment.academicYear?._id ?? enrollment.academicYear ?? ''),
    class: String(enrollment.class?._id ?? enrollment.class ?? ''),
    section: String(enrollment.section?._id ?? enrollment.section ?? ''),
    rollNumber: enrollment.rollNumber ?? '',
    enrollmentDate: typeof enrollment.enrollmentDate === 'string' ? enrollment.enrollmentDate : formatDateInput(enrollment.enrollmentDate),
    status: enrollment.status ?? 'active',
  };
}

export function validateEnrollment(body = {}) {
  const values = {
    student: id(body.student),
    academicYear: id(body.academicYear),
    class: id(body.class),
    section: id(body.section),
    rollNumber: text(body.rollNumber),
    enrollmentDate: typeof body.enrollmentDate === 'string' ? body.enrollmentDate.trim() : '',
    status: statuses.has(body.status) ? body.status : 'active',
  };
  const errors = {};
  if (!values.student) errors.student = 'Choose a valid student.';
  if (!values.academicYear) errors.academicYear = 'Choose a valid academic year.';
  if (!values.class) errors.class = 'Choose a valid class.';
  if (!values.section) errors.section = 'Choose a valid section.';
  if (!values.rollNumber || values.rollNumber.length > 40) errors.rollNumber = 'Enter a roll number up to 40 characters.';
  const enrollmentDate = parseDate(values.enrollmentDate);
  if (!enrollmentDate) errors.enrollmentDate = 'Enter a valid enrollment date.';
  return { values, data: { ...values, enrollmentDate }, errors };
}
