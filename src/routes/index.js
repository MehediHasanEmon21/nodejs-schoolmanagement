import { Router } from 'express';
import { showHealth, showHome } from '../controllers/home.controller.js';

const router = Router();
router.get('/healthz', showHealth);
router.get('/', showHome);
export default router;
