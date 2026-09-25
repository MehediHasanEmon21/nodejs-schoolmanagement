import { Router } from 'express';
import { create, edit, index, show, store, update } from '../controllers/notice.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const noticeRoutes = Router();

noticeRoutes.use(requireAuth);
noticeRoutes.get('/notices', requirePermission('notice.view'), csrfToken, index);
noticeRoutes.get('/notices/new', requirePermission('notice.create'), csrfToken, create);
noticeRoutes.post('/notices', requirePermission('notice.create'), verifyCsrf, store);
noticeRoutes.get('/notices/:id', requirePermission('notice.view'), csrfToken, show);
noticeRoutes.get('/notices/:id/edit', requirePermission('notice.edit'), csrfToken, edit);
noticeRoutes.post('/notices/:id', requirePermission('notice.edit'), verifyCsrf, update);
