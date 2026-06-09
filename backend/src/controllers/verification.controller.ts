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
  aadhaarNumber: string;
  panNumber: string;
  phone: string;
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
    aadhaarNumber: '123456789012',
    panNumber: 'ABCDE1234F',
    phone: '9876500001',
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
    aadhaarNumber: '987654321098',
    panNumber: 'XYZWR9876Q',
    phone: '9876500002',
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
    aadhaarNumber: '555566667777',
    panNumber: 'LMNOP5555Z',
    phone: '9876500003',
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
    aadhaarNumber: '111122223333',
    panNumber: 'JKLMN1111A',
    phone: '9876500004',
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
    const { aadhaarNumber, panNumber, phone, fullName: searchName, operator = 'or' } = req.body;
    const requesterId = req.user?.userId;

    const trimmedAadhaar = aadhaarNumber ? String(aadhaarNumber).trim() : '';
    const trimmedPan = panNumber ? String(panNumber).trim().toUpperCase() : '';
    const trimmedPhone = phone ? String(phone).trim() : '';
    const trimmedName = searchName ? String(searchName).trim() : '';

    if (!trimmedAadhaar && !trimmedPan && !trimmedPhone && !trimmedName) {
      throw new AppError('At least one search query field is required', 400);
    }

    // 1. Search DB for dynamic tenant
    const dbConditions: any[] = [];
    if (trimmedAadhaar) dbConditions.push({ aadhaarNumber: trimmedAadhaar });
    if (trimmedPan) dbConditions.push({ panNumber: trimmedPan });
    if (trimmedPhone) dbConditions.push({ phone: trimmedPhone });
    if (trimmedName) dbConditions.push({ fullName: { $regex: new RegExp(trimmedName, 'i') } });

    let existingTenant = null;
    if (dbConditions.length > 0) {
      if (operator === 'and') {
        existingTenant = await Tenant.findOne({ $and: dbConditions }).sort({ createdAt: -1 });
      } else {
        existingTenant = await Tenant.findOne({ $or: dbConditions }).sort({ createdAt: -1 });
      }
    }

    // 2. Search simulated mock registry if not found in DB
    let mockResult = null;
    const mockList = Object.values(MOCK_AADHAAR_REGISTRY);

    if (operator === 'and') {
      mockResult = mockList.find(m => {
        const matches: boolean[] = [];
        if (trimmedAadhaar) matches.push(m.aadhaarNumber === trimmedAadhaar);
        if (trimmedPan) matches.push(m.panNumber === trimmedPan);
        if (trimmedPhone) matches.push(m.phone === trimmedPhone);
        if (trimmedName) matches.push(m.fullName.toLowerCase().includes(trimmedName.toLowerCase()));
        return matches.length > 0 && matches.every(Boolean);
      });
    } else {
      mockResult = mockList.find(m => {
        if (trimmedAadhaar && m.aadhaarNumber === trimmedAadhaar) return true;
        if (trimmedPan && m.panNumber === trimmedPan) return true;
        if (trimmedPhone && m.phone === trimmedPhone) return true;
        if (trimmedName && m.fullName.toLowerCase().includes(trimmedName.toLowerCase())) return true;
        return false;
      });
    }

    const derivedAadhaar = existingTenant?.aadhaarNumber || mockResult?.aadhaarNumber || trimmedAadhaar || '000000000000';

    // Check dynamic reviews/tenants based on derived Aadhaar
    const dbReviewsCount = await TenantReview.countDocuments({ aadhaarNumber: derivedAadhaar });
    const dbTenantsCount = await Tenant.countDocuments({ aadhaarNumber: derivedAadhaar });
    
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
      const stats = await updateTenantStatsByAadhaar(derivedAadhaar);
      
      // Get the name from first matching review or tenant
      let fullNameVal = 'Verified Tenant';
      const firstTenant = await Tenant.findOne({ aadhaarNumber: derivedAadhaar });
      if (firstTenant) {
        fullNameVal = firstTenant.fullName;
      } else {
        const firstReview = await TenantReview.findOne({ aadhaarNumber: derivedAadhaar });
        if (firstReview) {
          fullNameVal = firstReview.tenantName;
        }
      }

      result = {
        fullName: fullNameVal,
        previousRating: stats.averageRating,
        creditScore: stats.score,
        riskLevel: stats.riskLevel,
        verificationStatus: 'verified',
        paymentHistory: `Reliability Index: ${stats.score}. Risk: ${stats.riskLevel.toUpperCase()}. Has dynamic tenant history.`,
        feedback: stats.feedbacks
      };
    } else {
      // Fallback: Lookup in our simulated registry
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
          fullName: trimmedName || 'New Tenant Record',
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
    const searchCriteria = {
      aadhaarNumber: trimmedAadhaar,
      panNumber: trimmedPan,
      phone: trimmedPhone,
      fullName: trimmedName
    };

    const log = await VerificationLog.create({
      aadhaarNumber: derivedAadhaar,
      searchCriteria,
      operator,
      requester: requesterId,
      result,
      riskLevel: result.riskLevel,
      status: result.verificationStatus
    });

    // Update matching tenant ratings & verificationStatus if they exist in the DB
    await Tenant.updateMany(
      { aadhaarNumber: derivedAadhaar },
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
    const latestTenant = await Tenant.findOne({
      $or: [
        { aadhaarNumber: derivedAadhaar },
        ...(trimmedPan ? [{ panNumber: trimmedPan }] : []),
        ...(trimmedPhone ? [{ phone: trimmedPhone }] : [])
      ]
    }).sort({ createdAt: -1 });

    const isNewTenant = !latestTenant;

    let connectionExists = false;
    let connectionStatus: 'active' | 'inactive' | null = null;
    if (latestTenant) {
      const connection = await TenantOwnerConnection.findOne({ tenant: latestTenant._id, owner: requesterId });
      if (connection) {
        connectionExists = true;
        connectionStatus = connection.isDeleted ? 'inactive' : 'active';
      }
    }

    const prefill = {
      fullName: latestTenant?.fullName || mockResult?.fullName || trimmedName || '',
      email: latestTenant?.email || '',
      phone: latestTenant?.phone || mockResult?.phone || trimmedPhone || '',
      emergencyContact: latestTenant?.emergencyContact || '',
      occupation: latestTenant?.occupation || '',
      address: latestTenant?.address || '',
      panNumber: latestTenant?.panNumber || mockResult?.panNumber || trimmedPan || '',
      aadhaarNumber: latestTenant?.aadhaarNumber || mockResult?.aadhaarNumber || trimmedAadhaar || ''
    };

    // Get the last 3 reviews to return
    let reviewsList: IMockReview[] = [];
    const dbReviews = await TenantReview.find({ aadhaarNumber: derivedAadhaar })
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
      reviewsList = mockResult?.reviews || [
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
