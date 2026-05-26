import { Router } from 'express';
import { getOwnerDashboardStats, getAdminDashboardStats } from '../controllers/dashboard.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/owner', authenticate, requireRole(['owner']), getOwnerDashboardStats);
router.get('/admin', authenticate, requireRole(['admin']), getAdminDashboardStats);

export default router;
