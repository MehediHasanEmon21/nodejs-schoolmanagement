import { attendanceReport, canViewReports, feeReport, resultReport, studentReport } from '../services/report.service.js';

const denied = () => Object.assign(new Error('Access denied'), { status: 403 });

function ensureAccess(request) {
  if (!canViewReports(request.authorization)) throw denied();
}

export function index(request, response) {
  ensureAccess(request);
  response.render('reports/index', { title: 'Reports', activePage: 'reports' });
}

export async function students(request, response) {
  ensureAccess(request);
  response.render('reports/students', { title: 'Student report', activePage: 'reports', ...(await studentReport(request.query)) });
}

export async function attendance(request, response) {
  ensureAccess(request);
  response.render('reports/attendance', { title: 'Attendance report', activePage: 'reports', ...(await attendanceReport(request.query)) });
}

export async function results(request, response) {
  ensureAccess(request);
  response.render('reports/results', { title: 'Result report', activePage: 'reports', ...(await resultReport(request.query)) });
}

export async function fees(request, response) {
  ensureAccess(request);
  response.render('reports/fees', { title: 'Fee report', activePage: 'reports', ...(await feeReport(request.query)) });
}
