import { Response, NextFunction } from 'express';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import Bed from '../models/Bed.js';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import TenantOwnerConnection from '../models/TenantOwnerConnection.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Helper to check if Razorpay is configured
const isRazorpayConfigured = () => {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
};

const buildMockOrderResponse = (ownerId: string, amountDue: number) => {
  const now = Date.now();
  return {
    success: true,
    orderId: `order_mock_${now}`,
    amount: amountDue * 100,
    currency: 'INR',
    isSimulated: true,
    keyId: 'mock_razorpay_key_id'
  };
};

export const canAssignTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const owner = await User.findById(ownerId);
    if (!owner) {
      throw new AppError('Owner not found', 404);
    }

    const totalTenants = await TenantOwnerConnection.countDocuments({ owner: ownerId, isDeleted: false });
    const paidLimit = (owner.paidBeds || 0) + 2;
    const canAssign = totalTenants <= paidLimit;
    const amountDue = Math.max(0, totalTenants - paidLimit) * 20;

    return res.status(200).json({
      canAssign,
      currentLinked: totalTenants,
      paidLimit,
      amountDue
    });
  } catch (error) {
    next(error);
  }
};

export const getBedBillingStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const owner = await User.findById(ownerId);
    if (!owner) {
      throw new AppError('Owner not found', 404);
    }

    // Calculate total tenants
    const totalTenants = await TenantOwnerConnection.countDocuments({ owner: ownerId, isDeleted: false });
    const paidPersons = owner.paidBeds || 0;
    const unpaidPersons = Math.max(0, totalTenants - 2 - paidPersons);
    const amountDue = unpaidPersons * 20; // ₹20 per person

    return res.status(200).json({
      totalTenants,
      paidPersons,
      unpaidPersons,
      amountDue,
      isSimulated: !isRazorpayConfigured()
    });
  } catch (error) {
    next(error);
  }
};

export const createBedBillingOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const owner = await User.findById(ownerId);
    if (!owner) {
      throw new AppError('Owner not found', 404);
    }

    const totalTenants = await TenantOwnerConnection.countDocuments({ owner: ownerId, isDeleted: false });
    
    const paidPersons = Number(owner.paidBeds) || 0;
    const unpaidPersons = Math.max(0, totalTenants - 2 - paidPersons);
    if (unpaidPersons === 0) {
      throw new AppError('You have no outstanding tenant licences to pay for.', 400);
    }

    const amountDue = unpaidPersons * 20; // ₹20 per person

    if (!isRazorpayConfigured()) {
      return res.status(201).json(buildMockOrderResponse(ownerId!, amountDue));
    }

    try {
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!
      });

      const order = await razorpay.orders.create({
        amount: amountDue * 100, // amount in paise
        currency: 'INR',
        receipt: `rcpt_${ownerId!.toString().slice(-6)}_${Date.now()}`
      });

      return res.status(201).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        isSimulated: false,
        keyId: process.env.RAZORPAY_KEY_ID
      });
    } catch (razorpayError: any) {
      // Never silently downgrade to the simulated flow while real credentials are
      // configured: verification would then reject the payment anyway, and the
      // owner would have no way to actually pay.
      console.error('[Billing] Razorpay order creation failed.', {
        message: razorpayError?.error?.description || razorpayError?.message
      });
      throw new AppError(
        razorpayError?.error?.description || 'Unable to create Razorpay order. Please verify Razorpay credentials.',
        502
      );
    }
  } catch (error) {
    next(error);
  }
};

export const verifyBedBillingPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const owner = await User.findById(ownerId);
    if (!owner) {
      throw new AppError('Owner not found', 404);
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Whether this is a real or simulated payment is decided by the server's own
    // configuration. A client-supplied "isMock" flag must never be able to skip
    // signature verification, or licences could be granted without payment.
    if (isRazorpayConfigured()) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new AppError('This payment could not be confirmed because the gateway response was incomplete. No licences were granted.', 400);
      }

      // Verify HMAC SHA256 Signature
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!);
      hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpay_signature) {
        throw new AppError('This payment could not be verified and was rejected. If you were charged, please contact support.', 400);
      }
    } else {
      // Simulated sandbox mode: no gateway is configured, so accept the mock order.
      if (!razorpay_order_id) {
        throw new AppError('This payment could not be confirmed because the order reference was missing.', 400);
      }
    }

    // Only grant licences that are actually outstanding.
    const outstanding = await TenantOwnerConnection.countDocuments({ owner: ownerId, isDeleted: false });
    if (Math.max(0, outstanding - 2 - (owner.paidBeds || 0)) === 0) {
      throw new AppError('You have no outstanding tenant licences to pay for.', 400);
    }

    // Fetch actual current tenant count to update owner's license limit
    const newlyPaidLimit = Math.max(0, outstanding - 2);

    // Set paidPersons to the new total
    const oldPaidPersons = owner.paidBeds || 0;
    owner.paidBeds = Math.max(newlyPaidLimit, owner.paidBeds);
    await owner.save();

    return res.status(200).json({
      success: true,
      message: `Licenses updated. Total persons paid increased from ${oldPaidPersons} to ${owner.paidBeds}.`,
      paidPersons: owner.paidBeds
    });
  } catch (error) {
    next(error);
  }
};
