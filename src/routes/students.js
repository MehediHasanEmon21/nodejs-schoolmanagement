import { Router } from 'express';
import { create, edit, index, show, status, store, update } from '../controllers/student.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const studentRoutes = Router();

studentRoutes.use(requireAuth);
studentRoutes.get('/students', requirePermission('student.view'), csrfToken, index);
studentRoutes.get('/students/new', requirePermission('student.create'), csrfToken, create);
studentRoutes.post('/students', requirePermission('student.create'), verifyCsrf, store);
studentRoutes.get('/students/:id', requirePermission('student.view'), csrfToken, show);
studentRoutes.get('/students/:id/edit', requirePermission('student.edit'), csrfToken, edit);
studentRoutes.post('/students/:id', requirePermission('student.edit'), verifyCsrf, update);
studentRoutes.post('/students/:id/status', requirePermission('student.edit'), verifyCsrf, status);
