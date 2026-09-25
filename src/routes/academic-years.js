import { Router } from 'express';
import { create, edit, index, show, store, update, activate } from '../controllers/academic-year.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const academicYearRoutes = Router();

academicYearRoutes.use(requireAuth);
academicYearRoutes.get('/academic-years', requirePermission('academic_year.view'), csrfToken, index);
academicYearRoutes.get('/academic-years/new', requirePermission('academic_year.create'), csrfToken, create);
academicYearRoutes.post('/academic-years', requirePermission('academic_year.create'), verifyCsrf, store);
academicYearRoutes.get('/academic-years/:id', requirePermission('academic_year.view'), csrfToken, show);
academicYearRoutes.get('/academic-years/:id/edit', requirePermission('academic_year.edit'), csrfToken, edit);
academicYearRoutes.post('/academic-years/:id', requirePermission('academic_year.edit'), verifyCsrf, update);
academicYearRoutes.post('/academic-years/:id/activate', requirePermission('academic_year.edit'), verifyCsrf, activate);
