import { Router } from 'express';
import {
  create,
  edit,
  index,
  show,
  store,
  typeCreate,
  typeEdit,
  typeStore,
  typeUpdate,
  types,
  update,
} from '../controllers/fee.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const feeRoutes = Router();

feeRoutes.use(requireAuth);
feeRoutes.get('/fees', requirePermission('fee.view'), csrfToken, index);
feeRoutes.get('/fees/new', requirePermission('fee.create'), csrfToken, create);
feeRoutes.post('/fees', requirePermission('fee.create'), verifyCsrf, store);
feeRoutes.get('/fees/types', requirePermission('fee.edit'), csrfToken, types);
feeRoutes.get('/fees/types/new', requirePermission('fee.edit'), csrfToken, typeCreate);
feeRoutes.post('/fees/types', requirePermission('fee.edit'), verifyCsrf, typeStore);
feeRoutes.get('/fees/types/:id/edit', requirePermission('fee.edit'), csrfToken, typeEdit);
feeRoutes.post('/fees/types/:id', requirePermission('fee.edit'), verifyCsrf, typeUpdate);
feeRoutes.get('/fees/:id', requirePermission('fee.view'), csrfToken, show);
feeRoutes.get('/fees/:id/edit', requirePermission('fee.edit'), csrfToken, edit);
feeRoutes.post('/fees/:id', requirePermission('fee.edit'), verifyCsrf, update);
