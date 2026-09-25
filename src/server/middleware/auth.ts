import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../lib/prisma';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: 'admin' | 'owner';
  };
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'You need to be signed in to do that. Please log in.'
      });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (tokenError: any) {
      return res.status(401).json({
        status: 'error',
        message:
          tokenError?.name === 'TokenExpiredError'
            ? 'Your session has expired. Please log in again.'
            : 'Your session is not valid. Please log in again.'
      });
    }

    // Validate that user exists in database and is active
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'This account no longer exists. Please log in again.'
      });
    }
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'This account has been deactivated. Please contact support.'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (roles: Array<'admin' | 'owner'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'You need to be signed in to do that. Please log in.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `This action is only available to ${roles.join(' or ')} accounts.`
      });
    }

    next();
  };
};
