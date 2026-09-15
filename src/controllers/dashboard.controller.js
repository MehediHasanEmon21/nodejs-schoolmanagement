import { getDashboard } from '../services/dashboard.service.js';

export function showDashboard(request, response) {
  response.render('dashboard/index', {
    title: 'Dashboard', activePage: 'dashboard', dashboard: getDashboard(request.authorization),
  });
}
