import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { serialize } from '../utils/serialize';

export const getSettingByKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const setting = await prisma.setting.findUnique({ where: { key } });
    if (!setting) {
      throw new AppError(`No setting named "${key}" exists.`, 404);
    }
    return res.status(200).json(serialize(setting));
  } catch (error) {
    next(error);
  }
};

export const updateSettingByKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const setting = await prisma.setting.upsert({
      where: { key },
      create: { key, value, description },
      update: {
        value,
        ...(description !== undefined ? { description } : {})
      }
    });

    return res.status(200).json({
      message: `Setting ${key} updated successfully`,
      setting: serialize(setting)
    });
  } catch (error) {
    next(error);
  }
};
