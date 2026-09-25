import { Router } from 'express';
import { classView, entry, index, redirectToEntry, store, student } from '../controllers/result.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const resultRoutes = Router();

resultRoutes.use(requireAuth);
resultRoutes.get('/results', requirePermission('result.view'), csrfToken, index);
resultRoutes.get('/results/entry', requirePermission('result.create'), csrfToken, entry);
resultRoutes.post('/results/entry', requirePermission('result.create'), verifyCsrf, store);
resultRoutes.get('/results/marks', requirePermission('result.create'), csrfToken, redirectToEntry);
resultRoutes.get('/results/exams/:examId/class', requirePermission('result.view'), csrfToken, classView);
resultRoutes.get('/results/exams/:examId/students/:studentId', requirePermission('result.view'), csrfToken, student);
