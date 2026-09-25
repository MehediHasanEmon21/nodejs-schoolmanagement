import mongoose from 'mongoose';

export const attendanceStatuses = ['present', 'absent', 'late', 'excused'];

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function id(value) {
  const candidate = text(value);
  return candidate && mongoose.isObjectIdOrHexString(candidate) ? candidate : '';
}

function date(value) {
  const candidate = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return '';
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? '' : candidate;
}

export function attendanceFormValues(attendance = {}, fallback = {}) {
  attendance ??= {};
  return {
    academicYear: String(attendance.academicYear?._id ?? attendance.academicYear ?? fallback.academicYear ?? ''),
    class: String(attendance.class?._id ?? attendance.class ?? fallback.class ?? ''),
    section: String(attendance.section?._id ?? attendance.section ?? fallback.section ?? ''),
    date: attendance.date instanceof Date ? attendance.date.toISOString().slice(0, 10) : fallback.date ?? new Date().toISOString().slice(0, 10),
    records: Object.fromEntries((attendance.records ?? []).map((record) => [
      String(record.student?._id ?? record.student),
      { status: record.status, note: record.note ?? '' },
    ])),
  };
}

export function validateAttendanceSelection(body = {}) {
  const values = {
    academicYear: id(body.academicYear),
    class: id(body.class),
    section: id(body.section),
    date: date(body.date),
  };
  const errors = {};
  if (!values.academicYear) errors.academicYear = 'Choose a valid academic year.';
  if (!values.class) errors.class = 'Choose a valid class.';
  if (!values.section) errors.section = 'Choose a valid section.';
  if (!values.date) errors.date = 'Choose a valid attendance date.';
  return { values, data: { ...values, date: values.date ? new Date(`${values.date}T00:00:00.000Z`) : null }, errors };
}

export function validateAttendance(body = {}) {
  const selection = validateAttendanceSelection(body);
  const records = {};
  for (const [key, value] of Object.entries(body)) {
    const match = key.match(/^status_([a-f0-9]{24})$/i);
    if (!match) continue;
    const studentId = match[1];
    records[studentId] = {
      status: attendanceStatuses.includes(value) ? value : 'present',
      note: text(body[`note_${studentId}`]).slice(0, 200),
    };
  }
  return { ...selection, data: { ...selection.data, records }, values: { ...selection.values, records } };
}
