import { validateTeacher, teacherFormValues } from '../validators/teacher.validator.js';
import {
  TeacherFormError,
  canAccessTeacher,
  canManageTeachers,
  createTeacher,
  getTeacher,
  listTeacherFormOptions,
  listTeachers,
  setTeacherStatus,
  updateTeacher,
} from '../services/teacher.service.js';

const notFound = () => Object.assign(new Error('Teacher not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function message(query) {
  return query.created ? 'Teacher created.' : query.updated ? 'Teacher updated.' : query.status ? 'Teacher status updated.' : null;
}

function pageUrl(request, page) {
  const params = new URLSearchParams(request.query);
  params.set('page', String(page));
  return `${request.path}?${params.toString()}`;
}

async function renderForm(response, { teacher = null, values, errors = {}, message = null, status = 200 } = {}) {
  response.status(status).render('teachers/form', {
    title: teacher ? 'Edit teacher' : 'New teacher',
    activePage: 'teachers',
    teacher,
    values: values ?? teacherFormValues(teacher),
    errors,
    message,
    formOptions: await listTeacherFormOptions(),
  });
}

function handleFormError(response, error, values, teacher = null) {
  if (error instanceof TeacherFormError) {
    return renderForm(response, { teacher, values, errors: error.errors, message: error.message, status: error.status });
  }
  throw error;
}

export async function index(request, response) {
  const result = await listTeachers(request.query, request.authorization);
  response.render('teachers/index', {
    title: 'Teachers',
    activePage: 'teachers',
    ...result,
    canManage: canManageTeachers(request.authorization),
    message: message(request.query),
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function create(request, response) {
  if (!canManageTeachers(request.authorization)) throw denied();
  await renderForm(response, { values: teacherFormValues() });
}

export async function store(request, response) {
  if (!canManageTeachers(request.authorization)) throw denied();
  const { data, values, errors } = validateTeacher(request.body);
  if (Object.keys(errors).length) return renderForm(response, { values, errors, message: 'Please check the teacher details.', status: 422 });
  try {
    await createTeacher(data);
    response.redirect(303, '/teachers?created=1');
  } catch (error) {
    return handleFormError(response, error, values);
  }
}

export async function show(request, response, next) {
  const teacher = await getTeacher(request.params.id);
  if (!teacher || !canAccessTeacher(request.authorization, teacher)) return next(notFound());
  response.render('teachers/show', {
    title: teacher.name,
    activePage: 'teachers',
    teacher,
    canManage: canManageTeachers(request.authorization),
  });
}

export async function edit(request, response, next) {
  if (!canManageTeachers(request.authorization)) throw denied();
  const teacher = await getTeacher(request.params.id);
  if (!teacher) return next(notFound());
  await renderForm(response, { teacher });
}

export async function update(request, response, next) {
  if (!canManageTeachers(request.authorization)) throw denied();
  const teacher = await getTeacher(request.params.id);
  if (!teacher) return next(notFound());
  const { data, values, errors } = validateTeacher(request.body);
  if (Object.keys(errors).length) return renderForm(response, { teacher, values, errors, message: 'Please check the teacher details.', status: 422 });
  try {
    await updateTeacher(teacher, data);
    response.redirect(303, `/teachers/${teacher.id}?updated=1`);
  } catch (error) {
    return handleFormError(response, error, values, teacher);
  }
}

export async function status(request, response, next) {
  if (!canManageTeachers(request.authorization)) throw denied();
  const teacher = await getTeacher(request.params.id);
  if (!teacher) return next(notFound());
  await setTeacherStatus(teacher, request.body.status);
  response.redirect(303, `/teachers/${teacher.id}?status=1`);
}
