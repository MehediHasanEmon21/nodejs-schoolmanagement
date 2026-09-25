import mongoose from 'mongoose';

const statuses = new Set(['active', 'inactive']);
const genders = new Set(['female', 'male', 'other', 'prefer_not_to_say']);

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : fallback;
}

function optionalId(value) {
  const id = text(value);
  return id && mongoose.isObjectIdOrHexString(id) ? id : '';
}

function dateString(value) {
  return typeof value === 'string' ? value.trim() : '';
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

export function studentFormValues(student = {}) {
  return {
    studentId: student.studentId ?? '',
    user: String(student.user?._id ?? student.user ?? ''),
    firstName: student.firstName ?? '',
    lastName: student.lastName ?? '',
    dateOfBirth: typeof student.dateOfBirth === 'string' ? student.dateOfBirth : formatDateInput(student.dateOfBirth),
    gender: student.gender ?? '',
    phone: student.phone ?? '',
    address: student.address ?? '',
    admissionDate: typeof student.admissionDate === 'string' ? student.admissionDate : formatDateInput(student.admissionDate),
    class: String(student.class?._id ?? student.class ?? ''),
    section: String(student.section?._id ?? student.section ?? ''),
    status: student.status ?? 'active',
  };
}

export function validateStudent(body = {}) {
  const values = {
    studentId: text(body.studentId).toUpperCase(),
    user: optionalId(body.user),
    firstName: text(body.firstName),
    lastName: text(body.lastName),
    dateOfBirth: dateString(body.dateOfBirth),
    gender: genders.has(body.gender) ? body.gender : '',
    phone: text(body.phone),
    address: text(body.address),
    admissionDate: dateString(body.admissionDate),
    class: optionalId(body.class),
    section: optionalId(body.section),
    status: statuses.has(body.status) ? body.status : 'active',
  };
  const errors = {};
  if (!values.studentId || values.studentId.length > 40) errors.studentId = 'Enter a student ID up to 40 characters.';
  if (!values.firstName || values.firstName.length > 80) errors.firstName = 'Enter a first name up to 80 characters.';
  if (!values.lastName || values.lastName.length > 80) errors.lastName = 'Enter a last name up to 80 characters.';
  const dateOfBirth = parseDate(values.dateOfBirth);
  const admissionDate = parseDate(values.admissionDate);
  if (!dateOfBirth) errors.dateOfBirth = 'Enter a valid date of birth.';
  if (!admissionDate) errors.admissionDate = 'Enter a valid admission date.';
  if (!values.gender) errors.gender = 'Choose a valid gender.';
  if (values.phone.length > 30) errors.phone = 'Enter a phone number up to 30 characters.';
  if (values.address.length > 300) errors.address = 'Enter an address up to 300 characters.';
  if (!values.class && values.section) errors.section = 'Choose a class before choosing a section.';
  return { values, data: { ...values, user: values.user || null, class: values.class || null, section: values.section || null, dateOfBirth, admissionDate }, errors };
}
