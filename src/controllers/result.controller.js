import { markEntryValues, validateMarkEntry, validateMarkSelection } from '../validators/result.validator.js';
import {
  ResultFormError,
  canEnterMarks,
  classResult,
  listResultFormOptions,
  loadMarkRoster,
  saveMarks,
  studentResult,
} from '../services/result.service.js';

const notFound = () => Object.assign(new Error('Result not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

async function renderEntry(response, { values, errors = {}, message = null, loaded = null, status = 200 } = {}) {
  response.status(status).render('results/entry', {
    title: 'Marks entry',
    activePage: 'results',
    values: values ?? markEntryValues(),
    errors,
    message,
    loaded,
    formOptions: await listResultFormOptions(),
  });
}

export async function index(request, response) {
  response.render('results/index', {
    title: 'Results',
    activePage: 'results',
    formOptions: await listResultFormOptions(),
    message: request.query.saved ? 'Marks saved.' : null,
  });
}

export async function entry(request, response) {
  const { data, values, errors } = validateMarkSelection(request.query);
  let loaded = null;
  if (!Object.keys(errors).length && values.exam && values.subject) {
    loaded = await loadMarkRoster(data, request.authorization);
    if (!loaded) throw denied();
  }
  await renderEntry(response, { values: markEntryValues(values), loaded });
}

export async function store(request, response) {
  const { data, values, errors } = validateMarkEntry(request.body);
  let loaded = null;
  if (!Object.keys(errors).length) loaded = await loadMarkRoster(data, request.authorization);
  if (Object.keys(errors).length) return renderEntry(response, { values, errors, message: 'Please check the marks.', loaded, status: 422 });
  try {
    loaded = await saveMarks(data, request.authorization);
    response.redirect(303, `/results/entry?exam=${loaded.exam.id}&subject=${data.subject}&saved=1`);
  } catch (error) {
    if (error instanceof ResultFormError) {
      return renderEntry(response, { values, errors: error.errors, message: error.message, loaded, status: error.status });
    }
    throw error;
  }
}

export async function student(request, response, next) {
  const result = await studentResult(request.params.examId, request.params.studentId, request.authorization);
  if (!result) return next(notFound());
  response.render('results/student', { title: `${result.student.firstName} result`, activePage: 'results', ...result });
}

export async function classView(request, response, next) {
  const result = await classResult(request.params.examId, request.authorization);
  if (!result) return next(notFound());
  response.render('results/class', { title: `${result.exam.class.name} result`, activePage: 'results', ...result });
}

export async function redirectToEntry(request, response, next) {
  const { data, errors } = validateMarkSelection(request.query);
  if (Object.keys(errors).length) return response.redirect(303, '/results/entry');
  const loaded = await loadMarkRoster(data, request.authorization);
  if (!loaded || !await canEnterMarks(request.authorization, loaded.exam, data.subject)) return next(notFound());
  response.redirect(303, `/results/entry?exam=${data.exam}&subject=${data.subject}`);
}
