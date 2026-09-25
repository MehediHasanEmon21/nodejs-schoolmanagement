import mongoose from 'mongoose';

const statuses = new Set(['active', 'inactive']);

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function id(value) {
  const candidate = text(value);
  return candidate && mongoose.isObjectIdOrHexString(candidate) ? candidate : '';
}

export function teacherAssignmentFormValues(assignment = {}) {
  return {
    teacher: String(assignment.teacher?._id ?? assignment.teacher ?? ''),
    academicYear: String(assignment.academicYear?._id ?? assignment.academicYear ?? ''),
    class: String(assignment.class?._id ?? assignment.class ?? ''),
    section: String(assignment.section?._id ?? assignment.section ?? ''),
    subject: String(assignment.subject?._id ?? assignment.subject ?? ''),
    status: assignment.status ?? 'active',
  };
}

export function validateTeacherAssignment(body = {}) {
  const values = {
    teacher: id(body.teacher),
    academicYear: id(body.academicYear),
    class: id(body.class),
    section: id(body.section),
    subject: id(body.subject),
    status: statuses.has(body.status) ? body.status : 'active',
  };
  const errors = {};
  if (!values.teacher) errors.teacher = 'Choose a valid teacher.';
  if (!values.academicYear) errors.academicYear = 'Choose a valid academic year.';
  if (!values.class) errors.class = 'Choose a valid class.';
  if (!values.section) errors.section = 'Choose a valid section.';
  if (!values.subject) errors.subject = 'Choose a valid subject.';
  return { values, data: { ...values }, errors };
}
