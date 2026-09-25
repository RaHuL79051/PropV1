import { Router } from 'express';
import { getSettingByKey, updateSettingByKey } from '../controllers/setting.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { settingSchema } from '../validators/schemas';

const router = Router();

router.get('/:key', authenticate, getSettingByKey);
router.put('/:key', authenticate, requireRole(['admin']), validate(settingSchema), updateSettingByKey);

export default router;
