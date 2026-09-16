import { Router } from 'express';
import { verifyAadhaar, getVerificationLogs } from '../controllers/verification.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validator.js';
import { verifyAadhaarSchema } from '../validators/schemas.js';

const router = Router();

router.post('/verify', authenticate, requireRole(['owner', 'admin']), validate(verifyAadhaarSchema), verifyAadhaar);
router.get('/logs', authenticate, requireRole(['owner', 'admin']), getVerificationLogs);

export default router;
