import {
  validateSchoolClass,
  validateSection,
  validateSubject,
} from '../validators/academic-structure.validator.js';
import {
  AcademicStructureFormError,
  classFormValues,
  createClass,
  createSection,
  createSubject,
  getClass,
  getSection,
  getSubject,
  listClasses,
  listSections,
  listSubjects,
  sectionFormValues,
  subjectFormValues,
  updateClass,
  updateSection,
  updateSubject,
} from '../services/academic-structure.service.js';

const notFound = (resource) => Object.assign(new Error(`${resource} not found`), { status: 404 });
const message = (query) => query.created ? 'Record created.' : query.updated ? 'Record updated.' : null;

function handleFormError(response, render, error, values, record = null, classes = []) {
  if (error instanceof AcademicStructureFormError) {
    return render(response, { record, values, errors: error.errors, message: error.message, status: error.status, classes });
  }
  throw error;
}

function renderClassForm(response, { record = null, values, errors = {}, message = null, status = 200 } = {}) {
  response.status(status).render('academic-structure/class-form', {
    title: record ? 'Edit class' : 'New class', activePage: 'classes', record, values: values ?? classFormValues(record), errors, message,
  });
}

function renderSectionForm(response, { record = null, values, errors = {}, message = null, status = 200, classes = [] } = {}) {
  response.status(status).render('academic-structure/section-form', {
    title: record ? 'Edit section' : 'New section', activePage: 'sections', record, values: values ?? sectionFormValues(record), errors, message, classes,
  });
}

function renderSubjectForm(response, { record = null, values, errors = {}, message = null, status = 200, classes = [] } = {}) {
  response.status(status).render('academic-structure/subject-form', {
    title: record ? 'Edit subject' : 'New subject', activePage: 'subjects', record, values: values ?? subjectFormValues(record), errors, message, classes,
  });
}

export async function classesIndex(request, response) {
  response.render('academic-structure/classes', {
    title: 'Classes', activePage: 'classes', records: await listClasses(), message: message(request.query),
  });
}

export function classCreate(request, response) {
  renderClassForm(response, { values: classFormValues() });
}

export async function classStore(request, response) {
  const { data, values, errors } = validateSchoolClass(request.body);
  if (Object.keys(errors).length) return renderClassForm(response, { values, errors, message: 'Please check the class details.', status: 422 });
  try {
    await createClass(data);
    response.redirect(303, '/classes?created=1');
  } catch (error) {
    return handleFormError(response, renderClassForm, error, values);
  }
}

export async function classEdit(request, response, next) {
  const record = await getClass(request.params.id);
  if (!record) return next(notFound('Class'));
  renderClassForm(response, { record });
}

export async function classUpdate(request, response, next) {
  const record = await getClass(request.params.id);
  if (!record) return next(notFound('Class'));
  const { data, values, errors } = validateSchoolClass(request.body);
  if (Object.keys(errors).length) return renderClassForm(response, { record, values, errors, message: 'Please check the class details.', status: 422 });
  try {
    await updateClass(record, data);
    response.redirect(303, '/classes?updated=1');
  } catch (error) {
    return handleFormError(response, renderClassForm, error, values, record);
  }
}

export async function sectionsIndex(request, response) {
  response.render('academic-structure/sections', {
    title: 'Sections', activePage: 'sections', records: await listSections(), message: message(request.query),
  });
}

export async function sectionCreate(request, response) {
  renderSectionForm(response, { values: sectionFormValues(), classes: await listClasses() });
}

export async function sectionStore(request, response) {
  const classes = await listClasses();
  const { data, values, errors } = validateSection(request.body);
  if (Object.keys(errors).length) return renderSectionForm(response, { values, errors, message: 'Please check the section details.', status: 422, classes });
  try {
    await createSection(data);
    response.redirect(303, '/sections?created=1');
  } catch (error) {
    return handleFormError(response, renderSectionForm, error, values, null, classes);
  }
}

export async function sectionEdit(request, response, next) {
  const record = await getSection(request.params.id);
  if (!record) return next(notFound('Section'));
  renderSectionForm(response, { record, classes: await listClasses() });
}

export async function sectionUpdate(request, response, next) {
  const record = await getSection(request.params.id);
  if (!record) return next(notFound('Section'));
  const classes = await listClasses();
  const { data, values, errors } = validateSection(request.body);
  if (Object.keys(errors).length) return renderSectionForm(response, { record, values, errors, message: 'Please check the section details.', status: 422, classes });
  try {
    await updateSection(record, data);
    response.redirect(303, '/sections?updated=1');
  } catch (error) {
    return handleFormError(response, renderSectionForm, error, values, record, classes);
  }
}

export async function subjectsIndex(request, response) {
  response.render('academic-structure/subjects', {
    title: 'Subjects', activePage: 'subjects', records: await listSubjects(), message: message(request.query),
  });
}

export async function subjectCreate(request, response) {
  renderSubjectForm(response, { values: subjectFormValues(), classes: await listClasses() });
}

export async function subjectStore(request, response) {
  const classes = await listClasses();
  const { data, values, errors } = validateSubject(request.body);
  if (Object.keys(errors).length) return renderSubjectForm(response, { values, errors, message: 'Please check the subject details.', status: 422, classes });
  try {
    await createSubject(data);
    response.redirect(303, '/subjects?created=1');
  } catch (error) {
    return handleFormError(response, renderSubjectForm, error, values, null, classes);
  }
}

export async function subjectEdit(request, response, next) {
  const record = await getSubject(request.params.id);
  if (!record) return next(notFound('Subject'));
  renderSubjectForm(response, { record, classes: await listClasses() });
}

export async function subjectUpdate(request, response, next) {
  const record = await getSubject(request.params.id);
  if (!record) return next(notFound('Subject'));
  const classes = await listClasses();
  const { data, values, errors } = validateSubject(request.body);
  if (Object.keys(errors).length) return renderSubjectForm(response, { record, values, errors, message: 'Please check the subject details.', status: 422, classes });
  try {
    await updateSubject(record, data);
    response.redirect(303, '/subjects?updated=1');
  } catch (error) {
    return handleFormError(response, renderSubjectForm, error, values, record, classes);
  }
}
