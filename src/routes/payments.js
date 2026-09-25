import { Router } from 'express';
import { create, history, store } from '../controllers/payment.controller.js';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

export const paymentRoutes = Router();

paymentRoutes.use(requireAuth);
paymentRoutes.get('/fees/:feeId/payments', requirePermission('payment.view'), csrfToken, history);
paymentRoutes.get('/fees/:feeId/payments/new', requirePermission('payment.create'), csrfToken, create);
paymentRoutes.post('/fees/:feeId/payments', requirePermission('payment.create'), verifyCsrf, store);
