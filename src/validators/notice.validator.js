import mongoose from 'mongoose';
import { noticeAudiences, noticeStatuses } from '../models/Notice.js';

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function id(value) {
  const candidate = text(value);
  return candidate && mongoose.isObjectIdOrHexString(candidate) ? candidate : '';
}

function date(value) {
  const candidate = text(value);
  if (!candidate) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return '';
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? '' : candidate;
}

function dateValue(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function noticeFormValues(notice = {}) {
  const visibleFrom = notice.visibleFrom instanceof Date ? notice.visibleFrom.toISOString().slice(0, 10) : '';
  const visibleUntil = notice.visibleUntil instanceof Date ? notice.visibleUntil.toISOString().slice(0, 10) : '';
  return {
    title: notice.title ?? '',
    body: notice.body ?? '',
    audience: noticeAudiences.includes(notice.audience) ? notice.audience : 'everyone',
    class: String(notice.class?._id ?? notice.class ?? ''),
    section: String(notice.section?._id ?? notice.section ?? ''),
    status: noticeStatuses.includes(notice.status) ? notice.status : 'draft',
    visibleFrom,
    visibleUntil,
  };
}

export function validateNotice(body = {}) {
  const values = {
    title: text(body.title).slice(0, 160),
    body: text(body.body).slice(0, 3000),
    audience: noticeAudiences.includes(body.audience) ? body.audience : 'everyone',
    class: id(body.class),
    section: id(body.section),
    status: noticeStatuses.includes(body.status) ? body.status : 'draft',
    visibleFrom: date(body.visibleFrom),
    visibleUntil: date(body.visibleUntil),
  };
  const errors = {};
  if (!values.title) errors.title = 'Enter a notice title.';
  if (!values.body) errors.body = 'Enter notice details.';
  if (values.audience === 'class' && !values.class) errors.class = 'Choose a class for this notice.';
  if (values.audience === 'section') {
    if (!values.class) errors.class = 'Choose a class for this section notice.';
    if (!values.section) errors.section = 'Choose a section for this notice.';
  }
  if (text(body.visibleFrom) && !values.visibleFrom) errors.visibleFrom = 'Use a valid start date.';
  if (text(body.visibleUntil) && !values.visibleUntil) errors.visibleUntil = 'Use a valid end date.';
  if (values.visibleFrom && values.visibleUntil && values.visibleUntil < values.visibleFrom) {
    errors.visibleUntil = 'End date must be on or after the start date.';
  }
  const data = {
    ...values,
    class: ['class', 'section'].includes(values.audience) ? values.class || null : null,
    section: values.audience === 'section' ? values.section || null : null,
    visibleFrom: dateValue(values.visibleFrom),
    visibleUntil: dateValue(values.visibleUntil),
  };
  return { values, data, errors };
}

export function noticeListParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = 10;
  return {
    page,
    limit,
    q: text(query.q),
    audience: noticeAudiences.includes(query.audience) ? query.audience : '',
    status: noticeStatuses.includes(query.status) ? query.status : '',
  };
}
