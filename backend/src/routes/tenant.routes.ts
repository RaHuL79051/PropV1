import { Router } from 'express';
import {
  createTenant,
  getTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  checkoutTenant,
  uploadDocuments,
  createTenantInvite,
  getTenantInvite,
  acceptTenantInvite,
  activateConnection,
  addTenantCharge,
  removeTenantCharge,
  sendTenantBillManually
} from '../controllers/tenant.controller.js';
import { validate } from '../middleware/validator.js';
import { acceptTenantInviteSchema, tenantInviteSchema, tenantSchema } from '../validators/schemas.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/invites', authenticate, requireRole(['owner', 'admin']), validate(tenantInviteSchema), createTenantInvite);
router.get('/invites/:token', getTenantInvite);
router.post('/invites/:token/accept', validate(acceptTenantInviteSchema), acceptTenantInvite);

router.post('/connections/activate', authenticate, requireRole(['owner', 'admin']), activateConnection);

router.post('/', authenticate, requireRole(['owner', 'admin']), validate(tenantSchema), createTenant);
router.get('/', authenticate, getTenants);
router.get('/:id', authenticate, getTenantById);
router.put('/:id', authenticate, requireRole(['owner', 'admin']), updateTenant);
router.delete('/:id', authenticate, requireRole(['owner', 'admin']), deleteTenant);

// New checkout & document upload endpoints
router.post('/:id/checkout', authenticate, requireRole(['owner', 'admin']), checkoutTenant);
router.post('/:id/documents', authenticate, requireRole(['owner', 'admin']), uploadDocuments);

// Additional charges & manual billing endpoints
router.post('/:id/charges', authenticate, requireRole(['owner', 'admin']), addTenantCharge);
router.delete('/:id/charges/:chargeId', authenticate, requireRole(['owner', 'admin']), removeTenantCharge);
router.post('/:id/send-bill', authenticate, requireRole(['owner', 'admin']), sendTenantBillManually);

export default router;
