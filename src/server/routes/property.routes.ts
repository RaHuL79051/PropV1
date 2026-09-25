import { Router } from 'express';
import {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  addRoom,
  updateRoom,
  deleteRoom
} from '../controllers/property.controller';
import { validate } from '../middleware/validator';
import { propertySchema, roomSchema } from '../validators/schemas';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Property endpoints
router.post('/', authenticate, requireRole(['owner', 'admin']), validate(propertySchema), createProperty);
router.get('/', authenticate, getProperties);
router.get('/:id', authenticate, getPropertyById);
router.put('/:id', authenticate, requireRole(['owner', 'admin']), updateProperty);
router.delete('/:id', authenticate, requireRole(['owner', 'admin']), deleteProperty);

// Room endpoints nested
router.post('/:propertyId/rooms', authenticate, requireRole(['owner', 'admin']), validate(roomSchema), addRoom);
router.put('/rooms/:roomId', authenticate, requireRole(['owner', 'admin']), updateRoom);
router.delete('/rooms/:roomId', authenticate, requireRole(['owner', 'admin']), deleteRoom);

export default router;
