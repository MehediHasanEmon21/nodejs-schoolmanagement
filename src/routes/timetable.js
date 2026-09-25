import { Router } from 'express';
import { create, edit, index, show, store, update } from '../controllers/timetable.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const timetableRoutes = Router();

timetableRoutes.use(requireAuth);
timetableRoutes.get('/timetable', requirePermission('timetable.view'), csrfToken, index);
timetableRoutes.get('/timetable/new', requirePermission('timetable.create'), csrfToken, create);
timetableRoutes.post('/timetable', requirePermission('timetable.create'), verifyCsrf, store);
timetableRoutes.get('/timetable/:id', requirePermission('timetable.view'), csrfToken, show);
timetableRoutes.get('/timetable/:id/edit', requirePermission('timetable.edit'), csrfToken, edit);
timetableRoutes.post('/timetable/:id', requirePermission('timetable.edit'), verifyCsrf, update);
