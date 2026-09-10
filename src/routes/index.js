import { Router } from 'express';
import { showHome } from '../controllers/home.controller.js';

const router = Router();
router.get('/', showHome);
export default router;
