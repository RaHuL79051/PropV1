import { Response, NextFunction } from 'express';
import VerificationLog from '../models/VerificationLog.js';
import Tenant from '../models/Tenant.js';
import TenantReview from '../models/TenantReview.js';
import TenantOwnerConnection from '../models/TenantOwnerConnection.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

interface IMockReview {
  rating: number;
  feedback: string;
  ownerName: string;
  createdAt: Date;
}

// Static seed registry for simulated Aadhaar records
const MOCK_AADHAAR_REGISTRY: Record<string, {
  fullName: string;
  previousRating: number;
  creditScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  verificationStatus: 'verified' | 'failed';
  paymentHistory: string;
  feedback: string[];
  reviews: IMockReview[];
  alertMsg?: string;
}> = {
  '123456789012': {
    fullName: 'Arjun Kumar',
    previousRating: 4.8,
    creditScore: 810,
    riskLevel: 'low',
    verificationStatus: 'verified',
    paymentHistory: '98% paid on time. No dues.',
    feedback: [
      'Excellent tenant, clean room maintenance.',
      'Polite and paid rent before the due date.'
    ],
    reviews: [
      { rating: 5, feedback: 'Excellent tenant, clean room maintenance.', ownerName: 'Sunil Mehta', createdAt: new Date('2026-01-10T10:00:00.000Z') },
      { rating: 4, feedback: 'Polite and paid rent before the due date.', ownerName: 'Karan Johar', createdAt: new Date('2026-03-15T10:00:00.000Z') },
      { rating: 5, feedback: 'Very quiet, no complaints from neighbors.', ownerName: 'Meera Nair', createdAt: new Date('2026-04-20T10:00:00.000Z') }
    ]
  },
  '987654321098': {
    fullName: 'Rohan Sharma',
    previousRating: 2.1,
    creditScore: 450,
    riskLevel: 'high',
    verificationStatus: 'verified',
    paymentHistory: 'Frequent delays of over 15 days. Dues outstanding.',
    feedback: [
      'Left without paying last month rent.',
      'Noisy and caused damage to bathroom fixtures.'
    ],
    reviews: [
      { rating: 2, feedback: 'Left without paying last month rent.', ownerName: 'Vikram Seth', createdAt: new Date('2025-11-05T10:00:00.000Z') },
      { rating: 2, feedback: 'Noisy and caused damage to bathroom fixtures.', ownerName: 'Anjali Gupta', createdAt: new Date('2026-02-14T10:00:00.000Z') },
      { rating: 3, feedback: 'Delayed payment by 15 days multiple times.', ownerName: 'Rajesh Kumar', createdAt: new Date('2026-04-01T10:00:00.000Z') }
    ],
    alertMsg: 'Fraud Alert: Associated with property damage dispute in previous location.'
  },
  '555566667777': {
    fullName: 'Priya Patel',
    previousRating: 3.5,
    creditScore: 680,
    riskLevel: 'medium',
    verificationStatus: 'verified',
    paymentHistory: 'Paid rent mostly on time, occasional 3-5 days delay.',
    feedback: [
      'Average occupant. No major issues.',
      'Had minor disputes regarding late night guests.'
    ],
    reviews: [
      { rating: 4, feedback: 'Average occupant. No major issues.', ownerName: 'Divya Teja', createdAt: new Date('2025-12-25T10:00:00.000Z') },
      { rating: 3, feedback: 'Had minor disputes regarding late night guests.', ownerName: 'Sanjay Dutt', createdAt: new Date('2026-02-28T10:00:00.000Z') },
      { rating: 4, feedback: 'Well behaved but room could be cleaner.', ownerName: 'Nisha Sharma', createdAt: new Date('2026-05-01T10:00:00.000Z') }
    ]
  },
  '111122223333': {
    fullName: 'Amit Verma',
    previousRating: 1.0,
    creditScore: 320,
    riskLevel: 'high',
    verificationStatus: 'failed',
    paymentHistory: 'Defaulted entirely on security deposit.',
    feedback: [
      'Document mismatch detected. Security alert raised.',
      'Left mid-agreement without notice.'
    ],
    reviews: [
      { rating: 1, feedback: 'Document mismatch detected. Security alert raised.', ownerName: 'Aarav Singh', createdAt: new Date('2026-01-05T10:00:00.000Z') },
      { rating: 1, feedback: 'Left mid-agreement without notice.', ownerName: 'Poonam Panday', createdAt: new Date('2026-03-10T10:00:00.000Z') },
      { rating: 1, feedback: 'Defaulted entirely on security deposit.', ownerName: 'Rakesh Roshan', createdAt: new Date('2026-05-12T10:00:00.000Z') }
    ],
    alertMsg: 'Identity Verification Failed: Aadhaar biometric mismatch flagged.'
  }
};

import { updateTenantStatsByAadhaar } from '../utils/scoreHelper.js';

