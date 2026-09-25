import mongoose from 'mongoose';

const statuses = new Set(['active', 'inactive']);

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : fallback;
}

function optionalId(value) {
  const id = text(value);
  return id && mongoose.isObjectIdOrHexString(id) ? id : '';
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

export function teacherFormValues(teacher = {}) {
  return {
    teacherId: teacher.teacherId ?? '',
    user: String(teacher.user?._id ?? teacher.user ?? ''),
    name: teacher.name ?? '',
    email: teacher.email ?? '',
    phone: teacher.phone ?? '',
    joiningDate: typeof teacher.joiningDate === 'string' ? teacher.joiningDate : formatDateInput(teacher.joiningDate),
    qualification: teacher.qualification ?? '',
    status: teacher.status ?? 'active',
  };
}

export function validateTeacher(body = {}) {
  const values = {
    teacherId: text(body.teacherId).toUpperCase(),
    user: optionalId(body.user),
    name: text(body.name),
    email: text(body.email).toLowerCase(),
    phone: text(body.phone),
    joiningDate: typeof body.joiningDate === 'string' ? body.joiningDate.trim() : '',
    qualification: text(body.qualification),
    status: statuses.has(body.status) ? body.status : 'active',
  };
  const errors = {};
  if (!values.teacherId || values.teacherId.length > 40) errors.teacherId = 'Enter a teacher ID up to 40 characters.';
  if (!values.name || values.name.length > 120) errors.name = 'Enter a teacher name up to 120 characters.';
  if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Enter a valid email address.';
  if (values.phone.length > 30) errors.phone = 'Enter a phone number up to 30 characters.';
  const joiningDate = parseDate(values.joiningDate);
  if (!joiningDate) errors.joiningDate = 'Enter a valid joining date.';
  if (values.qualification.length > 300) errors.qualification = 'Enter a qualification up to 300 characters.';
  return { values, data: { ...values, user: values.user || null, joiningDate }, errors };
}
