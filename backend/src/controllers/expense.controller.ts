import { Response, NextFunction } from 'express';
import Expense from '../models/Expense.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const createExpense = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const { date, category, amount, description } = req.body;

    if (!ownerId) {
      throw new AppError('Authentication required', 401);
    }

    const expense = await Expense.create({
      owner: ownerId,
      date: new Date(date),
      category,
      amount,
      description: description || ''
    });

    return res.status(201).json({
      message: 'Expense added successfully',
      expense
    });
  } catch (error) {
    next(error);
  }
};

export const getExpenses = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const { category, range, startDate, endDate } = req.query;

    if (!ownerId) {
      throw new AppError('Authentication required', 401);
    }

    const query: any = { owner: ownerId };

    if (category) {
      query.category = category;
    }

    // Apply date filters
    if (range) {
      const now = new Date();
      if (range === 'daily') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        query.date = { $gte: startOfDay, $lte: endOfDay };
      } else if (range === 'weekly') {
        // Last 7 days
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        query.date = { $gte: sevenDaysAgo, $lte: now };
      } else if (range === 'monthly') {
        // Current calendar month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        query.date = { $gte: startOfMonth, $lte: now };
      }
    } else if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return res.status(200).json({
      expenses,
      totalExpenses
    });
  } catch (error) {
    next(error);
  }
};

export const deleteExpense = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const { id } = req.params;

    if (!ownerId) {
      throw new AppError('Authentication required', 401);
    }

    const expense = await Expense.findById(id);
    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    if (expense.owner.toString() !== ownerId && req.user?.role !== 'admin') {
      throw new AppError('Unauthorized to delete this expense', 403);
    }

    await Expense.findByIdAndDelete(id);

    return res.status(200).json({
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
