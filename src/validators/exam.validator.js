import mongoose from 'mongoose';

const statuses = new Set(['draft', 'scheduled', 'completed', 'cancelled']);

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function id(value) {
  const candidate = text(value);
  return candidate && mongoose.isObjectIdOrHexString(candidate) ? candidate : '';
}

function parseDateInput(value) {
  const candidate = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return { value: candidate, date: null };
  const date = new Date(`${candidate}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== candidate) return { value: candidate, date: null };
  return { value: candidate, date };
}

function numberValue(value) {
  const raw = text(value);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { raw, number: null };
  return { raw, number: Number(raw) };
}

function array(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined) return [];
  return [value];
}

function formatDate(value) {
  return value instanceof Date && !Number.isNaN(value.valueOf()) ? value.toISOString().slice(0, 10) : '';
}

export function examFormValues(exam = {}) {
  exam ??= {};
  return {
    academicYear: String(exam.academicYear?._id ?? exam.academicYear ?? ''),
    class: String(exam.class?._id ?? exam.class ?? ''),
    name: exam.name ?? '',
    startDate: formatDate(exam.startDate),
    endDate: formatDate(exam.endDate),
    status: exam.status ?? 'draft',
    subjects: (exam.subjects ?? []).map((item) => ({
      subject: String(item.subject?._id ?? item.subject ?? ''),
      totalMarks: String(item.totalMarks ?? '100'),
      passMarks: String(item.passMarks ?? '33'),
      examDate: formatDate(item.examDate),
    })),
  };
}

export function validateExam(body = {}) {
  const start = parseDateInput(body.startDate);
  const end = parseDateInput(body.endDate);
  const values = {
    academicYear: id(body.academicYear),
    class: id(body.class),
    name: text(body.name).replace(/\s+/g, ' '),
    startDate: start.value,
    endDate: end.value,
    status: statuses.has(body.status) ? body.status : 'draft',
    subjects: [],
  };
  const errors = {};
  if (!values.academicYear) errors.academicYear = 'Choose a valid academic year.';
  if (!values.class) errors.class = 'Choose a valid class.';
  if (!values.name || values.name.length > 120) errors.name = 'Enter a name up to 120 characters.';
  if (!start.date) errors.startDate = 'Enter a valid start date.';
  if (!end.date) errors.endDate = 'Enter a valid end date.';
  if (start.date && end.date && start.date > end.date) errors.endDate = 'End date must be on or after the start date.';

  const subjects = array(body.subjects);
  const totalMarks = array(body.totalMarks);
  const passMarks = array(body.passMarks);
  const examDates = array(body.examDate);
  const seen = new Set();
  const dataSubjects = [];
  subjects.forEach((subjectValue, index) => {
    const subject = id(subjectValue);
    const total = numberValue(totalMarks[index]);
    const pass = numberValue(passMarks[index]);
    const subjectDate = parseDateInput(examDates[index]);
    const row = { subject, totalMarks: total.raw || '100', passMarks: pass.raw || '33', examDate: subjectDate.value };
    if (!subject && !total.raw && !pass.raw && !subjectDate.value) return;
    values.subjects.push(row);
    if (!subject) errors.subjects = 'Choose valid subjects.';
    if (subject && seen.has(subject)) errors.subjects = 'Each subject can be configured only once.';
    seen.add(subject);
    if (total.number === null || total.number < 1 || total.number > 1000) errors.subjects = 'Enter valid total marks between 1 and 1000.';
    if (pass.number === null || pass.number < 0 || pass.number > 1000) errors.subjects = 'Enter valid pass marks between 0 and 1000.';
    if (total.number !== null && pass.number !== null && pass.number > total.number) errors.subjects = 'Pass marks cannot be greater than total marks.';
    if (subjectDate.value && !subjectDate.date) errors.subjects = 'Enter valid subject exam dates.';
    if (subjectDate.date && start.date && end.date && (subjectDate.date < start.date || subjectDate.date > end.date)) {
      errors.subjects = 'Subject exam dates must be inside the exam date range.';
    }
    dataSubjects.push({ subject, totalMarks: total.number, passMarks: pass.number, examDate: subjectDate.date });
  });
  if (!values.subjects.length) errors.subjects = 'Configure at least one subject.';

  return {
    values,
    data: { ...values, startDate: start.date, endDate: end.date, subjects: dataSubjects },
    errors,
  };
}
