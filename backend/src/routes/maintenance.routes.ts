import { Router } from 'express';
import {
  createMaintenanceRequest,
  getMaintenanceRequests,
  updateMaintenanceStatus,
  deleteMaintenanceRequest
} from '../controllers/maintenance.controller.js';
import { validate } from '../middleware/validator.js';
import { maintenanceRequestSchema } from '../validators/schemas.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, validate(maintenanceRequestSchema), createMaintenanceRequest);
router.get('/', authenticate, getMaintenanceRequests);
router.put('/:id/status', authenticate, updateMaintenanceStatus);
router.delete('/:id', authenticate, deleteMaintenanceRequest);

export default router;
