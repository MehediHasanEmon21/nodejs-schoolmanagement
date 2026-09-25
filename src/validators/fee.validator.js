import mongoose from 'mongoose';

const feeStatuses = new Set(['pending', 'partial', 'paid', 'waived', 'cancelled']);
const typeStatuses = new Set(['active', 'inactive']);

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function id(value) {
  const candidate = text(value);
  return candidate && mongoose.isObjectIdOrHexString(candidate) ? candidate : '';
}

function money(value) {
  const raw = text(value);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { raw, number: null };
  return { raw, number: Number(raw) };
}

function dateInput(value) {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { raw, date: null };
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== raw ? { raw, date: null } : { raw, date };
}

function formatDate(value) {
  return value instanceof Date && !Number.isNaN(value.valueOf()) ? value.toISOString().slice(0, 10) : '';
}

export function feeTypeFormValues(record = {}) {
  record ??= {};
  return {
    name: record.name ?? '',
    description: record.description ?? '',
    defaultAmount: String(record.defaultAmount ?? ''),
    status: record.status ?? 'active',
  };
}

export function studentFeeFormValues(record = {}) {
  record ??= {};
  return {
    student: String(record.student?._id ?? record.student ?? ''),
    academicYear: String(record.academicYear?._id ?? record.academicYear ?? ''),
    feeType: String(record.feeType?._id ?? record.feeType ?? ''),
    amount: String(record.amount ?? ''),
    paidAmount: String(record.paidAmount ?? 0),
    dueDate: formatDate(record.dueDate),
    status: record.status ?? 'pending',
    note: record.note ?? '',
  };
}

export function validateFeeType(body = {}) {
  const amount = money(body.defaultAmount);
  const values = {
    name: text(body.name).replace(/\s+/g, ' '),
    description: text(body.description),
    defaultAmount: amount.raw,
    status: typeStatuses.has(body.status) ? body.status : 'active',
  };
  const errors = {};
  if (!values.name || values.name.length > 120) errors.name = 'Enter a name up to 120 characters.';
  if (values.description.length > 300) errors.description = 'Description must be 300 characters or fewer.';
  if (amount.number === null || amount.number < 0 || amount.number > 10000000) errors.defaultAmount = 'Enter a valid amount.';
  return { values, data: { ...values, defaultAmount: amount.number }, errors };
}

export function validateStudentFee(body = {}) {
  const amount = money(body.amount);
  const paidAmount = money(body.paidAmount ?? '0');
  const dueDate = dateInput(body.dueDate);
  const values = {
    student: id(body.student),
    academicYear: id(body.academicYear),
    feeType: id(body.feeType),
    amount: amount.raw,
    paidAmount: paidAmount.raw || '0',
    dueDate: dueDate.raw,
    status: feeStatuses.has(body.status) ? body.status : 'pending',
    note: text(body.note),
  };
  const errors = {};
  if (!values.student) errors.student = 'Choose a valid student.';
  if (!values.academicYear) errors.academicYear = 'Choose a valid academic year.';
  if (!values.feeType) errors.feeType = 'Choose a valid fee type.';
  if (amount.number === null || amount.number < 0 || amount.number > 10000000) errors.amount = 'Enter a valid amount.';
  if (paidAmount.number === null || paidAmount.number < 0 || paidAmount.number > 10000000) errors.paidAmount = 'Enter a valid paid amount.';
  if (amount.number !== null && paidAmount.number !== null && paidAmount.number > amount.number) errors.paidAmount = 'Paid amount cannot exceed fee amount.';
  if (!dueDate.date) errors.dueDate = 'Enter a valid due date.';
  if (values.note.length > 300) errors.note = 'Note must be 300 characters or fewer.';
  return { values, data: { ...values, amount: amount.number, paidAmount: paidAmount.number ?? 0, dueDate: dueDate.date }, errors };
}
