import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { serialize } from '../utils/serialize';

export const createExpense = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const { date, category, amount, description } = req.body;

    if (!ownerId) {
      throw new AppError('Authentication required', 401);
    }

    const expense = await prisma.expense.create({
      data: {
        ownerId,
        date: new Date(date),
        category,
        amount,
        description: description || ''
      }
    });

    return res.status(201).json({
      message: 'Expense added successfully',
      expense: serialize(expense)
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

    const where: any = { ownerId };

    if (category) {
      where.category = category;
    }

    // Apply date filters
    if (range) {
      const now = new Date();
      if (range === 'daily') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        where.date = { gte: startOfDay, lte: endOfDay };
      } else if (range === 'weekly') {
        // Last 7 days
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        where.date = { gte: sevenDaysAgo, lte: now };
      } else if (range === 'monthly') {
        // Current calendar month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        where.date = { gte: startOfMonth, lte: now };
      }
    } else if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }

    const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return res.status(200).json({
      expenses: serialize(expenses),
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

    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    if (expense.ownerId !== ownerId && req.user?.role !== 'admin') {
      throw new AppError('You can only delete your own expenses.', 403);
    }

    await prisma.expense.delete({ where: { id } });

    return res.status(200).json({
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
