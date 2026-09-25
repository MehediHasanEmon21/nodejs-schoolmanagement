import { validateGuardian, guardianFormValues } from '../validators/guardian.validator.js';
import {
  GuardianFormError,
  canAccessGuardian,
  canManageGuardians,
  createGuardian,
  getGuardian,
  listGuardianFormOptions,
  listGuardians,
  setGuardianStatus,
  updateGuardian,
} from '../services/guardian.service.js';

const notFound = () => Object.assign(new Error('Guardian not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function message(query) {
  return query.created ? 'Guardian created.' : query.updated ? 'Guardian updated.' : query.status ? 'Guardian status updated.' : null;
}

function pageUrl(request, page) {
  const params = new URLSearchParams(request.query);
  params.set('page', String(page));
  return `${request.path}?${params.toString()}`;
}

async function renderForm(response, { guardian = null, values, errors = {}, message = null, status = 200 } = {}) {
  response.status(status).render('guardians/form', {
    title: guardian ? 'Edit guardian' : 'New guardian',
    activePage: 'guardians',
    guardian,
    values: values ?? guardianFormValues(guardian),
    errors,
    message,
    formOptions: await listGuardianFormOptions(),
  });
}

function handleFormError(response, error, values, guardian = null) {
  if (error instanceof GuardianFormError) {
    return renderForm(response, { guardian, values, errors: error.errors, message: error.message, status: error.status });
  }
  throw error;
}

export async function index(request, response) {
  const result = await listGuardians(request.query, request.authorization);
  response.render('guardians/index', {
    title: 'Guardians',
    activePage: 'guardians',
    ...result,
    canManage: canManageGuardians(request.authorization),
    message: message(request.query),
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function create(request, response) {
  if (!canManageGuardians(request.authorization)) throw denied();
  await renderForm(response, { values: guardianFormValues() });
}

export async function store(request, response) {
  if (!canManageGuardians(request.authorization)) throw denied();
  const { data, values, errors } = validateGuardian(request.body);
  if (Object.keys(errors).length) return renderForm(response, { values, errors, message: 'Please check the guardian details.', status: 422 });
  try {
    await createGuardian(data);
    response.redirect(303, '/guardians?created=1');
  } catch (error) {
    return handleFormError(response, error, values);
  }
}

export async function show(request, response, next) {
  const guardian = await getGuardian(request.params.id);
  if (!guardian || !canAccessGuardian(request.authorization, guardian)) return next(notFound());
  response.render('guardians/show', {
    title: guardian.name,
    activePage: 'guardians',
    guardian,
    canManage: canManageGuardians(request.authorization),
  });
}

export async function edit(request, response, next) {
  if (!canManageGuardians(request.authorization)) throw denied();
  const guardian = await getGuardian(request.params.id);
  if (!guardian) return next(notFound());
  await renderForm(response, { guardian });
}

export async function update(request, response, next) {
  if (!canManageGuardians(request.authorization)) throw denied();
  const guardian = await getGuardian(request.params.id);
  if (!guardian) return next(notFound());
  const { data, values, errors } = validateGuardian(request.body);
  if (Object.keys(errors).length) return renderForm(response, { guardian, values, errors, message: 'Please check the guardian details.', status: 422 });
  try {
    await updateGuardian(guardian, data);
    response.redirect(303, `/guardians/${guardian.id}?updated=1`);
  } catch (error) {
    return handleFormError(response, error, values, guardian);
  }
}

export async function status(request, response, next) {
  if (!canManageGuardians(request.authorization)) throw denied();
  const guardian = await getGuardian(request.params.id);
  if (!guardian) return next(notFound());
  await setGuardianStatus(guardian, request.body.status);
  response.redirect(303, `/guardians/${guardian.id}?status=1`);
}
