import { Router } from 'express';
import {
  createMaintenanceRequest,
  getMaintenanceRequests,
  updateMaintenanceStatus,
  deleteMaintenanceRequest
} from '../controllers/maintenance.controller';
import { validate } from '../middleware/validator';
import { maintenanceRequestSchema, maintenanceStatusSchema } from '../validators/schemas';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, validate(maintenanceRequestSchema), createMaintenanceRequest);
router.get('/', authenticate, getMaintenanceRequests);
router.put('/:id/status', authenticate, validate(maintenanceStatusSchema), updateMaintenanceStatus);
router.delete('/:id', authenticate, deleteMaintenanceRequest);

export default router;