export const verifyAadhaar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { aadhaarNumber } = req.body;
    const requesterId = req.user?.userId;

    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      throw new AppError('Aadhaar number must be exactly 12 digits', 400);
    }

    // Check if dynamic records exist in DB
    const dbReviewsCount = await TenantReview.countDocuments({ aadhaarNumber });
    const dbTenantsCount = await Tenant.countDocuments({ aadhaarNumber });
    
    let result: {
      fullName: string;
      previousRating: number;
      creditScore: number;
      riskLevel: 'low' | 'medium' | 'high';
      verificationStatus: 'verified' | 'failed';
      paymentHistory: string;
      feedback: string[];
      alertMsg?: string;
    };

    if (dbReviewsCount > 0 || dbTenantsCount > 0) {
      // Calculate dynamic score and update all tenants
      const stats = await updateTenantStatsByAadhaar(aadhaarNumber);
      
      // Get the name from first matching review or tenant
      let fullName = 'Verified Tenant';
      const firstTenant = await Tenant.findOne({ aadhaarNumber });
      if (firstTenant) {
        fullName = firstTenant.fullName;
      } else {
        const firstReview = await TenantReview.findOne({ aadhaarNumber });
        if (firstReview) {
          fullName = firstReview.tenantName;
        }
      }

      result = {
        fullName,
        previousRating: stats.averageRating,
        creditScore: stats.score,
        riskLevel: stats.riskLevel,
        verificationStatus: 'verified',
        paymentHistory: `Reliability Index: ${stats.score}. Risk: ${stats.riskLevel.toUpperCase()}. Has dynamic tenant history.`,
        feedback: stats.feedbacks
      };
    } else {
      // Fallback: Lookup in our simulated registry
      const mockResult = MOCK_AADHAAR_REGISTRY[aadhaarNumber];
      if (mockResult) {
        result = {
          fullName: mockResult.fullName,
          previousRating: mockResult.previousRating,
          creditScore: mockResult.creditScore,
          riskLevel: mockResult.riskLevel,
          verificationStatus: mockResult.verificationStatus,
          paymentHistory: mockResult.paymentHistory,
          feedback: mockResult.feedback,
          alertMsg: mockResult.alertMsg
        };
      } else {
        // Default brand new clean profile
        result = {
          fullName: 'New Tenant Record',
          previousRating: 5.0,
          creditScore: 700,
          riskLevel: 'low',
          verificationStatus: 'verified',
          paymentHistory: 'No history (First-time renter).',
          feedback: ['No previous owner reviews registered.']
        };
      }
    }

    // Write to audit logs
    const log = await VerificationLog.create({
      aadhaarNumber,
      requester: requesterId,
      result,
      riskLevel: result.riskLevel,
      status: result.verificationStatus
    });

    // Update matching tenant ratings & verificationStatus if they exist in the DB
    await Tenant.updateMany(
      { aadhaarNumber },
      {
        $set: {
          verificationStatus: result.verificationStatus,
          riskLevel: result.riskLevel,
          tenantRating: result.previousRating,
          creditScore: result.creditScore,
          previousOwnerFeedback: result.feedback
        }
      }
    );

    // Fetch prefill details if a tenant profile exists in DB
    const existingTenant = await Tenant.findOne({ aadhaarNumber }).sort({ createdAt: -1 });
    const isNewTenant = !existingTenant;

    let connectionExists = false;
    let connectionStatus: 'active' | 'inactive' | null = null;
    if (existingTenant) {
      const connection = await TenantOwnerConnection.findOne({ tenant: existingTenant._id, owner: requesterId });
      if (connection) {
        connectionExists = true;
        connectionStatus = connection.isDeleted ? 'inactive' : 'active';
      }
    }

    const prefill = {
      fullName: existingTenant?.fullName || (MOCK_AADHAAR_REGISTRY[aadhaarNumber]?.fullName || ''),
      email: existingTenant?.email || '',
      phone: existingTenant?.phone || '',
      emergencyContact: existingTenant?.emergencyContact || '',
      occupation: existingTenant?.occupation || '',
      address: existingTenant?.address || ''
    };

    // Get the last 3 reviews to return
    let reviewsList: IMockReview[] = [];
    const dbReviews = await TenantReview.find({ aadhaarNumber })
      .populate('owner', 'fullName')
      .sort({ createdAt: -1 })
      .limit(3);

    if (dbReviews.length > 0) {
      reviewsList = dbReviews.map(r => ({
        rating: r.rating,
        feedback: r.feedback,
        ownerName: (r.owner as any)?.fullName || 'System Owner',
        createdAt: r.createdAt
      }));
    } else {
      reviewsList = MOCK_AADHAAR_REGISTRY[aadhaarNumber]?.reviews || [
        {
          rating: 5,
          feedback: 'No previous owner reviews registered.',
          ownerName: 'System Verification',
          createdAt: new Date()
        }
      ];
    }

    return res.status(200).json({
      message: 'Verification completed successfully',
      verificationLog: log,
      prefill,
      reviews: reviewsList,
      connectionExists,
      connectionStatus,
      isNewTenant
    });
  } catch (error) {
    next(error);
  }
};

export const getVerificationLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;
    const query = req.user?.role === 'admin' ? {} : { requester: ownerId };

    const logs = await VerificationLog.find(query)
      .populate('requester', 'fullName email')
      .sort({ createdAt: -1 });

    return res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};
