import { Router } from 'express';
import { createExpense, getExpenses, deleteExpense } from '../controllers/expense.controller';
import { validate } from '../middleware/validator';
import { expenseSchema } from '../validators/schemas';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, validate(expenseSchema), createExpense);
router.get('/', authenticate, getExpenses);
router.delete('/:id', authenticate, deleteExpense);

export default router;
