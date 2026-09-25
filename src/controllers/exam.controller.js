import { examFormValues, validateExam } from '../validators/exam.validator.js';
import {
  ExamFormError,
  canManageExams,
  canViewExams,
  createExam,
  getExam,
  listExamFormOptions,
  listExams,
  updateExam,
} from '../services/exam.service.js';

const notFound = () => Object.assign(new Error('Exam not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function message(query) {
  return query.created ? 'Exam created.' : query.updated ? 'Exam updated.' : null;
}

function pageUrl(request, page) {
  const params = new URLSearchParams(request.query);
  params.set('page', String(page));
  return `${request.path}?${params.toString()}`;
}

async function renderForm(response, { exam = null, values, errors = {}, message: formMessage = null, status = 200 } = {}) {
  response.status(status).render('exams/form', {
    title: exam ? 'Edit exam' : 'New exam',
    activePage: 'exams',
    exam,
    values: values ?? examFormValues(exam),
    errors,
    message: formMessage,
    formOptions: await listExamFormOptions(),
  });
}

function handleFormError(response, error, values, exam = null) {
  if (error instanceof ExamFormError) {
    return renderForm(response, { exam, values, errors: error.errors, message: error.message, status: error.status });
  }
  throw error;
}

export async function index(request, response) {
  if (!canViewExams(request.authorization)) throw denied();
  const result = await listExams(request.query, request.authorization);
  response.render('exams/index', {
    title: 'Exams',
    activePage: 'exams',
    ...result,
    formOptions: await listExamFormOptions(),
    canManage: canManageExams(request.authorization),
    message: message(request.query),
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function create(request, response) {
  if (!canManageExams(request.authorization)) throw denied();
  await renderForm(response, { values: { ...examFormValues(), subjects: [{ subject: '', totalMarks: '100', passMarks: '33', examDate: '' }] } });
}

export async function store(request, response) {
  if (!canManageExams(request.authorization)) throw denied();
  const { data, values, errors } = validateExam(request.body);
  if (Object.keys(errors).length) return renderForm(response, { values, errors, message: 'Please check the exam details.', status: 422 });
  try {
    await createExam(data);
    response.redirect(303, '/exams?created=1');
  } catch (error) {
    return handleFormError(response, error, values);
  }
}

export async function show(request, response, next) {
  if (!canViewExams(request.authorization)) throw denied();
  const exam = await getExam(request.params.id);
  if (!exam) return next(notFound());
  response.render('exams/show', { title: exam.name, activePage: 'exams', exam, canManage: canManageExams(request.authorization) });
}

export async function edit(request, response, next) {
  if (!canManageExams(request.authorization)) throw denied();
  const exam = await getExam(request.params.id);
  if (!exam) return next(notFound());
  await renderForm(response, { exam });
}

export async function update(request, response, next) {
  if (!canManageExams(request.authorization)) throw denied();
  const exam = await getExam(request.params.id);
  if (!exam) return next(notFound());
  const { data, values, errors } = validateExam(request.body);
  if (Object.keys(errors).length) return renderForm(response, { exam, values, errors, message: 'Please check the exam details.', status: 422 });
  try {
    await updateExam(exam, data);
    response.redirect(303, `/exams/${exam.id}?updated=1`);
  } catch (error) {
    return handleFormError(response, error, values, exam);
  }
}
