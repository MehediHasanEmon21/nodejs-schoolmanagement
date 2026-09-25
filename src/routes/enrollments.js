import { Router } from 'express';
import { classStudents, create, edit, index, show, store, studentHistory, update } from '../controllers/enrollment.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const enrollmentRoutes = Router();

enrollmentRoutes.use(requireAuth);
enrollmentRoutes.get('/enrollments', requirePermission('enrollment.view'), csrfToken, index);
enrollmentRoutes.get('/enrollments/new', requirePermission('enrollment.create'), csrfToken, create);
enrollmentRoutes.post('/enrollments', requirePermission('enrollment.create'), verifyCsrf, store);
enrollmentRoutes.get('/enrollments/classes/:classId/students', requirePermission('enrollment.view'), csrfToken, classStudents);
enrollmentRoutes.get('/enrollments/students/:studentId/history', requirePermission('enrollment.view'), csrfToken, studentHistory);
enrollmentRoutes.get('/enrollments/:id', requirePermission('enrollment.view'), csrfToken, show);
enrollmentRoutes.get('/enrollments/:id/edit', requirePermission('enrollment.edit'), csrfToken, edit);
enrollmentRoutes.post('/enrollments/:id', requirePermission('enrollment.edit'), verifyCsrf, update);
