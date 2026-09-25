import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendMail } from '../utils/mailer.js';
import { serialize } from '../utils/serialize.js';

// Browsers drop a SameSite=None cookie that is not also Secure, which silently
// breaks refresh-token rotation over plain http during local development.
const buildRefreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
};

const getFrontendUrl = (req?: Request) => {
  const requestOrigin = req?.headers.origin?.toString().replace(/\/+$/, '');
  return requestOrigin || process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, phone, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('An account with this email address already exists. Try logging in instead.', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash,
        role: 'owner', // Public registration always creates owner accounts
        status: 'pending',
        isActive: false
      }
    });

    return res.status(201).json({
      message: 'Registration successful! Your profile is pending verification by our admin team. You will be notified once your account is approved and you can log in.',
      pending: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('Invalid email or password', 401);
    }

    if (user.role === 'owner' && user.status !== 'approved') {
      if (user.status === 'pending') {
        throw new AppError('Your account is pending verification. Please wait for admin approval.', 403);
      } else if (user.status === 'rejected') {
        throw new AppError('Your verification request has been rejected. Please contact support.', 403);
      }
    }

    const payload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.cookie('refreshToken', refreshToken, buildRefreshCookieOptions());

    return res.status(200).json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.role === 'owner' && user.status !== 'approved') {
      throw new AppError('Your account status does not permit this action.', 403);
    }

    const payload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    res.cookie('refreshToken', newRefreshToken, buildRefreshCookieOptions());

    return res.status(200).json({
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(new AppError('Invalid or expired refresh token', 401));
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always answer the same way: revealing whether an address is registered
    // lets an attacker enumerate accounts.
    const genericResponse = {
      message: 'If an account exists for that email address, password reset instructions have been sent to it.'
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const resetToken = jwtSignForReset(user.id);
    const resetUrl = `${getFrontendUrl(req)}/reset-password?token=${resetToken}`;

    try {
      await sendMail({
        to: user.email,
        subject: 'Reset your Property Manager password',
        text:
          `Hello ${user.fullName},\n\n` +
          `We received a request to reset your password. Open the link below within one hour to choose a new one:\n\n` +
          `${resetUrl}\n\n` +
          `If you did not request this, you can safely ignore this email.`,
        html:
          `<p>Hello ${user.fullName},</p>` +
          `<p>We received a request to reset your password. The link below is valid for one hour:</p>` +
          `<p><a href="${resetUrl}">Reset my password</a></p>` +
          `<p>If you did not request this, you can safely ignore this email.</p>`
      });
    } catch (mailError) {
      console.error('[Auth] Failed to send password reset email:', mailError);
    }

    // The token is delivered by email only; it is never returned to the caller.
    return res.status(200).json(genericResponse);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;

    let decoded: { userId: string };
    try {
      decoded = jwtVerifyReset(token);
    } catch {
      throw new AppError('This password reset link is invalid or has expired.', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      throw new AppError('Invalid reset token or user not found', 404);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  // Clearing must use the same flags the cookie was written with.
  const { maxAge, ...clearOptions } = buildRefreshCookieOptions();
  res.clearCookie('refreshToken', clearOptions);
  return res.status(200).json({ message: 'Logged out successfully' });
};

export const getMe = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    const { passwordHash, ...safeUser } = user;
    return res.status(200).json(serialize(safeUser));
  } catch (error) {
    next(error);
  }
};

export const getOwners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owners = await prisma.user.findMany({ where: { role: 'owner' } });
    const mappedOwners = owners.map((owner) => ({
      id: owner.id,
      fullName: owner.fullName,
      email: owner.email,
      phone: owner.phone,
      role: owner.role,
      status: owner.status,
      isActive: owner.isActive,
      createdAt: owner.createdAt
    }));
    return res.status(200).json(mappedOwners);
  } catch (error) {
    next(error);
  }
};

export const updateOwnerStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' | 'rejected'

    if (!id || id === 'undefined') {
      throw new AppError('Valid owner ID is required', 400);
    }

    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError('Invalid status value. Must be approved or rejected.', 400);
    }

    const owner = await prisma.user.findUnique({ where: { id } });
    if (!owner || owner.role !== 'owner') {
      throw new AppError('Owner not found', 404);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status, isActive: status === 'approved' }
    });

    return res.status(200).json({
      message: `Owner account has been successfully ${status}.`,
      owner: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        isActive: updated.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

// Password reset tokens are signed with a dedicated secret, not a hard-coded one.
import jwt from 'jsonwebtoken';
const RESET_SECRET =
  process.env.JWT_RESET_SECRET || process.env.JWT_ACCESS_SECRET || 'fallback_reset_secret_change_me';

const jwtSignForReset = (userId: string) => {
  return jwt.sign({ userId, purpose: 'password_reset' }, RESET_SECRET, { expiresIn: '1h' });
};
const jwtVerifyReset = (token: string): { userId: string } => {
  const decoded = jwt.verify(token, RESET_SECRET) as { userId: string; purpose?: string };
  if (decoded.purpose !== 'password_reset') {
    throw new AppError('Invalid password reset token', 400);
  }
  return decoded;
};

export const createUserByAdmin = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('An account with this email address already exists.', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const targetRole = role || 'owner';
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash,
        role: targetRole,
        status: 'approved', // Admin-created accounts are approved immediately
        isActive: true
      }
    });

    return res.status(201).json({
      message: `${targetRole === 'admin' ? 'Admin' : 'Owner'} account created successfully.`,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
};
