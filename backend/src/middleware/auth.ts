import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';

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
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const decoded = verifyAccessToken(token);

    // Validate that user exists in database and is active
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User session invalid. Please log in again.' });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: 'User account is deactivated.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
};

export const requireRole = (roles: Array<'admin' | 'owner'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
    }

    next();
  };
};
