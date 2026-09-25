import { attendanceFormValues, attendanceStatuses, validateAttendance, validateAttendanceSelection } from '../validators/attendance.validator.js';
import {
  AttendanceFormError,
  canAccessAttendance,
  canManageAttendance,
  canRecordAttendance,
  classAttendanceSummary,
  createAttendance,
  getAttendance,
  listAttendance,
  listAttendanceFormOptions,
  listStudentAttendanceHistory,
  loadAttendanceRoster,
  updateAttendance,
} from '../services/attendance.service.js';

const notFound = () => Object.assign(new Error('Attendance record not found'), { status: 404 });
const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function message(query) {
  return query.created ? 'Attendance recorded.' : query.updated ? 'Attendance updated.' : null;
}

function pageUrl(request, page) {
  const params = new URLSearchParams(request.query);
  params.set('page', String(page));
  return `${request.path}?${params.toString()}`;
}

async function renderForm(response, { attendance = null, values, errors = {}, message: formMessage = null, roster = [], status = 200 } = {}) {
  response.status(status).render('attendance/form', {
    title: attendance ? 'Edit attendance' : 'Record attendance',
    activePage: 'attendance',
    attendance,
    values: values ?? attendanceFormValues(attendance),
    errors,
    message: formMessage,
    roster,
    statuses: attendanceStatuses,
    formOptions: await listAttendanceFormOptions(),
  });
}

function handleFormError(response, error, values, attendance = null, roster = []) {
  if (error instanceof AttendanceFormError) {
    return renderForm(response, { attendance, values, errors: error.errors, message: error.message, roster, status: error.status });
  }
  throw error;
}

export async function index(request, response) {
  const result = await listAttendance(request.query, request.authorization);
  const formOptions = await listAttendanceFormOptions();
  response.render('attendance/index', {
    title: 'Attendance',
    activePage: 'attendance',
    ...result,
    formOptions,
    canManage: canManageAttendance(request.authorization),
    message: message(request.query),
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}

export async function create(request, response) {
  const { data, values, errors } = validateAttendanceSelection(request.query);
  let roster = [];
  let formMessage = null;
  if (!Object.keys(errors).length && values.academicYear && values.class && values.section) {
    roster = await loadAttendanceRoster(data, request.authorization);
    if (!roster) throw denied();
    if (!roster.length) formMessage = 'No active enrolled students were found for this class and section.';
  }
  await renderForm(response, { values: attendanceFormValues(null, values), errors: {}, message: formMessage, roster });
}

export async function store(request, response) {
  const { data, values, errors } = validateAttendance(request.body);
  let roster = [];
  if (!Object.keys(errors).length) roster = await loadAttendanceRoster(data, request.authorization) ?? [];
  if (Object.keys(errors).length) return renderForm(response, { values, errors, message: 'Please check the attendance details.', roster, status: 422 });
  try {
    const attendance = await createAttendance(data, request.authorization);
    response.redirect(303, `/attendance/${attendance.id}?created=1`);
  } catch (error) {
    return handleFormError(response, error, values, null, roster);
  }
}

export async function show(request, response, next) {
  const attendance = await getAttendance(request.params.id);
  if (!attendance || !await canAccessAttendance(request.authorization, attendance)) return next(notFound());
  response.render('attendance/show', {
    title: `${attendance.class.name} attendance`,
    activePage: 'attendance',
    attendance,
    canEdit: await canRecordAttendance(request.authorization, attendance),
  });
}

export async function edit(request, response, next) {
  const attendance = await getAttendance(request.params.id);
  if (!attendance) return next(notFound());
  if (!await canRecordAttendance(request.authorization, attendance)) throw denied();
  const roster = await loadAttendanceRoster({
    academicYear: attendance.academicYear._id,
    class: attendance.class._id,
    section: attendance.section._id,
    date: attendance.date,
  }, request.authorization);
  await renderForm(response, { attendance, values: attendanceFormValues(attendance), roster });
}

export async function update(request, response, next) {
  const attendance = await getAttendance(request.params.id);
  if (!attendance) return next(notFound());
  if (!await canRecordAttendance(request.authorization, attendance)) throw denied();
  const { data, values, errors } = validateAttendance(request.body);
  const roster = await loadAttendanceRoster({
    academicYear: attendance.academicYear._id,
    class: attendance.class._id,
    section: attendance.section._id,
    date: attendance.date,
  }, request.authorization) ?? [];
  if (Object.keys(errors).length) return renderForm(response, { attendance, values, errors, message: 'Please check the attendance details.', roster, status: 422 });
  try {
    await updateAttendance(attendance, data, request.authorization);
    response.redirect(303, `/attendance/${attendance.id}?updated=1`);
  } catch (error) {
    return handleFormError(response, error, values, attendance, roster);
  }
}

export async function studentHistory(request, response, next) {
  const result = await listStudentAttendanceHistory(request.params.studentId, request.authorization);
  if (!result) return next(notFound());
  response.render('attendance/student-history', { title: `${result.student.firstName} attendance`, activePage: 'attendance', ...result });
}

export async function classSummary(request, response, next) {
  const result = await classAttendanceSummary(request.params.classId, request.query, request.authorization);
  if (!result) return next(notFound());
  response.render('attendance/class-summary', {
    title: `${result.schoolClass.name} attendance`,
    activePage: 'attendance',
    ...result,
    previousUrl: result.filters.page > 1 ? pageUrl(request, result.filters.page - 1) : null,
    nextUrl: result.filters.page < result.totalPages ? pageUrl(request, result.filters.page + 1) : null,
  });
}
