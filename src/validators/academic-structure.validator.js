import mongoose from 'mongoose';

const statuses = new Set(['active', 'inactive']);

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : fallback;
}

function status(value) {
  return statuses.has(value) ? value : 'active';
}

function ids(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(raw.filter((item) => typeof item === 'string' && mongoose.isObjectIdOrHexString(item)))];
}

export function validateSchoolClass(body = {}) {
  const values = { name: text(body.name), status: status(body.status) };
  const errors = {};
  if (!values.name || values.name.length > 80) errors.name = 'Enter a class name up to 80 characters.';
  return { values, data: values, errors };
}

export function validateSection(body = {}) {
  const values = { name: text(body.name), class: text(body.class), status: status(body.status) };
  const errors = {};
  if (!values.name || values.name.length > 80) errors.name = 'Enter a section name up to 80 characters.';
  if (!mongoose.isObjectIdOrHexString(values.class)) errors.class = 'Choose a valid class.';
  return { values, data: values, errors };
}

export function validateSubject(body = {}) {
  const values = {
    name: text(body.name),
    code: text(body.code).toUpperCase(),
    classes: ids(body.classes),
    status: status(body.status),
  };
  const errors = {};
  if (!values.name || values.name.length > 120) errors.name = 'Enter a subject name up to 120 characters.';
  if (values.code.length > 20) errors.code = 'Enter a code up to 20 characters.';
  if (!values.classes.length) errors.classes = 'Choose at least one class for this subject.';
  return { values, data: values, errors };
}
