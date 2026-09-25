import mongoose from 'mongoose';

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function id(value) {
  const candidate = text(value);
  return candidate && mongoose.isObjectIdOrHexString(candidate) ? candidate : '';
}

function numberValue(value) {
  const raw = text(value);
  if (raw === '') return { raw, number: null };
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { raw, number: null };
  return { raw, number: Number(raw) };
}

export function markEntryValues(fallback = {}) {
  return {
    exam: String(fallback.exam?._id ?? fallback.exam ?? ''),
    subject: String(fallback.subject?._id ?? fallback.subject ?? ''),
    marks: fallback.marks ?? {},
  };
}

export function validateMarkSelection(body = {}) {
  const values = {
    exam: id(body.exam),
    subject: id(body.subject),
  };
  const errors = {};
  if (!values.exam) errors.exam = 'Choose a valid exam.';
  if (!values.subject) errors.subject = 'Choose a valid subject.';
  return { values, data: { ...values }, errors };
}

export function validateMarkEntry(body = {}) {
  const selection = validateMarkSelection(body);
  const marks = {};
  for (const [key, value] of Object.entries(body)) {
    const match = key.match(/^marks_([a-f0-9]{24})$/i);
    if (!match) continue;
    const studentId = match[1];
    const mark = numberValue(value);
    marks[studentId] = {
      marksObtained: mark.raw,
      note: text(body[`note_${studentId}`]).slice(0, 200),
      number: mark.number,
    };
    if (mark.number === null) selection.errors.marks = 'Enter valid marks for every student.';
  }
  return {
    ...selection,
    values: { ...selection.values, marks },
    data: { ...selection.data, marks },
  };
}
