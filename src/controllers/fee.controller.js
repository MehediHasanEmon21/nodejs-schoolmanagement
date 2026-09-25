import { feeTypeFormValues, studentFeeFormValues, validateFeeType, validateStudentFee } from '../validators/fee.validator.js';
import {
  FeeFormError,
  canAccessStudentFee,
  canManageFees,
  createFeeType,
  createStudentFee,
  feeSummary,
  getFeeType,
  getStudentFee,
  listFeeFormOptions,
  listFeeTypes,
  listStudentFees,
  updateFeeType,
  updateStudentFee,
} from '../services/fee.service.js';

const notFound = () => Object.assign(new Error('Fee record not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function pageUrl(request, page) {
  const params = new URLSearchParams(request.query);
  params.set('page', String(page));
  return `${request.path}?${params.toString()}`;
}

function message(query) {
  return query.created ? 'Fee created.' : query.updated ? 'Fee updated.' : query.typeCreated ? 'Fee type created.' : query.typeUpdated ? 'Fee type updated.' : null;
}

async function renderStudentFeeForm(response, { fee = null, values, errors = {}, message: formMessage = null, status = 200 } = {}) {
  response.status(status).render('fees/form', {
    title: fee ? 'Edit student fee' : 'Assign student fee',
    activePage: 'fees',
    fee,
    values: values ?? studentFeeFormValues(fee),
    errors,
    message: formMessage,
    formOptions: await listFeeFormOptions(),
  });
}

function renderFeeTypeForm(response, { feeType = null, values, errors = {}, message: formMessage = null, status = 200 } = {}) {
  response.status(status).render('fees/type-form', {
    title: feeType ? 'Edit fee type' : 'New fee type',
    activePage: 'fees',
    feeType,
    values: values ?? feeTypeFormValues(feeType),
    errors,
    message: formMessage,
  });
}

export async function index(request, response) {
  const result = await listStudentFees(request.query, request.authorization);
  response.render('fees/index', {
    title: 'Fees',
    activePage: 'fees',
    ...result,
    formOptions: await listFeeFormOptions(),
    canManage: canManageFees(request.authorization),
    message: message(request.query),
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function show(request, response, next) {
  const fee = await getStudentFee(request.params.id);
  if (!fee || !await canAccessStudentFee(request.authorization, fee)) return next(notFound());
  response.render('fees/show', { title: fee.feeType.name, activePage: 'fees', fee, summary: feeSummary(fee), canManage: canManageFees(request.authorization) });
}

export async function create(request, response) {
  if (!canManageFees(request.authorization)) throw denied();
  await renderStudentFeeForm(response, { values: studentFeeFormValues() });
}

export async function store(request, response) {
  if (!canManageFees(request.authorization)) throw denied();
  const { data, values, errors } = validateStudentFee(request.body);
  if (Object.keys(errors).length) return renderStudentFeeForm(response, { values, errors, message: 'Please check the fee details.', status: 422 });
  try {
    await createStudentFee(data, request.authorization);
    response.redirect(303, '/fees?created=1');
  } catch (error) {
    if (error instanceof FeeFormError) return renderStudentFeeForm(response, { values, errors: error.errors, message: error.message, status: error.status });
    throw error;
  }
}

export async function edit(request, response, next) {
  if (!canManageFees(request.authorization)) throw denied();
  const fee = await getStudentFee(request.params.id);
  if (!fee) return next(notFound());
  await renderStudentFeeForm(response, { fee });
}

export async function update(request, response, next) {
  if (!canManageFees(request.authorization)) throw denied();
  const fee = await getStudentFee(request.params.id);
  if (!fee) return next(notFound());
  const { data, values, errors } = validateStudentFee(request.body);
  if (Object.keys(errors).length) return renderStudentFeeForm(response, { fee, values, errors, message: 'Please check the fee details.', status: 422 });
  try {
    await updateStudentFee(fee, data, request.authorization);
    response.redirect(303, `/fees/${fee.id}?updated=1`);
  } catch (error) {
    if (error instanceof FeeFormError) return renderStudentFeeForm(response, { fee, values, errors: error.errors, message: error.message, status: error.status });
    throw error;
  }
}

export async function types(request, response) {
  if (!canManageFees(request.authorization)) throw denied();
  response.render('fees/types', { title: 'Fee types', activePage: 'fees', records: await listFeeTypes(), message: message(request.query) });
}

export function typeCreate(request, response) {
  if (!canManageFees(request.authorization)) throw denied();
  renderFeeTypeForm(response, { values: feeTypeFormValues() });
}

export async function typeStore(request, response) {
  if (!canManageFees(request.authorization)) throw denied();
  const { data, values, errors } = validateFeeType(request.body);
  if (Object.keys(errors).length) return renderFeeTypeForm(response, { values, errors, message: 'Please check the fee type details.', status: 422 });
  try {
    await createFeeType(data);
    response.redirect(303, '/fees/types?typeCreated=1');
  } catch (error) {
    if (error instanceof FeeFormError) return renderFeeTypeForm(response, { values, errors: error.errors, message: error.message, status: error.status });
    throw error;
  }
}

export async function typeEdit(request, response, next) {
  if (!canManageFees(request.authorization)) throw denied();
  const feeType = await getFeeType(request.params.id);
  if (!feeType) return next(notFound());
  renderFeeTypeForm(response, { feeType });
}

export async function typeUpdate(request, response, next) {
  if (!canManageFees(request.authorization)) throw denied();
  const feeType = await getFeeType(request.params.id);
  if (!feeType) return next(notFound());
  const { data, values, errors } = validateFeeType(request.body);
  if (Object.keys(errors).length) return renderFeeTypeForm(response, { feeType, values, errors, message: 'Please check the fee type details.', status: 422 });
  try {
    await updateFeeType(feeType, data);
    response.redirect(303, '/fees/types?typeUpdated=1');
  } catch (error) {
    if (error instanceof FeeFormError) return renderFeeTypeForm(response, { feeType, values, errors: error.errors, message: error.message, status: error.status });
    throw error;
  }
}
