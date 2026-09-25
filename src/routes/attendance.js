import { Router } from 'express';
import { classSummary, create, edit, index, show, store, studentHistory, update } from '../controllers/attendance.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const attendanceRoutes = Router();

attendanceRoutes.use(requireAuth);
attendanceRoutes.get('/attendance', requirePermission('attendance.view'), csrfToken, index);
attendanceRoutes.get('/attendance/new', requirePermission('attendance.create'), csrfToken, create);
attendanceRoutes.post('/attendance', requirePermission('attendance.create'), verifyCsrf, store);
attendanceRoutes.get('/attendance/classes/:classId/summary', requirePermission('attendance.view'), csrfToken, classSummary);
attendanceRoutes.get('/attendance/students/:studentId/history', requirePermission('attendance.view'), csrfToken, studentHistory);
attendanceRoutes.get('/attendance/:id', requirePermission('attendance.view'), csrfToken, show);
attendanceRoutes.get('/attendance/:id/edit', requirePermission('attendance.edit'), csrfToken, edit);
attendanceRoutes.post('/attendance/:id', requirePermission('attendance.edit'), verifyCsrf, update);
