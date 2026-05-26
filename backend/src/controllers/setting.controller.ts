import { Request, Response, NextFunction } from 'express';
import Setting from '../models/Setting.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const getSettingByKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const setting = await Setting.findOne({ key });
    if (!setting) {
      throw new AppError('Setting not found', 404);
    }
    return res.status(200).json(setting);
  } catch (error) {
    next(error);
  }
};

export const updateSettingByKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    let setting = await Setting.findOne({ key });
    if (!setting) {
      setting = new Setting({ key, value, description });
    } else {
      setting.value = value;
      if (description !== undefined) {
        setting.description = description;
      }
    }

    await setting.save();

    return res.status(200).json({
      message: `Setting ${key} updated successfully`,
      setting
    });
  } catch (error) {
    next(error);
  }
};
