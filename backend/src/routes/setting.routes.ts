import { Router } from 'express';
import { getSettingByKey, updateSettingByKey } from '../controllers/setting.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import { settingSchema } from '../validators/schemas.js';

const router = Router();

router.get('/:key', authenticate, getSettingByKey);
router.put('/:key', authenticate, requireRole(['admin']), validate(settingSchema), updateSettingByKey);

export default router;
