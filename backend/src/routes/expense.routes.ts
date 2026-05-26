import { Router } from 'express';
import { createExpense, getExpenses, deleteExpense } from '../controllers/expense.controller.js';
import { validate } from '../middleware/validator.js';
import { expenseSchema } from '../validators/schemas.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, validate(expenseSchema), createExpense);
router.get('/', authenticate, getExpenses);
router.delete('/:id', authenticate, deleteExpense);

export default router;
