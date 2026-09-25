function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
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

const methods = new Set(['cash', 'bank_transfer', 'card', 'mobile_banking', 'other']);

function formatDate(value) {
  return value instanceof Date && !Number.isNaN(value.valueOf()) ? value.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export function paymentFormValues(payment = {}) {
  payment ??= {};
  return {
    amount: String(payment.amount ?? ''),
    paidAt: formatDate(payment.paidAt),
    method: payment.method ?? 'cash',
    referenceNumber: payment.referenceNumber ?? '',
    note: payment.note ?? '',
  };
}

export function validatePayment(body = {}) {
  const amount = money(body.amount);
  const paidAt = dateInput(body.paidAt);
  const values = {
    amount: amount.raw,
    paidAt: paidAt.raw,
    method: methods.has(body.method) ? body.method : 'cash',
    referenceNumber: text(body.referenceNumber).toUpperCase(),
    note: text(body.note),
  };
  const errors = {};
  if (amount.number === null || amount.number <= 0 || amount.number > 10000000) errors.amount = 'Enter a valid payment amount.';
  if (!paidAt.date) errors.paidAt = 'Enter a valid payment date.';
  if (values.referenceNumber.length > 80) errors.referenceNumber = 'Reference number must be 80 characters or fewer.';
  if (values.note.length > 300) errors.note = 'Note must be 300 characters or fewer.';
  return { values, data: { ...values, amount: amount.number, paidAt: paidAt.date }, errors };
}
