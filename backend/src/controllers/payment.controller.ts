import { Response, NextFunction } from 'express';
import Payment from '../models/Payment.js';
import Tenant from '../models/Tenant.js';
import TenantOwnerConnection from '../models/TenantOwnerConnection.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { updateTenantStatsByAadhaar } from '../utils/scoreHelper.js';
import { AppError as ApiError } from '../middleware/errorHandler.js';

// An owner may only touch invoices belonging to a tenant they are linked to.
const assertPaymentAccess = async (req: AuthenticatedRequest, tenantId: any, action: string) => {
  if (req.user?.role === 'admin') return;
  const connection = await TenantOwnerConnection.findOne({
    tenant: tenantId,
    owner: req.user?.userId,
    isDeleted: false
  });
  if (!connection) {
    throw new ApiError(`Unauthorized attempt to ${action}`, 403);
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

    const payment = await Payment.create({
      tenant,
      property,
      room,
      amount,
      dueDate: parsedDueDate,
      status: 'unpaid',
      paymentMethod: 'none',
      transactionId: null
    });

    return res.status(201).json({
      message: 'Rent invoice generated successfully',
      payment
    });
  } catch (error) {
    next(error);
  }
};

export const getPayments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;

    let payments;
    if (req.user?.role === 'admin') {
      payments = await Payment.find()
        .populate('tenant', 'fullName phone')
        .populate({
          path: 'property',
          select: 'propertyName address owner',
          populate: { path: 'owner', select: 'fullName email' }
        })
        .populate('room', 'roomNumber');
    } else {
      const tenantConnections = await TenantOwnerConnection.find({ owner: ownerId, isDeleted: false }).select('tenant');
      const tenantIds = tenantConnections.map(c => c.tenant);

      payments = await Payment.find({ tenant: { $in: tenantIds } })
        .populate('tenant', 'fullName phone')
        .populate('property', 'propertyName address')
        .populate('room', 'roomNumber');
    }

    return res.status(200).json(payments);
  } catch (error) {
    next(error);
  }
};

export const payInvoice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { paymentMethod, transactionId } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      throw new AppError('That rent invoice no longer exists.', 404);
    }

    await assertPaymentAccess(req, payment.tenant, 'settle this invoice');

    if (payment.status === 'paid') {
      throw new AppError('This invoice has already been marked as paid.', 409);
    }

    payment.status = 'paid';
    payment.paymentDate = new Date();
    payment.paymentMethod = paymentMethod;
    payment.transactionId = transactionId || `TXN${Date.now()}`;
    await payment.save();

    try {
      const tenant = await Tenant.findById(payment.tenant);
      if (tenant && tenant.aadhaarNumber) {
        await updateTenantStatsByAadhaar(tenant.aadhaarNumber);
      }
    } catch (err) {
      console.error('Error updating tenant stats on payment:', err);
    }

    return res.status(200).json({
      message: 'Invoice paid successfully',
      payment
    });
  } catch (error) {
    next(error);
  }
};
