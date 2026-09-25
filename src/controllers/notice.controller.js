import { noticeFormValues, validateNotice } from '../validators/notice.validator.js';
import {
  NoticeFormError,
  canAccessNotice,
  canManageNotices,
  createNotice,
  getNotice,
  listNoticeFormOptions,
  listNotices,
  updateNotice,
} from '../services/notice.service.js';

const notFound = () => Object.assign(new Error('Notice not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function message(query) {
  return query.created ? 'Notice created.' : query.updated ? 'Notice updated.' : null;
}

function pageUrl(request, page) {
  const params = new URLSearchParams(request.query);
  params.set('page', String(page));
  return `${request.path}?${params.toString()}`;
}

async function renderForm(response, { notice = null, values, errors = {}, formMessage = null, status = 200 } = {}) {
  response.status(status).render('notices/form', {
    title: notice ? 'Edit notice' : 'New notice',
    activePage: 'notices',
    notice,
    values: values ?? noticeFormValues(notice),
    errors,
    message: formMessage,
    formOptions: await listNoticeFormOptions(),
  });
}

function handleFormError(response, error, values, notice = null) {
  if (error instanceof NoticeFormError) {
    return renderForm(response, { notice, values, errors: error.errors, formMessage: error.message, status: error.status });
  }
  throw error;
}

export async function index(request, response) {
  const result = await listNotices(request.query, request.authorization);
  response.render('notices/index', {
    title: 'Notices',
    activePage: 'notices',
    ...result,
    canManage: canManageNotices(request.authorization),
    message: message(request.query),
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function create(request, response) {
  if (!canManageNotices(request.authorization)) throw denied();
  await renderForm(response);
}

export async function store(request, response) {
  const { data, values, errors } = validateNotice(request.body);
  if (Object.keys(errors).length) return renderForm(response, { values, errors, formMessage: 'Please check the notice details.', status: 422 });
  try {
    const notice = await createNotice(data, request.authorization);
    response.redirect(303, `/notices/${notice.id}?created=1`);
  } catch (error) {
    return handleFormError(response, error, values);
  }
}

export async function show(request, response, next) {
  const notice = await getNotice(request.params.id);
  if (!notice || !await canAccessNotice(request.authorization, notice)) return next(notFound());
  response.render('notices/show', {
    title: notice.title,
    activePage: 'notices',
    notice,
    canManage: canManageNotices(request.authorization),
    message: message(request.query),
  });
}

export async function edit(request, response, next) {
  const notice = await getNotice(request.params.id);
  if (!notice) return next(notFound());
  if (!canManageNotices(request.authorization)) throw denied();
  await renderForm(response, { notice });
}

export async function update(request, response, next) {
  const notice = await getNotice(request.params.id);
  if (!notice) return next(notFound());
  if (!canManageNotices(request.authorization)) throw denied();
  const { data, values, errors } = validateNotice(request.body);
  if (Object.keys(errors).length) return renderForm(response, { notice, values, errors, formMessage: 'Please check the notice details.', status: 422 });
  try {
    await updateNotice(notice, data, request.authorization);
    response.redirect(303, `/notices/${notice.id}?updated=1`);
  } catch (error) {
    return handleFormError(response, error, values, notice);
  }
}
