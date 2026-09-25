import { enrollmentFormValues, validateEnrollment } from '../validators/enrollment.validator.js';
import {
  EnrollmentFormError,
  canAccessEnrollment,
  canManageEnrollments,
  createEnrollment,
  getEnrollment,
  listClassStudents,
  listEnrollmentFormOptions,
  listEnrollments,
  listStudentEnrollmentHistory,
  updateEnrollment,
} from '../services/enrollment.service.js';

const notFound = () => Object.assign(new Error('Enrollment not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function message(query) {
  return query.created ? 'Enrollment created.' : query.updated ? 'Enrollment updated.' : null;
}

function pageUrl(request, page) {
  const params = new URLSearchParams(request.query);
  params.set('page', String(page));
  return `${request.path}?${params.toString()}`;
}

async function renderForm(response, { enrollment = null, values, errors = {}, message = null, status = 200 } = {}) {
  response.status(status).render('enrollments/form', {
    title: enrollment ? 'Edit enrollment' : 'New enrollment',
    activePage: 'enrollments',
    enrollment,
    values: values ?? enrollmentFormValues(enrollment),
    errors,
    message,
    formOptions: await listEnrollmentFormOptions(),
  });
}

function handleFormError(response, error, values, enrollment = null) {
  if (error instanceof EnrollmentFormError) {
    return renderForm(response, { enrollment, values, errors: error.errors, message: error.message, status: error.status });
  }
  throw error;
}

export async function index(request, response) {
  const result = await listEnrollments(request.query, request.authorization);
  const formOptions = await listEnrollmentFormOptions();
  response.render('enrollments/index', {
    title: 'Enrollments',
    activePage: 'enrollments',
    ...result,
    formOptions,
    canManage: canManageEnrollments(request.authorization),
    message: message(request.query),
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function create(request, response) {
  if (!canManageEnrollments(request.authorization)) throw denied();
  await renderForm(response, { values: enrollmentFormValues() });
}

export async function store(request, response) {
  if (!canManageEnrollments(request.authorization)) throw denied();
  const { data, values, errors } = validateEnrollment(request.body);
  if (Object.keys(errors).length) return renderForm(response, { values, errors, message: 'Please check the enrollment details.', status: 422 });
  try {
    await createEnrollment(data);
    response.redirect(303, '/enrollments?created=1');
  } catch (error) {
    return handleFormError(response, error, values);
  }
}

export async function show(request, response, next) {
  const enrollment = await getEnrollment(request.params.id);
  if (!enrollment || !await canAccessEnrollment(request.authorization, enrollment)) return next(notFound());
  response.render('enrollments/show', {
    title: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
    activePage: 'enrollments',
    enrollment,
    canManage: canManageEnrollments(request.authorization),
  });
}

export async function edit(request, response, next) {
  if (!canManageEnrollments(request.authorization)) throw denied();
  const enrollment = await getEnrollment(request.params.id);
  if (!enrollment) return next(notFound());
  await renderForm(response, { enrollment });
}

export async function update(request, response, next) {
  if (!canManageEnrollments(request.authorization)) throw denied();
  const enrollment = await getEnrollment(request.params.id);
  if (!enrollment) return next(notFound());
  const { data, values, errors } = validateEnrollment(request.body);
  if (Object.keys(errors).length) return renderForm(response, { enrollment, values, errors, message: 'Please check the enrollment details.', status: 422 });
  try {
    await updateEnrollment(enrollment, data);
    response.redirect(303, `/enrollments/${enrollment.id}?updated=1`);
  } catch (error) {
    return handleFormError(response, error, values, enrollment);
  }
}

export async function classStudents(request, response, next) {
  const result = await listClassStudents(request.params.classId, request.query, request.authorization);
  if (!result) return next(notFound());
  response.render('enrollments/class-students', {
    title: `${result.schoolClass.name} students`,
    activePage: 'enrollments',
    ...result,
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function studentHistory(request, response, next) {
  const result = await listStudentEnrollmentHistory(request.params.studentId, request.authorization);
  if (!result) return next(notFound());
  response.render('enrollments/student-history', {
    title: `${result.student.firstName} ${result.student.lastName} enrollment history`,
    activePage: 'enrollments',
    ...result,
  });
}
