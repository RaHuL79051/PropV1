import { Router } from 'express';
import { verifyAadhaar, getVerificationLogs } from '../controllers/verification.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { verifyAadhaarSchema } from '../validators/schemas';

const router = Router();

router.post('/verify', authenticate, requireRole(['owner', 'admin']), validate(verifyAadhaarSchema), verifyAadhaar);
router.get('/logs', authenticate, requireRole(['owner', 'admin']), getVerificationLogs);

export default router;
