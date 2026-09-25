import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { serialize } from '../utils/serialize.js';
import { updateTenantStatsByAadhaar } from '../utils/scoreHelper.js';

// An owner may only touch invoices belonging to a tenant they are linked to.
const assertPaymentAccess = async (req: AuthenticatedRequest, tenantId: any, action: string) => {
  if (req.user?.role === 'admin') return;
  const connection = await prisma.tenantOwnerConnection.findFirst({
    where: { tenantId, ownerId: req.user?.userId, isDeleted: false }
  });
  if (!connection) {
    throw new AppError(`Unauthorized attempt to ${action}`, 403);
  }
};

export const createPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { tenant, property, room, amount, dueDate } = req.body;

    await assertPaymentAccess(req, tenant, 'invoice this tenant');

    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      throw new AppError('A valid due date is required', 400);
    }

    const payment = await prisma.payment.create({
      data: {
        tenantId: tenant,
        propertyId: property,
        roomId: room,
        amount,
        dueDate: parsedDueDate,
        status: 'unpaid',
        paymentMethod: 'none',
        transactionId: null
      }
    });

    return res.status(201).json({
      message: 'Rent invoice generated successfully',
      payment: serialize(payment)
    });
  } catch (error) {
    next(error);
  }
};

export const getPayments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;

    let where: any = {};
    if (req.user?.role !== 'admin') {
      const tenantConnections = await prisma.tenantOwnerConnection.findMany({
        where: { ownerId, isDeleted: false },
        select: { tenantId: true }
      });
      const tenantIds = tenantConnections.map((c) => c.tenantId);
      where = { tenantId: { in: tenantIds } };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        tenant: { select: { id: true, fullName: true, phone: true } },
        property: {
          select: {
            id: true,
            propertyName: true,
            address: true,
            owner: { select: { id: true, fullName: true, email: true } }
          }
        },
        room: { select: { id: true, roomNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(serialize(payments));
  } catch (error) {
    next(error);
  }
};

export const payInvoice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { paymentMethod, transactionId } = req.body;

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new AppError('That rent invoice no longer exists.', 404);
    }

    await assertPaymentAccess(req, payment.tenantId, 'settle this invoice');

    if (payment.status === 'paid') {
      throw new AppError('This invoice has already been marked as paid.', 409);
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: 'paid',
        paymentDate: new Date(),
        paymentMethod,
        transactionId: transactionId || `TXN${Date.now()}`
      }
    });

    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: payment.tenantId } });
      if (tenant && tenant.aadhaarNumber) {
        await updateTenantStatsByAadhaar(tenant.aadhaarNumber);
      }
    } catch (err) {
      console.error('Error updating tenant stats on payment:', err);
    }

    return res.status(200).json({
      message: 'Invoice paid successfully',
      payment: serialize(updated)
    });
  } catch (error) {
    next(error);
  }
};
