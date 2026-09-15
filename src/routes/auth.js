import { Router } from 'express';
import { showLogin, login, logout, showDashboard } from '../controllers/auth.controller.js';
import { csrfToken, verifyCsrf, requireAuth, requireGuest } from '../middleware/auth.js';
import { loginLimit } from '../middleware/login-limit.js';
import { requirePermission } from '../middleware/authorization.js';

export function authRoutes(config) {
  const router = Router();
  router.get('/login', requireGuest, csrfToken, showLogin);
  router.post('/login', requireGuest, loginLimit(config.secret), verifyCsrf, login);
  router.get('/dashboard', requireAuth, requirePermission('dashboard.view'), csrfToken, showDashboard);
  router.post('/logout', requireAuth, verifyCsrf, logout(config));
  return router;
}
