import mongoose from 'mongoose';

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function id(value) {
  const candidate = text(value);
  return candidate && mongoose.isObjectIdOrHexString(candidate) ? candidate : '';
}

function date(value) {
  const candidate = text(value);
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return '';
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? '' : candidate;
}

export function reportFilters(query = {}) {
  return {
    q: text(query.q),
    status: text(query.status),
    academicYear: id(query.academicYear),
    class: id(query.class),
    section: id(query.section),
    exam: id(query.exam),
    feeType: id(query.feeType),
    dateFrom: date(query.dateFrom),
    dateTo: date(query.dateTo),
  };
}

export function dateRange(filters) {
  const range = {};
  if (filters.dateFrom) range.$gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) range.$lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
  return range;
}
