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
      throw new AppError('All persons are already paid for or within free limit', 400);
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
        receipt: `receipt_beds_${ownerId}_${Date.now()}`
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
      const isDevelopment = process.env.NODE_ENV !== 'production';
      if (isDevelopment) {
        console.warn('[Billing] Razorpay order creation failed in development. Falling back to simulated mode.', {
          message: razorpayError?.error?.description || razorpayError?.message
        });
        return res.status(201).json(buildMockOrderResponse(ownerId!, amountDue));
      }

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

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, isMock } = req.body;

    if (isRazorpayConfigured() && !isMock) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new AppError('Missing payment verification details', 400);
      }

      // Verify HMAC SHA256 Signature
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!);
      hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpay_signature) {
        throw new AppError('Payment signature mismatch. Transaction untrusted.', 400);
      }
    } else {
      // Sandbox validation check
      if (!razorpay_order_id && !isMock) {
        throw new AppError('Missing mock validation details', 400);
      }
    }

    // Fetch actual current tenant count to update owner's license limit
    const totalTenants = await TenantOwnerConnection.countDocuments({ owner: ownerId, isDeleted: false });
    const newlyPaidLimit = Math.max(0, totalTenants - 2);

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
