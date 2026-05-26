import { Router } from 'express';
import { getSettingByKey, updateSettingByKey } from '../controllers/setting.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/:key', authenticate, getSettingByKey);
router.put('/:key', authenticate, requireRole(['admin']), updateSettingByKey);

export default router;
