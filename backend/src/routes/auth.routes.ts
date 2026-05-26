import { Router } from 'express';
import { register, login, logout, refreshToken, forgotPassword, resetPassword, getMe, getOwners, updateOwnerStatus, createUserByAdmin } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validator.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, adminCreateUserSchema } from '../validators/schemas.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.get('/me', authenticate, getMe);
router.get('/owners', authenticate, requireRole(['admin']), getOwners);
router.put('/owners/:id/status', authenticate, requireRole(['admin']), updateOwnerStatus);
router.post('/admin/create-user', authenticate, requireRole(['admin']), validate(adminCreateUserSchema), createUserByAdmin);

export default router;
