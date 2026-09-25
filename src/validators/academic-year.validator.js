const statuses = new Set(['active', 'inactive']);

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

export function validateAcademicYear(body = {}) {
  const values = {
    name: typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '',
    startDate: dateString(body.startDate),
    endDate: dateString(body.endDate),
    status: statuses.has(body.status) ? body.status : 'active',
    isCurrent: body.isCurrent === 'on' || body.isCurrent === 'true' || body.isCurrent === true,
  };
  const errors = {};
  if (!values.name || values.name.length > 80) errors.name = 'Enter a name up to 80 characters.';
  const startDate = parseDate(values.startDate);
  const endDate = parseDate(values.endDate);
  if (!startDate) errors.startDate = 'Enter a valid start date.';
  if (!endDate) errors.endDate = 'Enter a valid end date.';
  if (startDate && endDate && startDate >= endDate) errors.endDate = 'End date must be after the start date.';
  if (values.isCurrent && values.status !== 'active') errors.isCurrent = 'Only an active academic year can be current.';
  return { values, data: { ...values, startDate, endDate }, errors };
}
