import { validateStudent, studentFormValues } from '../validators/student.validator.js';
import {
  StudentFormError,
  canAccessStudent,
  canManageStudents,
  createStudent,
  getStudent,
  listStudentFormOptions,
  listStudents,
  setStudentStatus,
  updateStudent,
} from '../services/student.service.js';

const notFound = () => Object.assign(new Error('Student not found'), { status: 404 });
const denied = (status = 403) => Object.assign(new Error('Access denied'), { status });

function message(query) {
  return query.created ? 'Student created.' : query.updated ? 'Student updated.' : query.status ? 'Student status updated.' : null;
}

function pageUrl(request, page) {
  const params = new URLSearchParams(request.query);
  params.set('page', String(page));
  return `${request.path}?${params.toString()}`;
}

async function renderForm(response, { student = null, values, errors = {}, message = null, status = 200 } = {}) {
  response.status(status).render('students/form', {
    title: student ? 'Edit student' : 'New student',
    activePage: 'students',
    student,
    values: values ?? studentFormValues(student),
    errors,
    message,
    formOptions: await listStudentFormOptions(),
  });
}

function handleFormError(response, error, values, student = null) {
  if (error instanceof StudentFormError) {
    return renderForm(response, { student, values, errors: error.errors, message: error.message, status: error.status });
  }
  throw error;
}

export async function index(request, response) {
  const result = await listStudents(request.query, request.authorization);
  response.render('students/index', {
    title: 'Students',
    activePage: 'students',
    ...result,
    classes: (await listStudentFormOptions()).classes,
    canManage: canManageStudents(request.authorization),
    message: message(request.query),
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function create(request, response) {
  if (!canManageStudents(request.authorization)) throw denied();
  await renderForm(response, { values: studentFormValues() });
}

export async function store(request, response) {
  if (!canManageStudents(request.authorization)) throw denied();
  const { data, values, errors } = validateStudent(request.body);
  if (Object.keys(errors).length) return renderForm(response, { values, errors, message: 'Please check the student details.', status: 422 });
  try {
    await createStudent(data);
    response.redirect(303, '/students?created=1');
  } catch (error) {
    return handleFormError(response, error, values);
  }
}

export async function show(request, response, next) {
  const student = await getStudent(request.params.id);
  if (!student || !canAccessStudent(request.authorization, student)) return next(notFound());
  response.render('students/show', {
    title: `${student.firstName} ${student.lastName}`,
    activePage: 'students',
    student,
    canManage: canManageStudents(request.authorization),
  });
}

export async function edit(request, response, next) {
  if (!canManageStudents(request.authorization)) throw denied();
  const student = await getStudent(request.params.id);
  if (!student) return next(notFound());
  await renderForm(response, { student });
}

export async function update(request, response, next) {
  if (!canManageStudents(request.authorization)) throw denied();
  const student = await getStudent(request.params.id);
  if (!student) return next(notFound());
  const { data, values, errors } = validateStudent(request.body);
  if (Object.keys(errors).length) return renderForm(response, { student, values, errors, message: 'Please check the student details.', status: 422 });
  try {
    await updateStudent(student, data);
    response.redirect(303, `/students/${student.id}?updated=1`);
  } catch (error) {
    return handleFormError(response, error, values, student);
  }
}

export async function status(request, response, next) {
  if (!canManageStudents(request.authorization)) throw denied();
  const student = await getStudent(request.params.id);
  if (!student) return next(notFound());
  await setStudentStatus(student, request.body.status);
  response.redirect(303, `/students/${student.id}?status=1`);
}
