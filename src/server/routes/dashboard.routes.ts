import { Router } from 'express';
import { getOwnerDashboardStats, getAdminDashboardStats } from '../controllers/dashboard.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/owner', authenticate, requireRole(['owner']), getOwnerDashboardStats);
router.get('/admin', authenticate, requireRole(['admin']), getAdminDashboardStats);

export default router;
