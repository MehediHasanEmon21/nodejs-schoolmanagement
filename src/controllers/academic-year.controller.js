import { validateAcademicYear } from '../validators/academic-year.validator.js';
import {
  AcademicYearFormError,
  academicYearFormValues,
  activateAcademicYear,
  createAcademicYear,
  getAcademicYear,
  listAcademicYears,
  updateAcademicYear,
} from '../services/academic-year.service.js';

const notFound = () => Object.assign(new Error('Academic year not found'), { status: 404 });

function renderForm(response, { academicYear = null, values, errors = {}, message = null, status = 200 } = {}) {
  response.status(status).render('academic-years/form', {
    title: academicYear ? 'Edit academic year' : 'New academic year',
    activePage: 'academic-years',
    academicYear,
    values: values ?? academicYearFormValues(academicYear),
    errors,
    message,
  });
}

export async function index(request, response) {
  response.render('academic-years/index', {
    title: 'Academic years',
    activePage: 'academic-years',
    academicYears: await listAcademicYears(),
    message: request.query.created ? 'Academic year created.' :
      request.query.updated ? 'Academic year updated.' :
        request.query.current ? 'Current academic year updated.' : null,
  });
}

export function create(request, response) {
  renderForm(response, { values: academicYearFormValues() });
}

export async function store(request, response) {
  const { data, values, errors } = validateAcademicYear(request.body);
  if (Object.keys(errors).length) return renderForm(response, { values, errors, message: 'Please check the academic year details.', status: 422 });
  try {
    await createAcademicYear(data);
    response.redirect(303, '/academic-years?created=1');
  } catch (error) {
    if (error instanceof AcademicYearFormError) {
      return renderForm(response, { values, errors: error.errors, message: error.message, status: error.status });
    }
    throw error;
  }
}

export async function show(request, response, next) {
  const academicYear = await getAcademicYear(request.params.id);
  if (!academicYear) return next(notFound());
  response.render('academic-years/show', {
    title: academicYear.name,
    activePage: 'academic-years',
    academicYear,
  });
}

export async function edit(request, response, next) {
  const academicYear = await getAcademicYear(request.params.id);
  if (!academicYear) return next(notFound());
  renderForm(response, { academicYear });
}

export async function update(request, response, next) {
  const academicYear = await getAcademicYear(request.params.id);
  if (!academicYear) return next(notFound());
  const { data, values, errors } = validateAcademicYear(request.body);
  if (Object.keys(errors).length) return renderForm(response, { academicYear, values, errors, message: 'Please check the academic year details.', status: 422 });
  try {
    await updateAcademicYear(academicYear, data);
    response.redirect(303, `/academic-years/${academicYear.id}?updated=1`);
  } catch (error) {
    if (error instanceof AcademicYearFormError) {
      return renderForm(response, { academicYear, values, errors: error.errors, message: error.message, status: error.status });
    }
    throw error;
  }
}

export async function activate(request, response, next) {
  const academicYear = await getAcademicYear(request.params.id);
  if (!academicYear) return next(notFound());
  try {
    await activateAcademicYear(academicYear);
    response.redirect(303, '/academic-years?current=1');
  } catch (error) {
    if (error instanceof AcademicYearFormError) {
      return renderForm(response, { academicYear, errors: error.errors, message: error.message, status: error.status });
    }
    throw error;
  }
}
