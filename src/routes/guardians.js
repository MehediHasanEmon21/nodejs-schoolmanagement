import { Router } from 'express';
import { create, edit, index, show, status, store, update } from '../controllers/guardian.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const guardianRoutes = Router();

guardianRoutes.use(requireAuth);
guardianRoutes.get('/guardians', requirePermission('guardian.view'), csrfToken, index);
guardianRoutes.get('/guardians/new', requirePermission('guardian.create'), csrfToken, create);
guardianRoutes.post('/guardians', requirePermission('guardian.create'), verifyCsrf, store);
guardianRoutes.get('/guardians/:id', requirePermission('guardian.view'), csrfToken, show);
guardianRoutes.get('/guardians/:id/edit', requirePermission('guardian.edit'), csrfToken, edit);
guardianRoutes.post('/guardians/:id', requirePermission('guardian.edit'), verifyCsrf, update);
guardianRoutes.post('/guardians/:id/status', requirePermission('guardian.edit'), verifyCsrf, status);
