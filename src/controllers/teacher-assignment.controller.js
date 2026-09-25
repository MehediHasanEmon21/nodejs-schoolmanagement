import { teacherAssignmentFormValues, validateTeacherAssignment } from '../validators/teacher-assignment.validator.js';
import {
  TeacherAssignmentFormError,
  canAccessTeacherAssignment,
  canManageTeacherAssignments,
  createTeacherAssignment,
  getTeacherAssignment,
  listClassSubjectTeachers,
  listTeacherAssignmentFormOptions,
  listTeacherAssignmentHistory,
  listTeacherAssignments,
  updateTeacherAssignment,
} from '../services/teacher-assignment.service.js';

const notFound = () => Object.assign(new Error('Teacher assignment not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function message(query) {
  return query.created ? 'Teacher assignment created.' : query.updated ? 'Teacher assignment updated.' : null;
}

function pageUrl(request, page) {
  const params = new URLSearchParams(request.query);
  params.set('page', String(page));
  return `${request.path}?${params.toString()}`;
}

async function renderForm(response, { assignment = null, values, errors = {}, message: formMessage = null, status = 200 } = {}) {
  response.status(status).render('teacher-assignments/form', {
    title: assignment ? 'Edit teacher assignment' : 'New teacher assignment',
    activePage: 'teacher-assignments',
    assignment,
    values: values ?? teacherAssignmentFormValues(assignment),
    errors,
    message: formMessage,
    formOptions: await listTeacherAssignmentFormOptions(),
  });
}

function handleFormError(response, error, values, assignment = null) {
  if (error instanceof TeacherAssignmentFormError) {
    return renderForm(response, { assignment, values, errors: error.errors, message: error.message, status: error.status });
  }
  throw error;
}

export async function index(request, response) {
  const result = await listTeacherAssignments(request.query, request.authorization);
  const formOptions = await listTeacherAssignmentFormOptions();
  response.render('teacher-assignments/index', {
    title: 'Teacher assignments',
    activePage: 'teacher-assignments',
    ...result,
    formOptions,
    canManage: canManageTeacherAssignments(request.authorization),
    message: message(request.query),
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function create(request, response) {
  if (!canManageTeacherAssignments(request.authorization)) throw denied();
  await renderForm(response, { values: teacherAssignmentFormValues() });
}

export async function store(request, response) {
  if (!canManageTeacherAssignments(request.authorization)) throw denied();
  const { data, values, errors } = validateTeacherAssignment(request.body);
  if (Object.keys(errors).length) return renderForm(response, { values, errors, message: 'Please check the assignment details.', status: 422 });
  try {
    await createTeacherAssignment(data);
    response.redirect(303, '/teacher-assignments?created=1');
  } catch (error) {
    return handleFormError(response, error, values);
  }
}

export async function show(request, response, next) {
  const assignment = await getTeacherAssignment(request.params.id);
  if (!assignment || !await canAccessTeacherAssignment(request.authorization, assignment)) return next(notFound());
  response.render('teacher-assignments/show', {
    title: `${assignment.teacher.name} assignment`,
    activePage: 'teacher-assignments',
    assignment,
    canManage: canManageTeacherAssignments(request.authorization),
  });
}

export async function edit(request, response, next) {
  if (!canManageTeacherAssignments(request.authorization)) throw denied();
  const assignment = await getTeacherAssignment(request.params.id);
  if (!assignment) return next(notFound());
  await renderForm(response, { assignment });
}

export async function update(request, response, next) {
  if (!canManageTeacherAssignments(request.authorization)) throw denied();
  const assignment = await getTeacherAssignment(request.params.id);
  if (!assignment) return next(notFound());
  const { data, values, errors } = validateTeacherAssignment(request.body);
  if (Object.keys(errors).length) return renderForm(response, { assignment, values, errors, message: 'Please check the assignment details.', status: 422 });
  try {
    await updateTeacherAssignment(assignment, data);
    response.redirect(303, `/teacher-assignments/${assignment.id}?updated=1`);
  } catch (error) {
    return handleFormError(response, error, values, assignment);
  }
}

export async function classAssignments(request, response, next) {
  const result = await listClassSubjectTeachers(request.params.classId, request.query, request.authorization);
  if (!result) return next(notFound());
  response.render('teacher-assignments/class', {
    title: `${result.schoolClass.name} subject teachers`,
    activePage: 'teacher-assignments',
    ...result,
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function teacherAssignments(request, response, next) {
  const result = await listTeacherAssignmentHistory(request.params.teacherId, request.query, request.authorization);
  if (!result) return next(notFound());
  response.render('teacher-assignments/teacher', {
    title: `${result.teacher.name} assignments`,
    activePage: 'teacher-assignments',
    ...result,
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}
