import mongoose from 'mongoose';

const statuses = new Set(['active', 'inactive']);

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : fallback;
}

function optionalId(value) {
  const id = text(value);
  return id && mongoose.isObjectIdOrHexString(id) ? id : '';
}

function ids(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(raw.filter((item) => typeof item === 'string' && mongoose.isObjectIdOrHexString(item)))];
}

export function guardianFormValues(guardian = {}) {
  return {
    guardianId: guardian.guardianId ?? '',
    user: String(guardian.user?._id ?? guardian.user ?? ''),
    name: guardian.name ?? '',
    email: guardian.email ?? '',
    phone: guardian.phone ?? '',
    relationship: guardian.relationship ?? '',
    address: guardian.address ?? '',
    students: (guardian.students ?? []).map((item) => String(item._id ?? item)),
    status: guardian.status ?? 'active',
  };
}

export function validateGuardian(body = {}) {
  const values = {
    guardianId: text(body.guardianId).toUpperCase(),
    user: optionalId(body.user),
    name: text(body.name),
    email: text(body.email).toLowerCase(),
    phone: text(body.phone),
    relationship: text(body.relationship),
    address: text(body.address),
    students: ids(body.students),
    status: statuses.has(body.status) ? body.status : 'active',
  };
  const errors = {};
  if (!values.guardianId || values.guardianId.length > 40) errors.guardianId = 'Enter a guardian ID up to 40 characters.';
  if (!values.name || values.name.length > 120) errors.name = 'Enter a guardian name up to 120 characters.';
  if (values.email && (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))) errors.email = 'Enter a valid email address.';
  if (!values.phone || values.phone.length > 30) errors.phone = 'Enter a phone number up to 30 characters.';
  if (!values.relationship || values.relationship.length > 80) errors.relationship = 'Enter a relationship up to 80 characters.';
  if (values.address.length > 300) errors.address = 'Enter an address up to 300 characters.';
  if (!values.students.length) errors.students = 'Choose at least one linked student.';
  return { values, data: { ...values, user: values.user || null }, errors };
}
