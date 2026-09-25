import { timetableFormValues, validateTimetableEntry } from '../validators/timetable.validator.js';
import {
  TimetableFormError,
  canAccessTimetableEntry,
  canManageTimetable,
  createTimetableEntry,
  getTimetableEntry,
  listTimetable,
  listTimetableFormOptions,
  updateTimetableEntry,
} from '../services/timetable.service.js';

const notFound = () => Object.assign(new Error('Timetable entry not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function message(query) {
  return query.created ? 'Timetable entry created.' : query.updated ? 'Timetable entry updated.' : null;
}

async function renderForm(response, { entry = null, values, errors = {}, formMessage = null, status = 200 } = {}) {
  response.status(status).render('timetable/form', {
    title: entry ? 'Edit timetable entry' : 'New timetable entry',
    activePage: 'timetable',
    entry,
    values: values ?? timetableFormValues(entry),
    errors,
    message: formMessage,
    formOptions: await listTimetableFormOptions(),
  });
}

function handleFormError(response, error, values, entry = null) {
  if (error instanceof TimetableFormError) {
    return renderForm(response, { entry, values, errors: error.errors, formMessage: error.message, status: error.status });
  }
  throw error;
}

export async function index(request, response) {
  const result = await listTimetable(request.query, request.authorization);
  response.render('timetable/index', {
    title: 'Timetable',
    activePage: 'timetable',
    ...result,
    formOptions: await listTimetableFormOptions(),
    canManage: canManageTimetable(request.authorization),
    message: message(request.query),
  });
}

export async function create(request, response) {
  if (!canManageTimetable(request.authorization)) throw denied();
  await renderForm(response);
}

export async function store(request, response) {
  const { data, values, errors } = validateTimetableEntry(request.body);
  if (Object.keys(errors).length) return renderForm(response, { values, errors, formMessage: 'Please check the timetable details.', status: 422 });
  try {
    const entry = await createTimetableEntry(data, request.authorization);
    response.redirect(303, `/timetable/${entry.id}?created=1`);
  } catch (error) {
    return handleFormError(response, error, values);
  }
}

export async function show(request, response, next) {
  const entry = await getTimetableEntry(request.params.id);
  if (!entry || !await canAccessTimetableEntry(request.authorization, entry)) return next(notFound());
  response.render('timetable/show', {
    title: `${entry.subject.name} timetable`,
    activePage: 'timetable',
    entry,
    canManage: canManageTimetable(request.authorization),
    message: message(request.query),
  });
}

export async function edit(request, response, next) {
  const entry = await getTimetableEntry(request.params.id);
  if (!entry) return next(notFound());
  if (!canManageTimetable(request.authorization)) throw denied();
  await renderForm(response, { entry });
}

export async function update(request, response, next) {
  const entry = await getTimetableEntry(request.params.id);
  if (!entry) return next(notFound());
  if (!canManageTimetable(request.authorization)) throw denied();
  const { data, values, errors } = validateTimetableEntry(request.body);
  if (Object.keys(errors).length) return renderForm(response, { entry, values, errors, formMessage: 'Please check the timetable details.', status: 422 });
  try {
    await updateTimetableEntry(entry, data, request.authorization);
    response.redirect(303, `/timetable/${entry.id}?updated=1`);
  } catch (error) {
    return handleFormError(response, error, values, entry);
  }
}
