import { Router } from 'express';
import { create, edit, index, show, store, update } from '../controllers/exam.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const examRoutes = Router();

examRoutes.use(requireAuth);
examRoutes.get('/exams', requirePermission('exam.view'), csrfToken, index);
examRoutes.get('/exams/new', requirePermission('exam.create'), csrfToken, create);
examRoutes.post('/exams', requirePermission('exam.create'), verifyCsrf, store);
examRoutes.get('/exams/:id', requirePermission('exam.view'), csrfToken, show);
examRoutes.get('/exams/:id/edit', requirePermission('exam.edit'), csrfToken, edit);
examRoutes.post('/exams/:id', requirePermission('exam.edit'), verifyCsrf, update);
