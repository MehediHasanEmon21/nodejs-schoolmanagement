import { Router } from 'express';
import { attendance, fees, index, results, students } from '../controllers/report.controller.js';
import { csrfToken, requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const reportRoutes = Router();

reportRoutes.use(requireAuth);
reportRoutes.get('/reports', requirePermission('report.view'), csrfToken, index);
reportRoutes.get('/reports/students', requirePermission('report.view'), csrfToken, students);
reportRoutes.get('/reports/attendance', requirePermission('report.view'), csrfToken, attendance);
reportRoutes.get('/reports/results', requirePermission('report.view'), csrfToken, results);
reportRoutes.get('/reports/fees', requirePermission('report.view'), csrfToken, fees);
