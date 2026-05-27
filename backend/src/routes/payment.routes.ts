import { Router } from 'express';
import {
  createPayment,
  getPayments,
  payInvoice
} from '../controllers/payment.controller.js';
import {
  getBedBillingStatus,
  createBedBillingOrder,
  verifyBedBillingPayment,
  canAssignTenant
} from '../controllers/billing.controller.js';
import { validate } from '../middleware/validator.js';
import { paymentSchema, paySchema } from '../validators/schemas.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Bed billing endpoints
router.get('/bed-billing/status', authenticate, requireRole(['owner']), getBedBillingStatus);
router.post('/bed-billing/order', authenticate, requireRole(['owner']), createBedBillingOrder);
router.post('/bed-billing/verify', authenticate, requireRole(['owner']), verifyBedBillingPayment);
router.get('/licensing/can-assign', authenticate, requireRole(['owner']), canAssignTenant);

// Regular invoice payments
router.post('/', authenticate, requireRole(['owner', 'admin']), validate(paymentSchema), createPayment);
router.get('/', authenticate, getPayments);
router.put('/:id/pay', authenticate, requireRole(['owner', 'admin']), validate(paySchema), payInvoice);

export default router;
