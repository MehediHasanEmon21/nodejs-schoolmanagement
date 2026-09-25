import { Router } from 'express';
import { create, edit, index, show, status, store, update } from '../controllers/teacher.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const teacherRoutes = Router();

teacherRoutes.use(requireAuth);
teacherRoutes.get('/teachers', requirePermission('teacher.view'), csrfToken, index);
teacherRoutes.get('/teachers/new', requirePermission('teacher.create'), csrfToken, create);
teacherRoutes.post('/teachers', requirePermission('teacher.create'), verifyCsrf, store);
teacherRoutes.get('/teachers/:id', requirePermission('teacher.view'), csrfToken, show);
teacherRoutes.get('/teachers/:id/edit', requirePermission('teacher.edit'), csrfToken, edit);
teacherRoutes.post('/teachers/:id', requirePermission('teacher.edit'), verifyCsrf, update);
teacherRoutes.post('/teachers/:id/status', requirePermission('teacher.edit'), verifyCsrf, status);
