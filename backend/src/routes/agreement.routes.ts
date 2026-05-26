import { Router } from 'express';
import {
  createAgreement,
  getAgreements,
  getAgreementById,
  terminateAgreement,
  downloadAgreementPdf,
  deleteAgreement
} from '../controllers/agreement.controller.js';
import { validate } from '../middleware/validator.js';
import { agreementSchema } from '../validators/schemas.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, requireRole(['owner', 'admin']), validate(agreementSchema), createAgreement);
router.get('/', authenticate, getAgreements);
router.get('/:id', authenticate, getAgreementById);
router.put('/:id/terminate', authenticate, requireRole(['owner', 'admin']), terminateAgreement);
router.get('/:id/pdf', authenticate, downloadAgreementPdf);
router.delete('/:id', authenticate, requireRole(['owner', 'admin']), deleteAgreement);

export default router;
